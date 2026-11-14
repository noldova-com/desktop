/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyChord } from "@noldova/desktop.protocol";

import type { INotificationHost } from "../interfaces/i-notification-host.js";
import type { ISystemNotification } from "../interfaces/i-system-notification.js";
import { Resources } from "../resources.js";
import type { AppIcons } from "./app-icons.js";

export class TrayNotices {
  private readonly notifications: INotificationHost;
  private readonly platform: string;
  private readonly icons: AppIcons;
  private readonly reopen: () => void;
  private readonly log: (text: string) => void;
  private closeHint: ISystemNotification | undefined;
  private stopKeyNotice: ISystemNotification | undefined;

  public constructor(notifications: INotificationHost, platform: string, icons: AppIcons, reopen: () => void, log: (text: string) => void) {
    this.notifications = notifications;
    this.platform = platform;
    this.icons = icons;
    this.reopen = reopen;
    this.log = log;
    this.closeHint = undefined;
    this.stopKeyNotice = undefined;
  }

  public showCloseHintAsync(): Promise<boolean> {
    if (!this.notifications.isSupported())
      return Promise.resolve(false);
    const shown = Promise.withResolvers<boolean>();
    const hint = this.notifications.create({ title: Resources.trayCloseHintTitle, body: Resources.formatTrayCloseHintBody(this.platform), icon: this.icons.window, silent: true });
    const release = (): void => {
      if (this.closeHint === hint)
        this.closeHint = undefined;
    };
    hint.on(Resources.showEvent, () => shown.resolve(true));
    hint.on(Resources.clickEvent, () => {
      release();
      this.reopen();
    });
    hint.on(Resources.closeEvent, release);
    hint.on(Resources.failedEvent, (_event, error) => {
      release();
      this.log(Resources.formatTrayCloseHintFailed(error));
      shown.resolve(false);
    });
    this.closeHint = hint;
    hint.show();
    return shown.promise;
  }

  public showStopKeyNotice(key: KeyChord): void {
    if (!this.notifications.isSupported())
      return;
    const notice = this.notifications.create({ title: Resources.stopKeyRefusedTitle, body: Resources.formatStopKeyRefusedBody(key.label(this.platform), this.platform),
      icon: this.icons.window, silent: true });
    const release = (): void => {
      if (this.stopKeyNotice === notice)
        this.stopKeyNotice = undefined;
    };
    notice.on(Resources.clickEvent, () => {
      release();
      this.reopen();
    });
    notice.on(Resources.closeEvent, release);
    notice.on(Resources.failedEvent, (_event, error) => {
      release();
      this.log(Resources.formatStopKeyNoticeFailed(error));
    });
    this.stopKeyNotice = notice;
    notice.show();
  }

  public close(): void {
    this.closeHint?.close();
    this.stopKeyNotice?.close();
  }
}
