/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { ShellMethods, StopPolicy, StopRequest, type UpdateProcess, UpdateReady, UpdateRequest, WorkReport } from "@noldova/desktop.protocol";
import { ConnectionException, DataDirectory, type Installation, type ProcessPresence, ProcessSettings, UpdateBackup, UpdateBarrier, UpdateBarrierState } from "@noldova/desktop.runtime";

import { DatabasesNotBackedUpException } from "../exceptions/databases-not-backed-up.exception.js";
import { ProcessesNotExitedException } from "../exceptions/processes-not-exited.exception.js";
import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import { UpdateHolderNotFoundException } from "../exceptions/update-holder-not-found.exception.js";
import { UpdateRefusedException } from "../exceptions/update-refused.exception.js";
import { UpdateStopFailedUnexpectedlyException } from "../exceptions/update-stop-failed-unexpectedly.exception.js";
import { UpdateStopException } from "../exceptions/update-stop.exception.js";
import { UpdateUnderWayException } from "../exceptions/update-under-way.exception.js";
import { UpdateUnsavedException } from "../exceptions/update-unsaved.exception.js";
import { WorkStartedMeanwhileException } from "../exceptions/work-started-meanwhile.exception.js";
import type { IUpdateTarget } from "../interfaces/i-update-target.js";
import { UpdateStopResult } from "../models/update-stop-result.js";
import { Resources } from "../resources.js";
import type { AppImageRestart } from "./app-image-restart.js";

export class UpdateStop {
  private readonly installation: Installation;
  private readonly presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">;
  private readonly connectAsync: (dataDirectory: string, onChange: () => void) => Promise<IUpdateTarget | null>;
  private readonly askAsync: (work: readonly string[], readWorkAsync: () => Promise<readonly string[]>, waitForChangeAsync: (signal: AbortSignal) => Promise<void>) => Promise<readonly string[] | null>;
  private readonly processId: number;
  private readonly productVersion: string;
  private readonly now: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly restart: AppImageRestart | null;
  private readonly log: (text: string) => void;
  private readonly backUpAsync: (dataDirectory: string) => Promise<unknown>;
  private changed: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public constructor(
    installation: Installation,
    presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">,
    connectAsync: (dataDirectory: string, onChange: () => void) => Promise<IUpdateTarget | null>,
    askAsync: (work: readonly string[], readWorkAsync: () => Promise<readonly string[]>, waitForChangeAsync: (signal: AbortSignal) => Promise<void>) => Promise<readonly string[] | null>,
    processId: number,
    productVersion: string,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>,
    restart: AppImageRestart | null,
    log: (text: string) => void,
    backUpAsync: (dataDirectory: string) => Promise<unknown> = t => UpdateBackup.createAsync(new DataDirectory(t))) {
    this.installation = installation;
    this.presence = presence;
    this.connectAsync = connectAsync;
    this.askAsync = askAsync;
    this.processId = processId;
    this.productVersion = productVersion;
    this.now = now;
    this.wait = wait;
    this.restart = restart;
    this.log = log;
    this.backUpAsync = backUpAsync;
  }

