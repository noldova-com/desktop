/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Notification, type NotificationBroadcast, NotificationPost } from "@noldova/desktop.protocol";

import type { IMainProcessLog } from "../interfaces/i-main-process-log.js";
import type { INotificationHost } from "../interfaces/i-notification-host.js";
import type { ISystemNotification } from "../interfaces/i-system-notification.js";
import { Resources } from "../resources.js";

export class SystemNotifier {
  private readonly host: INotificationHost;
  private readonly log: IMainProcessLog;
  private readonly readIcon: () => string;
  private readonly isAnyWindowFocused: () => boolean;
  private readonly open: (id: string) => void;
  private readonly shown: Map<string, { sequence: number; notification: ISystemNotification }> = new Map();
  private start: { device: string; highestSequence: number } | undefined;
  private pending: NotificationBroadcast | undefined;
  private isHeld: boolean = false;
  private epochValue: number = 0;
  private hasFailed: boolean = false;

  public constructor(host: INotificationHost, log: IMainProcessLog, readIcon: () => string, isAnyWindowFocused: () => boolean, open: (id: string) => void) {
    this.host = host;
    this.log = log;
    this.readIcon = readIcon;
    this.isAnyWindowFocused = isAnyWindowFocused;
    this.open = open;
    this.start = undefined;
    this.pending = undefined;
  }

  public get epoch(): number {
    return this.epochValue;
  }

  public reset(): void {
    this.start = undefined;
    this.pending = undefined;
    for (const entry of [...this.shown.values()])
      entry.notification.close();
    this.shown.clear();
    this.epochValue++;
  }

  public hold(): void {
    this.isHeld = true;
    this.epochValue++;
  }

  public begin(epoch: number, device: string, sequence: number): void {
    if (epoch !== this.epochValue)
      return;
    this.start = { device, highestSequence: Math.max(sequence, this.start?.highestSequence ?? 0) };
    this.isHeld = false;
    const pending = this.pending;
    this.pending = undefined;
    if (!Object.isUndefined(pending))
      this.receive(pending);
  }

  public receive(broadcast: NotificationBroadcast): void {
    for (const [id, entry] of [...this.shown])
      if (!broadcast.notifications.some(t => t.id === id && t.sequence === entry.sequence)) {
        this.shown.delete(id);
        entry.notification.close();
      }
    const start = this.start;
    if (Object.isUndefined(start) || this.isHeld) {
      this.pending = broadcast;
      return;
    }
    const highest = start.highestSequence;
    start.highestSequence = Math.max(highest, ...broadcast.notifications.map(t => t.sequence));
    if (broadcast.quietDevices.includes(start.device) || this.isAnyWindowFocused() || !this.host.isSupported())
      return;
    for (const notification of [...broadcast.notifications].reverse().filter(t => !broadcast.mutedModules.includes(t.post.kind.owner)))
      if (notification.sequence > highest && !SystemNotifier.isInProgress(notification))
        this.show(notification);
  }

  private static isInProgress(notification: Notification): boolean {
    const progress = notification.post.progress;
    return progress === NotificationPost.indeterminate || (Object.isNumber(progress) && progress < 1);
  }

  private show(notification: Notification): void {
    const shown = this.host.create({ title: notification.post.title, body: notification.post.text ?? String.empty, icon: this.readIcon() });
    const entry = { sequence: notification.sequence, notification: shown };
    shown.on(Resources.clickEvent, () => {
      this.forget(notification.id, entry);
      this.open(notification.id);
    });
    shown.on(Resources.closeEvent, () => this.forget(notification.id, entry));
    shown.on(Resources.failedEvent, (_event, error) => {
      this.forget(notification.id, entry);
      if (this.hasFailed)
        return;
      this.hasFailed = true;
      this.log.write(Resources.formatSystemNotificationFailed(error));
    });
    this.shown.set(notification.id, entry);
    shown.show();
  }

  private forget(id: string, entry: { sequence: number; notification: ISystemNotification }): void {
    if (this.shown.get(id) === entry)
      this.shown.delete(id);
  }
}
