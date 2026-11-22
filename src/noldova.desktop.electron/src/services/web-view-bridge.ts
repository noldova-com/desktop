/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import { JsonException, type JsonValue } from "@noldova/context.json";
import {
  type IKeyStroke,
  ShellMethods,
  WebViewAnswered,
  WebViewBlockedPorts,
  WebViewCommand,
  type WebViewDeclaration,
  type WebViewEvent,
  WebViewFailure,
  WebViewFailureKind
} from "@noldova/desktop.protocol";

import type { IMainProcessEnvironment } from "../interfaces/i-main-process-environment.js";
import type { IMainProcessOptions } from "../interfaces/i-main-process-options.js";
import { CaughtFailure } from "../models/caught-failure.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import type { MainProcessLog } from "./main-process-log.js";
import type { RuntimeCaller } from "./runtime-caller.js";
import { WebViewHost } from "./web-view-host.js";
import { WebViewOriginCheck } from "./web-view-origin-check.js";

export class WebViewBridge {
  public readonly host: WebViewHost;
  private readonly process: IMainProcessEnvironment;
  private readonly windows: WindowRegistry;
  private readonly runtime: RuntimeCaller;
  private readonly log: MainProcessLog;
  private declarations: Promise<ReadonlyMap<string, WebViewDeclaration>> | undefined;
  private blockedPorts: ReadonlySet<number> | null = null;
  private blockedSerial: number = -1;
  private connection: object | null = null;

  public constructor(options: IMainProcessOptions, windows: WindowRegistry, runtime: RuntimeCaller, isReady: () => boolean) {
    this.process = options.process;
    this.windows = windows;
    this.runtime = runtime;
    this.log = options.log;
    this.declarations = undefined;
    this.host = new WebViewHost(options.electron.webViews, new WebViewOriginCheck([], () => this.blockedPorts), () => this.readDeclarationsAsync(), options.settings.platform,
      (windowId, event) => this.sendEvent(windowId, event), (windowId, stroke, press) => this.sendShortcut(windowId, stroke, press),
      (windowId, input) => this.windows.sendTo(windowId, Resources.webViewInputChannel, input), isReady,
      t => void runtime.callAsync(ShellMethods.webViewEvents, t.toJson()), t => options.log.write(t), t => windows.find(t)?.appearance);
  }

  public async answerAsync(payload: JsonValue): Promise<void> {
    let command: WebViewCommand;
    try {
      command = WebViewCommand.fromJson(payload);
    }
    catch (error) {
      this.log.write(Resources.formatWebViewCommandInvalid(CaughtFailure.expect(error, JsonException).message));
      return;
    }
    const answer = await this.host.commandAsync(command).catch((error: unknown) => this.fail(command, error));
    await this.runtime.callAsync(ShellMethods.webViewAnswered, answer.toJson());
  }

  public async connectAsync(): Promise<void> {
    const connection = {};
    this.connection = connection;
    const response = await this.runtime.callAsync(ShellMethods.readWebViewBlockedPorts, null);
    if (this.connection !== connection)
      return;
    const payload = response.payload ?? null;
    if (response.hasFailed || Object.isNull(payload)) {
      this.log.write(Resources.formatWebViewPortsUnread(response.failure?.message ?? String(null)));
      return;
    }
    await this.blockPortsAsync(payload);
  }

  public disconnect(): void {
    this.connection = null;
    this.blockedPorts = null;
    this.blockedSerial = -1;
  }

  public async blockPortsAsync(payload: JsonValue): Promise<void> {
    if (Object.isNull(this.connection))
      return;
    let blocked: WebViewBlockedPorts;
    try {
      blocked = WebViewBlockedPorts.fromJson(payload);
    }
    catch (error) {
      this.log.write(Resources.formatWebViewPortsInvalid(CaughtFailure.expect(error, JsonException).message));
      return;
    }
    if (blocked.serial <= this.blockedSerial)
      return;
    this.blockedPorts = new Set(blocked.ports);
    this.blockedSerial = blocked.serial;
    await this.runtime.callAsync(ShellMethods.webViewPortsBlocked, blocked.toJson());
  }

  private sendEvent(windowId: number, event: WebViewEvent): void {
    this.windows.sendTo(windowId, Resources.webViewEventChannel, event.toJson());
  }

  private sendShortcut(windowId: number, stroke: IKeyStroke, press: number): void {
    this.windows.sendTo(windowId, Resources.webViewShortcutChannel, { ...stroke, [Resources.pressField]: press });
  }

  private readDeclarationsAsync(): Promise<ReadonlyMap<string, WebViewDeclaration>> {
    this.declarations ??= this.process.readWebViewsAsync().catch((error: unknown) => {
      this.log.write(Resources.formatWebViewsUnreadable(String(error)));
      return new Map<string, WebViewDeclaration>();
    });
    return this.declarations;
  }

  private fail(command: WebViewCommand, error: unknown): WebViewAnswered {
    this.log.write(Resources.formatWebViewCommandFailed(command.module, command.action, inspect(error)));
    return new WebViewAnswered(command.call, null, new WebViewFailure(WebViewFailureKind.Unavailable));
  }
}