  public async runAsync(version: string, handOffAsync: () => Promise<number | null>): Promise<UpdateStopResult> {
    const targets: IUpdateTarget[] = [];
    let isHeld = false;
    let isHandedOff = false;
    this.changed = Promise.withResolvers<void>();
    try {
      targets.push(...await this.connectAllAsync(await this.installation.listDataDirectoriesAsync()));
      const work = await this.readWorkAsync(targets);
      const answer = work.length > 0 ? await this.askAsync(work, () => this.rereadWorkAsync(targets), t => this.waitForChangeAsync(t)) : [];
      if (Object.isNull(answer))
        return UpdateStopResult.cancelled();
      const agreed = new Set(answer);
      const holder = await this.stampSelfAsync();
      isHeld = await this.installation.holdAsync(new UpdateBarrier(holder, version, UpdateBarrierState.Preparing, null), this.productVersion);
      if (!isHeld)
        throw new UpdateUnderWayException();
      const known = new Set(targets.map(t => t.dataDirectory));
      const dataDirectories = await this.installation.listDataDirectoriesAsync();
      targets.push(...await this.connectAllAsync(dataDirectories.filter(t => !known.has(t))));
      const processes = (await Promise.all(targets.map(t => this.prepareAsync(t)))).flat();
      const remaining = await Promise.all(targets.map(async (t): Promise<readonly [IUpdateTarget, readonly string[]]> => [t, await this.readTargetWorkAsync(t)]));
      const unseen = remaining.flatMap(([, t]) => t).filter(t => !agreed.has(t));
      if (unseen.length > 0)
        throw new WorkStartedMeanwhileException(unseen);
      await Promise.all(remaining.map(([target, t]) => this.stopAsync(target, t.length > 0 ? StopPolicy.StopWork : StopPolicy.IfIdle)));
      await this.verifyAsync([...targets.map(t => t.runtime), ...processes.filter(t => t.role !== Resources.clientName)], new ProcessSettings().stopLimit + Resources.updateStopMargin);
      for (const dataDirectory of new Set([...known, ...dataDirectories]))
        await this.backUpDirectoryAsync(dataDirectory);
      await this.installation.replaceAsync(new UpdateBarrier(holder, version, UpdateBarrierState.Closing, null));
      await this.verifyAsync(await this.listOtherMainProcessesAsync(processes), Resources.updateExitWait);
      await this.installation.replaceAsync(new UpdateBarrier(holder, version, UpdateBarrierState.HandedOff, null));
      await this.restart?.startAsync();
      const successor = await handOffAsync();
      isHandedOff = true;
      return UpdateStopResult.handedOff(await this.recordHandoffAsync(holder, version, successor));
    }
    catch (error) {
      if (!isHandedOff)
        this.restart?.cancel();
      if (isHeld && !isHandedOff)
        await this.releaseAsync();
      throw error instanceof UpdateStopException || error instanceof UpdateHandoffException ? error : new UpdateStopFailedUnexpectedlyException(new ExceptionOptions(error));
    }
    finally {
      for (const target of targets)
        target.connection.close();
    }
  }

  private async backUpDirectoryAsync(dataDirectory: string): Promise<void> {
    try {
      await this.backUpAsync(dataDirectory);
    }
    catch (error) {
      throw new DatabasesNotBackedUpException(dataDirectory, error);
    }
  }

  private async connectAllAsync(dataDirectories: readonly string[]): Promise<readonly IUpdateTarget[]> {
    const failures: unknown[] = [];
    const results = await Promise.all(dataDirectories.map(t => this.connectAsync(t, () => this.changed.resolve()).catch((error: unknown) => {
      failures.push(error);
      return null;
    })));
    const targets = results.filter(t => !Object.isNull(t));
    if (failures.length === 0)
      return targets;
    for (const target of targets)
      target.connection.close();
    throw failures[0];
  }

