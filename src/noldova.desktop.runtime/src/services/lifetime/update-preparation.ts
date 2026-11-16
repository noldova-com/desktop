/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FSWatcher, watch } from "node:fs";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Failure, FailureCode, type UpdateProcess, UpdateReady, type UpdateRequest, type UpdateSaved } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { ConnectedClient } from "../../models/connected-client.js";
import type { EventChannel } from "../../models/event-channel.js";
import { ProductInfo } from "../../models/product-info.js";
import { Resources } from "../../resources.js";
import type { RuntimeServer } from "../endpoint/runtime-server.js";
import { Installation } from "../installation/installation.js";
import type { ProcessPresence } from "../installation/process-presence.js";
import type { ProcessSupervisor } from "../process/process-supervisor.js";

export class UpdatePreparation implements Disposable {
  private readonly server: RuntimeServer;
  private readonly presence: ProcessPresence;
  private readonly processes: ProcessSupervisor;
  private readonly updating: EventChannel;
  private readonly ended: EventChannel;
  private readonly saveWait: number;
  private readonly barrierHolderCheckInterval: number;
  private readonly installationFolder: string | null;
  private answers: Map<number, UpdateSaved> | null = null;
  private answered: (() => void) | null = null;
  private expected: readonly ConnectedClient[] = [];
  private watcher: FSWatcher | null = null;
  private holderCheck: NodeJS.Timeout | undefined;
  private watched: { readonly installation: Installation; readonly fail: (message: string, error: Error) => void } | null = null;
  private isChecking: boolean = false;
  private isStale: boolean = false;

  public constructor(
    server: RuntimeServer,
    presence: ProcessPresence,
    processes: ProcessSupervisor,
    updating: EventChannel,
    ended: EventChannel,
    saveWait: number,
    barrierHolderCheckInterval: number,
    installationFolder: string | null) {
    this.server = server;
    this.presence = presence;
    this.processes = processes;
    this.updating = updating;
    this.ended = ended;
    this.saveWait = saveWait;
    this.barrierHolderCheckInterval = barrierHolderCheckInterval;
    this.installationFolder = installationFolder;
  }

  public async prepareAsync(connection: number, request: UpdateRequest): Promise<UpdateReady> {
    const failure = new Failure(FailureCode.Updating, Resources.formatUpdating(ProductInfo.current.name));
    const installationFolder = this.installationFolder;
    if (Object.isNull(installationFolder) || request.installation !== installationFolder)
      throw new MethodFailureException(new Failure(FailureCode.InvalidParams, Resources.installationNotThisRuntimes));
    if (!Object.isNull(this.answers))
      throw new MethodFailureException(failure);
    const installation = new Installation(installationFolder, t => this.presence.isRunningAsync(t));
    const failed = Promise.withResolvers<never>();
    const fail = (message: string, error: Error): void => {
      failed.reject(new MethodFailureException(new Failure(FailureCode.Unavailable, message), new ExceptionOptions(error)));
      this.end();
    };
    const watcher = this.watchFolder(installation, fail);
    const answers = new Map<number, UpdateSaved>();
    const expected = this.server.clients.filter(t => t.connection !== connection);
    const settled = Promise.withResolvers<void>();
    this.answers = answers;
    this.expected = expected;
    this.answered = settled.resolve;
    this.server.beginUpdate(failure);
    this.server.refuseAfterSave(connection);
    this.processes.pause();
    this.updating.publish(null);
    this.watchBarrier(installation, watcher, fail);
    this.settleIfAnswered(answers);
    const timer = setTimeout(settled.resolve, this.saveWait);
    try {
      await Promise.race([settled.promise, failed.promise]);
    }
    finally {
      clearTimeout(timer);
    }
    for (const client of expected)
      this.server.refuseAfterSave(client.connection);
    return this.readReadyAsync(expected, answers);
  }

  public recordSaved(connection: number, saved: UpdateSaved): void {
    if (Object.isNull(this.answers))
      throw new MethodFailureException(new Failure(FailureCode.Conflict, Resources.updateNotPreparing));
    this.answers.set(connection, saved);
    this.server.refuseAfterSave(connection);
    this.settleIfAnswered(this.answers);
  }

  public [Symbol.dispose](): void {
    this.watched = null;
    this.unwatch();
  }

  private static isProgrammingError(error: unknown): error is Error {
    return error instanceof TypeError || error instanceof ReferenceError || error instanceof RangeError;
  }

  private settleIfAnswered(answers: ReadonlyMap<number, UpdateSaved>): void {
    if (this.expected.every(t => answers.has(t.connection)))
      this.answered?.();
  }

  private async readReadyAsync(expected: readonly ConnectedClient[], answers: ReadonlyMap<number, UpdateSaved>): Promise<UpdateReady> {
    const problems = expected.flatMap(t => answers.get(t.connection)?.problems ?? [Resources.formatClientNotAnswered(t.client)]);
    const clients = expected.flatMap((t): (readonly [number, string])[] => {
      const saved = answers.get(t.connection);
      return Object.isUndefined(saved) ? [] : [[saved.processId, t.client]];
    });
    const processes: UpdateProcess[] = [...await this.presence.stampAsync(clients), ...this.processes.updateProcesses];
    return new UpdateReady(problems, processes);
  }

  private watchFolder(installation: Installation, fail: (message: string, error: Error) => void): FSWatcher {
    try {
      return watch(installation.folder, { persistent: false }, () => this.check(installation, fail));
    }
    catch (error) {
      throw new MethodFailureException(new Failure(FailureCode.Unavailable, Resources.barrierUnwatchable), new ExceptionOptions(error));
    }
  }

  private watchBarrier(installation: Installation, watcher: FSWatcher, fail: (message: string, error: Error) => void): void {
    this.watched = { installation, fail };
    this.watcher = watcher;
    watcher.once(Resources.errorEvent, (error: Error) => fail(Resources.barrierUnwatchable, error));
    this.holderCheck = setInterval(() => this.check(installation, fail), this.barrierHolderCheckInterval).unref();
    this.check(installation, fail);
  }

  private check(installation: Installation, fail: (message: string, error: Error) => void): void {
    if (this.isChecking) {
      this.isStale = true;
      return;
    }
    this.isChecking = true;
    void this.checkAsync(installation, fail);
  }

  private async checkAsync(installation: Installation, fail: (message: string, error: Error) => void): Promise<void> {
    let hasEnded = false;
    let bug: Error | null = null;
    do {
      this.isStale = false;
      try {
        hasEnded = await installation.hasEndedAsync();
      }
      catch (error) {
        bug = UpdatePreparation.isProgrammingError(error) ? error : null;
      }
    } while (this.isStale && !hasEnded && Object.isNull(bug));
    this.isChecking = false;
    const watched = this.watched;
    if (Object.isNull(watched))
      return;
    if (watched.installation !== installation) {
      this.check(watched.installation, watched.fail);
      return;
    }
    if (!Object.isNull(bug))
      fail(Resources.barrierUncheckable, bug);
    else if (hasEnded)
      this.end();
  }

  private unwatch(): void {
    this.watcher?.close();
    this.watcher = null;
    clearInterval(this.holderCheck);
  }

  private end(): void {
    this.watched = null;
    this.unwatch();
    this.answers = null;
    this.answered?.();
    this.answered = null;
    this.expected = [];
    this.server.endUpdate();
    this.processes.resume();
    this.ended.publish(null);
  }
}
