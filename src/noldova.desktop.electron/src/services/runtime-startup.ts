/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import "@noldova/context.core";
import { type Event, type Failure, type RuntimeHandover, ShellEvents, ShellMethods, StopPolicy, UpdateSaved } from "@noldova/desktop.protocol";
import {
  ConnectionException,
  type IRuntimeClientListener,
  LaunchException,
  PreShellDataFoundException,
  RuntimeHandoverException,
  type UpdateBarrierStatus,
  UpdateInProgressException,
  WorkInProgressException
} from "@noldova/desktop.runtime";

import { StartupStateKind } from "../enums/startup-state-kind.js";
import type { IRuntimeConnection } from "../interfaces/i-runtime-connection.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { IUpdateHost } from "../interfaces/i-update-host.js";
import { StartupState } from "../models/startup-state.js";
import { Resources } from "../resources.js";

export class RuntimeStartup {
  private readonly launcher: IRuntimeLauncher;
  private readonly publish: (state: StartupState) => void;
  private readonly handOver: (handover: RuntimeHandover) => boolean;
  private readonly waitInterval: number;
  private readonly forward: (event: Event) => void;
  private readonly log: (message: string) => void;
  private readonly now: () => number;
  private readonly wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly updates: IUpdateHost;
  private readonly closing: AbortController = new AbortController();
  private state: StartupState = StartupState.connecting();
  private beforeUpdate: StartupState = StartupState.ready();
  private connectionValue: IRuntimeConnection | null = null;
  private listener: IRuntimeClientListener | null = null;
  private attaching: IRuntimeClientListener | null = null;
  private readonly held: Event[] = [];
  private readyAt: number = 0;
  private unstableEnds: number = 0;
  private barrierChange: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public constructor(
    launcher: IRuntimeLauncher,
    publish: (state: StartupState) => void,
    handOver: (handover: RuntimeHandover) => boolean,
    waitInterval: number,
    forward: (event: Event) => void,
    log: (message: string) => void,
    now: () => number,
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void>,
    updates: IUpdateHost) {
    this.launcher = launcher;
    this.publish = publish;
    this.handOver = handOver;
    this.waitInterval = waitInterval;
    this.forward = forward;
    this.log = log;
    this.now = now;
    this.wait = wait;
    this.updates = updates;
  }

  public get current(): StartupState {
    return this.state;
  }

  public get connection(): IRuntimeConnection | null {
    return this.connectionValue;
  }

  public startAsync(): Promise<void> {
    return this.attachAsync(StopPolicy.IfIdle);
  }

  public async actAsync(action: unknown): Promise<boolean> {
    const kind = this.state.kind;
    if (action === Resources.moveAsideAction && kind === StartupStateKind.PreShellData)
      await this.runAsync(t => this.launcher.moveAsideAsync(Resources.clientName, t, StopPolicy.IfIdle));
    else if (action === Resources.stopWorkAction && kind === StartupStateKind.WorkInProgress)
      await this.attachAsync(StopPolicy.StopWork);
    else if (action === Resources.waitAction && kind === StartupStateKind.WorkInProgress)
      await this.waitForWorkAsync();
    else if (action === Resources.retryAction && kind === StartupStateKind.Failed) {
      this.unstableEnds = 0;
      await this.attachAsync(StopPolicy.IfIdle);
    }
    else
      return false;
    return true;
  }

  public barrierChanged(): void {
    this.barrierChange.resolve();
  }

  public close(): void {
    this.closing.abort();
    this.connectionValue?.close();
    this.connectionValue = null;
  }

  private get isClosed(): boolean {
    return this.closing.signal.aborted;
  }

  private listen(): IRuntimeClientListener {
    const listener: IRuntimeClientListener = {
      onEvent: t => {
        if (listener === this.attaching)
          this.held.push(t);
        else
          this.receive(t);
      },
      onDisconnected: t => {
        if (listener === this.listener)
          this.reconnect(t);
      }
    };
    this.attaching = listener;
    this.held.length = 0;
    return listener;
  }

  private attach(policy: StopPolicy, listener: IRuntimeClientListener): Promise<IRuntimeConnection> {
    return this.launcher.attachAsync(Resources.clientName, listener, policy);
  }

  private attachAsync(policy: StopPolicy): Promise<void> {
    return this.runAsync(t => this.attach(policy, t));
  }

  private async waitForWorkAsync(): Promise<void> {
    this.update(StartupState.connecting());
    while (!this.isClosed) {
      const listener = this.listen();
      try {
        this.accept(await this.attach(StopPolicy.IfIdle, listener), listener);
        return;
      }
      catch (error) {
        if (!(error instanceof WorkInProgressException))
          return await this.refuseAsync(error);
        this.update(StartupState.waitingForWork(error.work.descriptions));
      }
      await this.pauseAsync(this.waitInterval);
    }
  }

  private async pauseAsync(milliseconds: number, signal: AbortSignal = this.closing.signal): Promise<void> {
    try {
      signal.throwIfAborted();
      await this.wait(milliseconds, signal);
    }
    catch (error) {
      if (!signal.aborted)
        throw error;
    }
  }

