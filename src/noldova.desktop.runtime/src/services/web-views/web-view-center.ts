/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import {
  WebViewAction, type WebViewAnswered, WebViewBlockedPorts, WebViewCommand, WebViewEvent, WebViewEventKind, type WebViewEvents, WebViewFailure, WebViewFailureKind, WebViewInfo, WebViewPane
} from "@noldova/desktop.protocol";

import { WebViewFailureException } from "../../exceptions/web-view-failure.exception.js";
import type { IPortBlocker } from "../../interfaces/i-port-blocker.js";
import type { EventChannel } from "../../models/event-channel.js";
import { Registration } from "../../models/registration.js";
import { Resources } from "../../resources.js";

export class WebViewCenter implements IPortBlocker {
  private readonly diagnostics: Writable;
  private readonly channel: EventChannel | null;
  private readonly portsChannel: EventChannel | null;
  private readonly ports: Set<number> = new Set();
  private readonly calls: Map<number, { readonly connection: number; readonly wait: PromiseWithResolvers<JsonValue> }> = new Map();
  private readonly modules: Map<string, { readonly views: Map<string, WebViewInfo>; readonly listeners: Set<(event: WebViewEvent) => void> }> = new Map();
  private target: { readonly connection: number; readonly channel: EventChannel } | null = null;
  private nextCall: number = 1;
  private portsSerial: number = 0;
  private portWaits: readonly { readonly serial: number; readonly wait: PromiseWithResolvers<void> }[] = [];

  public constructor(diagnostics: Writable, channel: EventChannel | null = null, portsChannel: EventChannel | null = null) {
    this.diagnostics = diagnostics;
    this.channel = channel;
    this.portsChannel = portsChannel;
  }

  public attach(moduleId: string): Registration {
    const entry = { views: new Map<string, WebViewInfo>(), listeners: new Set<(event: WebViewEvent) => void>() };
    this.modules.set(moduleId, entry);
    if (!Object.isNull(this.target))
      this.refresh(moduleId);
    return new Registration(() => {
      if (this.modules.get(moduleId) === entry)
        this.modules.delete(moduleId);
    });
  }

  public list(moduleId: string): readonly WebViewInfo[] {
    return [...this.modules.get(moduleId)?.views.values() ?? []];
  }

  public listen(moduleId: string, listener: (event: WebViewEvent) => void): () => void {
    const listeners = this.modules.get(moduleId)?.listeners ?? new Set<(event: WebViewEvent) => void>();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  public async commandAsync(moduleId: string, action: WebViewAction, view: string | null = null, value: JsonValue = null): Promise<JsonValue> {
    const target = this.target;
    if (Object.isNull(target))
      throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Unavailable));
    const command = new WebViewCommand(this.nextCall, moduleId, action, view, value);
    this.nextCall += 1;
    const wait = Promise.withResolvers<JsonValue>();
    this.calls.set(command.call, { connection: target.connection, wait });
    target.channel.publishTo(target.connection, null, command.toJson());
    return wait.promise;
  }

  public answer(connection: number, answered: WebViewAnswered): void {
    const call = this.calls.get(answered.call);
    if (Object.isUndefined(call) || call.connection !== connection)
      return;
    this.calls.delete(answered.call);
    if (Object.isNull(answered.failure))
      call.wait.resolve(answered.value);
    else
      call.wait.reject(new WebViewFailureException(answered.failure));
  }

  public blockPort(port: number): number {
    this.ports.add(port);
    return this.publishPorts();
  }

  public async waitForPortsAsync(serial: number, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (Object.isNull(this.target) || Object.isNull(this.portsChannel))
      return;
    const entry = { serial, wait: Promise.withResolvers<void>() };
    this.portWaits = [...this.portWaits, entry];
    const abort = (): void => {
      this.portWaits = this.portWaits.filter(t => t !== entry);
      entry.wait.reject(signal.reason);
    };
    signal.addEventListener(Resources.abortEvent, abort, { once: true });
    try {
      await entry.wait.promise;
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, abort);
    }
  }

  public unblockPort(port: number): void {
    if (this.ports.delete(port))
      this.publishPorts();
  }

  public readPorts(connection: number): WebViewBlockedPorts | null {
    return connection === this.target?.connection ? new WebViewBlockedPorts(this.portsSerial, [...this.ports]) : null;
  }

  public answerPorts(connection: number, blocked: WebViewBlockedPorts): void {
    if (connection === this.target?.connection)
      this.settlePorts(t => t <= blocked.serial);
  }

  public receive(connection: number, events: WebViewEvents): void {
    if (connection !== this.target?.connection)
      return;
    for (const event of events.events)
      this.deliver(event);
  }

  public check(connection: number | null): void {
    const channel = this.channel;
    const target = Object.isNull(connection) || Object.isNull(channel) ? null : { connection, channel };
    if (target?.connection === this.target?.connection)
      return;
    this.drop();
    this.target = target;
    if (Object.isNull(target)) {
      this.settlePorts(() => true);
      return;
    }
    for (const moduleId of [...this.modules.keys()])
      this.refresh(moduleId);
  }

  private publishPorts(): number {
    this.portsSerial += 1;
    if (!Object.isNull(this.target) && !Object.isNull(this.portsChannel))
      this.portsChannel.publishTo(this.target.connection, null, new WebViewBlockedPorts(this.portsSerial, [...this.ports]).toJson());
    return this.portsSerial;
  }

  private settlePorts(isCovered: (serial: number) => boolean): void {
    const settled = this.portWaits.filter(t => isCovered(t.serial));
    this.portWaits = this.portWaits.filter(t => !isCovered(t.serial));
    for (const entry of settled)
      entry.wait.resolve();
  }

  private drop(): void {
    const calls = [...this.calls.values()];
    this.calls.clear();
    for (const call of calls)
      call.wait.reject(new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Unavailable)));
    for (const [moduleId, entry] of [...this.modules])
      for (const id of [...entry.views.keys()])
        this.deliver(new WebViewEvent(moduleId, id, WebViewEventKind.Closed));
  }

  private refresh(moduleId: string): void {
    this.commandAsync(moduleId, WebViewAction.List)
      .then(value => {
        for (const info of (Array.isArray(value) ? value : []).map(t => WebViewInfo.fromJson(t)))
          if (info.module === moduleId && this.modules.get(moduleId)?.views.has(info.id) === false)
            this.deliver(new WebViewEvent(moduleId, info.id, WebViewEventKind.Opened, {
              [Resources.webViewPaneField]: info.pane.toJson(), [Resources.webViewProfileKeyField]: info.profileKey
            }));
      })
      .catch((error: unknown) => this.diagnostics.write(Resources.formatWebViewsNotListed(moduleId, String(error))));
  }

  private deliver(event: WebViewEvent): void {
    const entry = this.modules.get(event.module);
    if (Object.isUndefined(entry))
      return;
    if (event.kind === WebViewEventKind.Opened)
      entry.views.set(event.view, new WebViewInfo(
        event.view, event.module, WebViewPane.fromJson(event.details[Resources.webViewPaneField]), String(event.details[Resources.webViewProfileKeyField])));
    if (event.kind === WebViewEventKind.Closed)
      entry.views.delete(event.view);
    for (const listener of [...entry.listeners])
      try {
        listener(event);
      }
      catch (error) {
        this.diagnostics.write(Resources.formatWebViewEventNotHeard(event.module, String(error)));
      }
  }
}