  private async waitForChangeAsync(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const aborted = Promise.withResolvers<void>();
    const abort = (): void => aborted.resolve();
    signal.addEventListener(Resources.abortEvent, abort, { once: true });
    try {
      await Promise.race([this.changed.promise, aborted.promise]);
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, abort);
    }
    signal.throwIfAborted();
    this.changed = Promise.withResolvers<void>();
  }

  private async readWorkAsync(targets: readonly IUpdateTarget[]): Promise<readonly string[]> {
    return (await Promise.all(targets.map(t => this.readTargetWorkAsync(t)))).flat();
  }

  private async rereadWorkAsync(targets: IUpdateTarget[]): Promise<readonly string[]> {
    const work = await Promise.all(targets.map(t => this.readTargetWorkAsync(t).catch((error: unknown) => {
      if (error instanceof ConnectionException)
        return null;
      throw error;
    })));
    for (const target of targets.filter((_, index) => Object.isNull(work[index]))) {
      target.connection.close();
      targets.splice(targets.indexOf(target), 1);
    }
    return work.filter(t => !Object.isNull(t)).flat();
  }

  private async readTargetWorkAsync(target: IUpdateTarget): Promise<readonly string[]> {
    const response = await target.connection.callAsync(ShellMethods.work, null, Resources.workQueryTimeout);
    if (!Object.isUndefined(response.failure))
      throw new UpdateRefusedException(target.dataDirectory, response.failure);
    return WorkReport.fromJson(response.payload).descriptions.map(t => Resources.formatUpdateWork(t, target.dataDirectory));
  }

  private async listOtherMainProcessesAsync(processes: readonly UpdateProcess[]): Promise<readonly UpdateProcess[]> {
    const mainProcesses = [...processes.filter(t => t.role === Resources.clientName), ...await this.installation.listMainProcessesAsync()];
    return mainProcesses.filter((t, index) => t.processId !== this.processId && mainProcesses.findIndex(u => u.processId === t.processId) === index);
  }

  private async releaseAsync(): Promise<void> {
    try {
      await this.installation.releaseAsync();
    }
    catch {
      await this.wait(Resources.barrierReleaseRetryDelay);
      await this.installation.releaseAsync().catch((failure: unknown) => this.log(Resources.formatUpdateBarrierNotReleased(String(failure))));
    }
  }

  private async stampSelfAsync(): Promise<UpdateProcess> {
    const [holder] = await this.presence.stampAsync([[this.processId, Resources.clientName]]);
    if (Object.isUndefined(holder))
      throw new UpdateHolderNotFoundException();
    return holder;
  }

  private async recordHandoffAsync(holder: UpdateProcess, version: string, processId: number | null): Promise<boolean> {
    if (Object.isNull(processId))
      return true;
    const stamped = await this.presence.stampAsync([[processId, Resources.handoffRole]]).catch((failure: unknown) => {
      this.log(Resources.formatHandoffNotStamped(String(failure)));
      return null;
    });
    if (Object.isNull(stamped))
      return false;
    const [handoff] = stamped;
    if (Object.isUndefined(handoff))
      return true;
    try {
      await this.installation.replaceAsync(new UpdateBarrier(holder, version, UpdateBarrierState.HandedOff, handoff));
      return true;
    }
    catch (failure) {
      this.log(Resources.formatHandoffNotRecorded(String(failure)));
      return false;
    }
  }

  private async prepareAsync(target: IUpdateTarget): Promise<readonly UpdateProcess[]> {
    const response = await target.connection.callAsync(ShellMethods.update, new UpdateRequest(this.installation.folder).toJson(), Resources.updatePrepareTimeout);
    if (!Object.isUndefined(response.failure))
      throw new UpdateRefusedException(target.dataDirectory, response.failure);
    const ready = UpdateReady.fromJson(response.payload);
    if (!ready.isReady)
      throw new UpdateUnsavedException(target.dataDirectory, ready.problems);
    return ready.processes;
  }

  private async stopAsync(target: IUpdateTarget, policy: StopPolicy): Promise<void> {
    const response = await target.connection.callAsync(ShellMethods.stop, new StopRequest(policy).toJson(), Resources.updatePrepareTimeout);
    if (!Object.isUndefined(response.failure))
      throw new UpdateRefusedException(target.dataDirectory, response.failure);
  }

  private async verifyAsync(processes: readonly UpdateProcess[], milliseconds: number): Promise<void> {
    const deadline = this.now() + milliseconds;
    let running = processes;
    for (;;) {
      const checks = await Promise.all(running.map(t => this.presence.isRunningAsync(t)));
      running = running.filter((_, index) => checks[index]);
      if (running.length === 0)
        return;
      if (this.now() >= deadline)
        throw new ProcessesNotExitedException(running, milliseconds);
      await this.wait(Resources.updateExitInterval);
    }
  }
}
