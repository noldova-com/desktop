/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { AgentControlState, Notification, NotificationState, WorkReport } from "@noldova/desktop.protocol";

import { TrayIconState } from "../enums/tray-icon-state.js";
import { UpdateStateKind } from "../enums/update-state-kind.js";
import type { IMenuHost } from "../interfaces/i-menu-host.js";
import type { ITray } from "../interfaces/i-tray.js";
import type { ITrayActions } from "../interfaces/i-tray-actions.js";
import type { ITrayHost } from "../interfaces/i-tray-host.js";
import type { UpdateStatus } from "../models/update-status.js";
import { Resources } from "../resources.js";
import type { AppIcons } from "./app-icons.js";
import { TrayMenuTemplate } from "./tray-menu-template.js";

export class TrayController {
  private readonly host: ITrayHost;
  private readonly menu: IMenuHost;
  private readonly icons: AppIcons;
  private readonly isMac: boolean;
  private readonly actions: ITrayActions;
  private readonly log: (text: string) => void;
  private readonly changeShown: (isShown: boolean) => void;
  private tray: ITray | undefined;
  private isEnabled: boolean = false;
  private isHostAvailable: boolean = false;
  private hasFailed: boolean = false;
  private isDisposed: boolean = false;
  private work: WorkReport | null = null;
  private notifications: NotificationState | undefined;
  private agentControl: AgentControlState | undefined;
  private refusedKey: string | null = null;
  private readyVersion: string | null = null;
  private image: string = String.empty;
  private toolTip: string = String.empty;
  private menuKey: string = String.empty;

  public constructor(
    host: ITrayHost,
    menu: IMenuHost,
    icons: AppIcons,
    platform: string,
    actions: ITrayActions,
    log: (text: string) => void,
    changeShown: (isShown: boolean) => void) {
    this.host = host;
    this.menu = menu;
    this.icons = icons;
    this.isMac = platform === Resources.macPlatform;
    this.actions = actions;
    this.log = log;
    this.changeShown = changeShown;
    this.tray = undefined;
    this.notifications = undefined;
    this.agentControl = undefined;
  }

  public get isShown(): boolean {
    return !Object.isUndefined(this.tray);
  }

  public setEnabled(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
    this.update();
  }

  public setHostAvailable(isAvailable: boolean): void {
    if (isAvailable && !this.isHostAvailable)
      this.hasFailed = false;
    this.isHostAvailable = isAvailable;
    this.update();
  }

  public receiveWork(report: WorkReport): void {
    if (!report.isNewerThan(this.work))
      return;
    this.work = report;
    this.update();
  }

  public receiveNotifications(state: NotificationState): void {
    if (!Object.isUndefined(this.notifications) && state.sequence < this.notifications.sequence)
      return;
    this.notifications = state;
    this.update();
  }

  public receiveAgentControl(state: AgentControlState): void {
    this.agentControl = state;
    this.update();
  }

  public receiveUpdate(status: UpdateStatus): void {
    this.readyVersion = status.kind === UpdateStateKind.Ready ? status.version : null;
    this.update();
  }

  public setRefusedKey(key: string | null): void {
    this.refusedKey = key;
    this.update();
  }

  public clear(): void {
    this.work = null;
    this.notifications = undefined;
    this.agentControl = undefined;
    this.update();
  }

  public followTheme(): void {
    this.update();
  }

  public rebuildMenu(): void {
    this.menuKey = String.empty;
    this.update();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.update();
  }

  private update(): void {
    const wasShown = this.isShown;
    this.refresh();
    if (this.isShown !== wasShown)
      this.changeShown(this.isShown);
  }

  private refresh(): void {
    if (!this.isEnabled || !this.isHostAvailable || this.isDisposed) {
      this.tray?.destroy();
      this.tray = undefined;
      this.image = String.empty;
      this.toolTip = String.empty;
      this.menuKey = String.empty;
      return;
    }
    const work = this.work?.descriptions ?? [];
    const unread = this.unread();
    const isUpdateReady = !Object.isNull(this.readyVersion);
    const image = this.icons.tray(TrayController.stateOf(work.length, unread.length, isUpdateReady));
    const tray = this.show(image);
    if (Object.isUndefined(tray))
      return;
    if (image !== this.image)
      tray.setImage(image);
    this.image = image;
    const toolTip = Resources.formatTrayToolTip(work.length, unread.length, isUpdateReady);
    if (toolTip !== this.toolTip)
      tray.setToolTip(toolTip);
    this.toolTip = toolTip;
    const isDoNotDisturb = this.notifications?.isDoNotDisturb ?? false;
    const isStopped = this.agentControl?.isStopped ?? null;
    const menuKey = JSON.stringify([work, unread.slice(0, Resources.trayNotificationRows).map(t => [t.id, t.post.title]), isDoNotDisturb, isStopped, this.refusedKey, this.readyVersion]);
    if (menuKey !== this.menuKey)
      tray.setContextMenu(this.menu.buildFromTemplate(TrayMenuTemplate.build(work, unread, isDoNotDisturb, isStopped, this.refusedKey, this.readyVersion, this.actions)));
    this.menuKey = menuKey;
  }

  private show(image: string): ITray | undefined {
    if (!Object.isUndefined(this.tray) || this.hasFailed)
      return this.tray;
    try {
      this.tray = this.host.create(image);
    }
    catch (error) {
      this.hasFailed = true;
      this.log(Resources.formatTrayNotShown(String(error)));
      return undefined;
    }
    this.image = image;
    if (!this.isMac)
      this.tray.on(Resources.clickEvent, () => this.actions.open());
    return this.tray;
  }

  private unread(): readonly Notification[] {
    const state = this.notifications;
    return Object.isUndefined(state) ? [] : state.notifications.filter(t => !t.isRead && !state.mutedModules.includes(t.post.kind.owner));
  }

  private static stateOf(running: number, unread: number, isUpdateReady: boolean): TrayIconState {
    if (running > 0)
      return unread > 0 ? TrayIconState.Both : TrayIconState.Running;
    if (isUpdateReady)
      return TrayIconState.Update;
    return unread > 0 ? TrayIconState.Unread : TrayIconState.Idle;
  }
}
