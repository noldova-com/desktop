/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { type Event, NotificationBroadcast, NotificationState, RecentCommands, SettingChange, SettingKey, ShellEvents, WorkReport } from "@noldova/desktop.protocol";

import type { IRuntimeEventOwners } from "../interfaces/i-runtime-event-owners.js";
import type { KnownDevice } from "../models/known-device.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";

export class RuntimeEvents {
  private readonly windows: WindowRegistry;
  private readonly device: KnownDevice;
  private readonly owners: IRuntimeEventOwners;
  private readonly log: (text: string) => void;

  public constructor(windows: WindowRegistry, device: KnownDevice, owners: IRuntimeEventOwners, log: (text: string) => void) {
    this.windows = windows;
    this.device = device;
    this.owners = owners;
    this.log = log;
  }

  public forward(event: Event): void {
    if (event.name.text === ShellEvents.webViewCommand.text) {
      this.owners.answerWebView(event.payload);
      return;
    }
    if (event.name.text === ShellEvents.secretCommand.text) {
      void this.owners.secrets.answerAsync(event.payload);
      return;
    }
    if (event.name.text === ShellEvents.quitting.text) {
      this.owners.quitForRuntime();
      return;
    }
    if (event.name.text === ShellEvents.work.text)
      this.receiveWork(event);
    if (event.name.text === ShellEvents.agentControlChanged.text)
      this.owners.agents.receiveChange(event.payload);
    const payload = event.name.text === ShellEvents.notifications.text ? this.readStateForDevice(event)
      : event.name.text === ShellEvents.settingsChanged.text ? this.readSettingForDevice(event)
        : event.name.text === ShellEvents.recentCommandsChanged.text ? this.readRecentCommandsForDevice(event) : event.payload;
    if (Object.isUndefined(payload))
      return;
    if (Object.isUndefined(event.window))
      this.windows.sendToAll(Resources.runtimeEventChannel, event.name.text, payload);
    else
      this.windows.sendTo(event.window, Resources.runtimeEventChannel, event.name.text, payload);
  }

  private receiveWork(event: Event): void {
    try {
      const report = WorkReport.fromJson(event.payload);
      this.owners.quit.receive(report);
      this.owners.tray.receiveWork(report);
    }
    catch (error) {
      this.log(Resources.formatEventNotForwarded(event.name.text, String(error)));
    }
  }

  private readSettingForDevice(event: Event): JsonValue | undefined {
    try {
      const change = SettingChange.fromJson(event.payload);
      const known = this.device.current ?? null;
      this.owners.trayIcon.receive(change, known);
      this.owners.keyBindings.receive(change, null);
      this.owners.updateChecks.receive(change, known);
      if (Object.isNull(change.key.device))
        return event.payload;
      return change.key.device === known ? new SettingChange(new SettingKey(change.key.name, change.key.scope), change.value, change.isSet).toJson() : undefined;
    }
    catch (error) {
      this.log(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }

  private readStateForDevice(event: Event): JsonObject | undefined {
    try {
      const broadcast = NotificationBroadcast.fromJson(event.payload);
      this.owners.notifier.receive(broadcast);
      const known = this.device.current;
      const state = Object.isUndefined(known) ? new NotificationState(broadcast.notifications, false, broadcast.mutedModules, broadcast.sequence) : broadcast.stateFor(known);
      this.owners.tray.receiveNotifications(state);
      return state.toJson();
    }
    catch (error) {
      this.log(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }

  private readRecentCommandsForDevice(event: Event): JsonObject | undefined {
    try {
      const recent = RecentCommands.fromJson(event.payload);
      return recent.device === (this.device.current ?? null) ? new RecentCommands(recent.ids).toJson() : undefined;
    }
    catch (error) {
      this.log(Resources.formatEventNotForwarded(event.name.text, String(error)));
      return undefined;
    }
  }
}
