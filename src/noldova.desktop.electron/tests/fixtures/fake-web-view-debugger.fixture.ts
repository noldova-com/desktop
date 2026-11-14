/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWebViewDebugger } from "@noldova/desktop.electron";

import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeWebViewDebugger implements IWebViewDebugger {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private attached: boolean = false;
  public readonly versions: string[] = [];
  public readonly sent: [string, object][] = [];
  public readonly replies: Map<string, (params: object) => Promise<unknown>> = new Map();
  public isRefusingAttach: boolean = false;
  public detaches: number = 0;

  public attach(protocolVersion: string): void {
    if (this.isRefusingAttach)
      throw new Error("Another debugger is attached.");
    this.versions.push(protocolVersion);
    this.attached = true;
  }

  public isAttached(): boolean {
    return this.attached;
  }

  public detach(): void {
    this.detaches += 1;
    this.attached = false;
  }

  public sendCommand(method: string, params: object): Promise<unknown> {
    this.sent.push([method, params]);
    return this.replies.get(method)?.(params) ?? Promise.resolve({});
  }

  public on(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public receive(method: string, params: unknown, sessionId: string = String.empty): void {
    this.listeners.emit("message", {}, method, params, sessionId);
  }

  public lose(): void {
    this.attached = false;
    this.listeners.emit("detach", {}, "target closed");
  }

  public methods(): string[] {
    return this.sent.map(t => t[0]);
  }
}
