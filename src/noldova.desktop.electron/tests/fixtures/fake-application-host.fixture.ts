/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IApplicationHost, ICommandLineHost } from "@noldova/desktop.electron";

import type { FakeDockHost } from "./fake-dock-host.fixture.js";
import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeApplicationHost implements IApplicationHost {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private readonly readiness: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public readonly calls: string[] = [];
  public exiting: () => void = () => undefined;
  public readonly isPackaged: boolean;
  public hasLock: boolean;
  public systemLanguages: string[] = ["en-US"];
  public isInApplications: boolean = true;
  public dock: FakeDockHost | undefined = undefined;
  public pathFailure: Error | null = null;
  public downloads: string | null = "Downloads";
  public isReady: boolean = false;
  public readonly switches: Map<string, string> = new Map();
  public readonly commandLine: ICommandLineHost = {
    appendSwitch: (name, value) => void this.calls.push(this.refuseAfterReady(`appendSwitch ${name} ${value}`)),
    getSwitchValue: name => this.switches.get(name) ?? String.empty
  };

  public constructor(hasLock: boolean, isPackaged: boolean) {
    this.hasLock = hasLock;
    this.isPackaged = isPackaged;
  }

  public isInApplicationsFolder(): boolean {
    return this.isInApplications;
  }

  public setName(name: string): void {
    this.calls.push(`setName ${name}`);
  }

  public setAppUserModelId(id: string): void {
    this.calls.push(`setAppUserModelId ${id}`);
  }

  public setDesktopName(name: string): void {
    this.calls.push(`setDesktopName ${name}`);
  }

  public setPath(name: string, path: string): void {
    if (!Object.isNull(this.pathFailure))
      throw this.pathFailure;
    this.calls.push(this.refuseAfterReady(`setPath ${name} ${path}`));
  }

  public getPath(name: string): string {
    if (Object.isNull(this.downloads))
      throw new Error(`Failed to get '${name}' path`);
    return this.downloads;
  }

  public requestSingleInstanceLock(): boolean {
    this.calls.push("requestSingleInstanceLock");
    return this.hasLock;
  }

  public releaseSingleInstanceLock(): void {
    this.calls.push("releaseSingleInstanceLock");
  }

  public getPreferredSystemLanguages(): string[] {
    return this.systemLanguages;
  }

  public enableSandbox(): void {
    this.calls.push(this.refuseAfterReady("enableSandbox"));
  }

  public quit(): void {
    this.tryQuit();
  }

  public quitFully(): void {
    if (this.tryQuit())
      this.listeners.emit("will-quit");
  }

  public relaunch(): void {
    this.calls.push("relaunch");
  }

  public exit(exitCode: number): void {
    this.calls.push(`exit ${exitCode}`);
    this.exiting();
  }

  public whenReady(): Promise<unknown> {
    return this.readiness.promise;
  }

  public on(event: string, listener: (event: FakePreventableEvent) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public async becomeReadyAsync(): Promise<void> {
    this.isReady = true;
    this.readiness.resolve();
    await this.readiness.promise;
    await Promise.resolve();
  }

  public emit(event: string): void {
    this.listeners.emit(event);
  }

  public count(event: string): number {
    return this.listeners.count(event);
  }

  public refuseAfterReady(call: string): string {
    if (this.isReady)
      throw new Error(`${call} can only be called before app is ready`);
    return call;
  }

  private tryQuit(): boolean {
    const event = new FakePreventableEvent();
    this.listeners.emit("before-quit", event);
    this.calls.push(event.isPrevented ? "quit prevented" : "quit");
    return !event.isPrevented;
  }
}