  private async runAsync(attach: (listener: IRuntimeClientListener) => Promise<IRuntimeConnection>): Promise<void> {
    this.update(StartupState.connecting());
    await this.connectAsync(attach);
  }

  private async connectAsync(attach: (listener: IRuntimeClientListener) => Promise<IRuntimeConnection>): Promise<void> {
    const listener = this.listen();
    try {
      this.accept(await attach(listener), listener);
    }
    catch (error) {
      await this.refuseAsync(error);
    }
  }

  private accept(connection: IRuntimeConnection, listener: IRuntimeClientListener): void {
    if (this.isClosed) {
      connection.close();
      return;
    }
    const replaced = this.connectionValue;
    this.connectionValue = connection;
    this.listener = listener;
    replaced?.close();
    this.readyAt = this.now();
    this.update(StartupState.ready());
    this.attaching = null;
    for (const event of this.held.splice(0))
      this.receive(event);
  }

  private async refuseAsync(error: unknown): Promise<void> {
    if (error instanceof UpdateInProgressException)
      await this.passBarrierAsync(error.status);
    else if (error instanceof PreShellDataFoundException)
      this.update(StartupState.preShellData(error.data.location));
    else if (error instanceof WorkInProgressException)
      this.update(StartupState.workInProgress(error.work.descriptions));
    else if (error instanceof RuntimeHandoverException) {
      if (!this.handOver(error.handover))
        this.update(StartupState.newerBuild(error.handover.identity.productVersion));
    }
    else if (error instanceof LaunchException || error instanceof ConnectionException) {
      this.log(Resources.formatRuntimeNotStarted(error.message));
      this.update(StartupState.failed(error.message));
    }
    else {
      this.log(Resources.formatRuntimeNotStarted(inspect(error)));
      this.update(StartupState.failed(String(error)));
    }
  }

  private async passBarrierAsync(status: UpdateBarrierStatus): Promise<void> {
    if (await this.updates.passBarrierAsync(status))
      await this.attachAsync(StopPolicy.IfIdle);
    else
      this.updates.quit();
  }

  private receive(event: Event): void {
    if (event.name.equals(ShellEvents.updating))
      void this.freezeAsync(this.connectionValue);
    else if (event.name.equals(ShellEvents.updateEnded) && this.state.kind === StartupStateKind.Updating && !Object.isNull(this.connectionValue))
      this.update(this.beforeUpdate);
    this.forward(event);
  }

  private async freezeAsync(connection: IRuntimeConnection | null): Promise<void> {
    if (Object.isNull(connection))
      return;
    if (this.state.kind !== StartupStateKind.Updating)
      this.beforeUpdate = this.state;
    this.update(StartupState.updating(String.empty));
    const barrier = await this.updates.readBarrierAsync().catch(() => null);
    if (this.state.kind !== StartupStateKind.Updating)
      return;
    if (!Object.isNull(barrier))
      this.update(StartupState.updating(barrier.version));
    const saved = new UpdateSaved(this.updates.processId, await this.updates.saveAsync());
    await connection.callAsync(ShellMethods.updateSaved, saved.toJson())
      .catch((error: unknown) => this.log(Resources.formatUpdateSavedUnsent(String(error))));
  }

  private async followUpdateAsync(): Promise<void> {
    while (!this.isClosed) {
      this.barrierChange = Promise.withResolvers<void>();
      if (await this.updates.hasUpdateEndedAsync().catch(() => false)) {
        await this.attachAsync(StopPolicy.IfIdle);
        return;
      }
      const woken = new AbortController();
      void this.barrierChange.promise.then(() => woken.abort());
      await this.pauseAsync(Resources.updateBarrierInterval, AbortSignal.any([this.closing.signal, woken.signal]));
    }
  }

  private reconnect(failure: Failure | null): void {
    if (Object.isNull(this.connectionValue) || this.isClosed)
      return;
    this.connectionValue = null;
    if (this.state.kind === StartupStateKind.Updating) {
      this.publish(this.state);
      void this.followUpdateAsync();
      return;
    }
    this.unstableEnds = this.now() - this.readyAt < Resources.stableConnectionPeriod ? this.unstableEnds + 1 : 1;
    const delay = Resources.reconnectionDelays[this.unstableEnds - 1];
    if (Object.isUndefined(delay))
      return this.stopReconnecting(failure);
    this.log(Object.isNull(failure) ? Resources.connectionEndedByRuntime : Resources.formatConnectionEnded(failure.code, failure.message));
    void this.reconnectAsync(delay);
  }

  private async reconnectAsync(delay: number): Promise<void> {
    this.update(StartupState.connecting());
    if (delay > 0)
      await this.pauseAsync(delay);
    if (!this.isClosed)
      await this.connectAsync(t => this.attach(StopPolicy.IfIdle, t));
  }

  private stopReconnecting(failure: Failure | null): void {
    const details = Resources.formatReconnectionStopped(Object.isNull(failure) ? Resources.endedByRuntime : Resources.formatEndedByMainProcess(failure.code, failure.message));
    this.log(Resources.formatRuntimeNotStarted(details));
    this.update(StartupState.failed(details));
  }

  private update(state: StartupState): void {
    this.state = state;
    this.publish(state);
  }
}
