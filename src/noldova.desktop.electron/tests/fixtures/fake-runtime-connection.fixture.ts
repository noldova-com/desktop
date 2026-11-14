/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";
import {
  Failure, FailureCode, NotificationState, type QualifiedName, Response, SettingEntry, SettingKey, ShellMethods, WindowStateKey, WindowStateWrite
} from "@noldova/desktop.protocol";
import type { IRuntimeConnection } from "@noldova/desktop.electron";

export class FakeRuntimeConnection implements IRuntimeConnection {
  public readonly states: Map<string, JsonObject> = new Map();
  public readonly calls: string[] = [];
  public readonly payloads: JsonValue[] = [];
  public isClosed: boolean = false;
  public isFailing: boolean = false;
  public onCall: (() => void) | undefined;
  public rejection: Error | undefined;
  public readonly answers: Map<string, Response> = new Map();
  public readonly deferred: Map<string, () => Promise<Response>> = new Map();
  public readonly timeouts: (number | undefined)[] = [];
  public readonly windows: (number | undefined)[] = [];
  public readonly pages: (number | undefined)[] = [];
  public readonly signals: (AbortSignal | undefined)[] = [];

  public constructor() {
    this.onCall = undefined;
    this.rejection = undefined;
  }

  public get isConnected(): boolean {
    return !this.isClosed;
  }

  public callAsync(method: QualifiedName, payload: JsonValue, timeout?: number, signal?: AbortSignal, window?: number, page?: number): Promise<Response> {
    this.calls.push(method.text);
    this.payloads.push(payload);
    this.timeouts.push(timeout);
    this.windows.push(window);
    this.pages.push(page);
    this.signals.push(signal);
    this.onCall?.();
    if (!Object.isUndefined(this.rejection))
      return Promise.reject(this.rejection);
    const later = this.deferred.get(method.text);
    if (!Object.isUndefined(later))
      return later();
    const answer = this.answers.get(method.text);
    if (!Object.isUndefined(answer))
      return Promise.resolve(answer);
    if (method.text === ShellMethods.work.text)
      return Promise.resolve(Response.success("r", { descriptions: [], sequence: 0 }));
    if ([ShellMethods.stop, ShellMethods.updateSaved, ShellMethods.quitAnswered, ShellMethods.windowClosed, ShellMethods.webViewAnswered, ShellMethods.webViewEvents, ShellMethods.runCommand,
      ShellMethods.secretAnswered, ShellMethods.grantFile, ShellMethods.endFileGrants, ShellMethods.discardFileGrants, ShellMethods.appWindowsChanged,
      ShellMethods.appShortcutsChanged, ShellMethods.mainWindowChanged].some(t => t.text === method.text))
      return Promise.resolve(Response.success("r", null));
    if (method.text === ShellMethods.agentControl.text)
      return Promise.resolve(Response.success("r", { isStopped: false, isActing: false }));
    if (method.text === ShellMethods.notifications.text)
      return Promise.resolve(Response.success("r", new NotificationState([], false, [], 0).toJson()));
    if (method.text === ShellMethods.readSetting.text)
      return Promise.resolve(Response.success("r", new SettingEntry(SettingKey.fromJson(payload).name, true, false).toJson()));
    if (this.isFailing)
      return Promise.resolve(Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    if (method.text === ShellMethods.setSetting.text)
      return Promise.resolve(Response.success("r", null));
    if (method.text === ShellMethods.writeWindowBounds.text || method.text === ShellMethods.writeWindowLayout.text) {
      const write = WindowStateWrite.fromJson(payload);
      this.states.set(`${method.member}:${write.key.device}:${write.key.window}`, write.value);
      return Promise.resolve(Response.success("r", null));
    }
    const key = WindowStateKey.fromJson(payload);
    const member = method.member.replace("read", "write");
    return Promise.resolve(Response.success("r", { value: this.states.get(`${member}:${key.device}:${key.window}`) ?? null }));
  }

  public close(): void {
    this.isClosed = true;
  }
}
