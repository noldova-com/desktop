/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { MenuItemConstructorOptions } from "electron";

import { type Notification, QualifiedName } from "@noldova/desktop.protocol";
import type { ProductTrayItem } from "@noldova/desktop.runtime";

import type { ITrayActions } from "../interfaces/i-tray-actions.js";
import type { ITrayHost } from "../interfaces/i-tray-host.js";
import { Resources } from "../resources.js";

export class TrayMenuTemplate {
  private static readonly SEPARATOR: MenuItemConstructorOptions = { type: Resources.separatorMenuType };

  private readonly items: readonly ProductTrayItem[];
  private readonly host: ITrayHost;
  private readonly actions: ITrayActions;

  public constructor(items: readonly ProductTrayItem[], host: ITrayHost, actions: ITrayActions) {
    this.items = items;
    this.host = host;
    this.actions = actions;
  }

  public get claimsStopKey(): boolean {
    return this.items.some(t => t.item === Resources.trayAgentsItem);
  }

  public build(work: readonly string[], unread: readonly Notification[], isDoNotDisturb: boolean, isStopped: boolean | null, refusedKey: string | null, readyVersion: string | null,
    isDark: boolean): MenuItemConstructorOptions[] {
    const update: MenuItemConstructorOptions[] = Object.isNull(readyVersion)
      ? []
      : [{ label: TrayMenuTemplate.labelOf(Resources.formatRestartToUpdateLabel(readyVersion)), click: () => this.actions.restartToUpdate() }, TrayMenuTemplate.SEPARATOR];
    const rows = this.items.flatMap(t => this.rowsOf(t, work, unread, isDoNotDisturb, isStopped, refusedKey).map(u => this.withIcon(u, t, isDark)));
    return TrayMenuTemplate.collapse([...update, ...rows]);
  }

  private rowsOf(entry: ProductTrayItem, work: readonly string[], unread: readonly Notification[], isDoNotDisturb: boolean, isStopped: boolean | null,
    refusedKey: string | null): MenuItemConstructorOptions[] {
    if (entry.isSeparator)
      return [TrayMenuTemplate.SEPARATOR];
    const command = Object.isNull(entry.command) ? null : QualifiedName.find(entry.command);
    if (!Object.isNull(command))
      return [{ label: TrayMenuTemplate.labelOf(entry.text ?? command.text), click: () => this.actions.runCommand(command) }];
    switch (entry.item) {
      case Resources.trayWorkItem:
        return TrayMenuTemplate.workRows(work, entry.text);
      case Resources.trayNotificationsItem:
        return unread.slice(0, Resources.trayNotificationRows).map(t => ({ label: TrayMenuTemplate.labelOf(t.post.title), click: () => this.actions.openNotification(t.id) }));
      case Resources.trayAgentsItem:
        return [isStopped === true
          ? { label: TrayMenuTemplate.labelOf(entry.toggledText ?? Resources.resumeAgentsLabel), click: () => this.actions.resumeAgents() }
          : { label: Resources.formatStopAgentsLabel(TrayMenuTemplate.labelOf(entry.text ?? Resources.stopAgentsLabel), refusedKey), enabled: isStopped === false,
            click: () => this.actions.stopAgents() }];
      case Resources.trayOpenItem:
        return [{ label: TrayMenuTemplate.labelOf(entry.text ?? Resources.openApplicationLabel), click: () => this.actions.open() }];
      case Resources.trayDoNotDisturbItem:
        return [{ label: TrayMenuTemplate.labelOf(isDoNotDisturb ? entry.toggledText ?? Resources.turnOffDoNotDisturbLabel : entry.text ?? Resources.turnOnDoNotDisturbLabel),
          click: () => this.actions.setDoNotDisturb(!isDoNotDisturb) }];
      case Resources.trayQuitItem:
        return [{ label: TrayMenuTemplate.labelOf(entry.text ?? Resources.quitApplicationLabel), click: () => this.actions.quit() }];
      default:
        return [];
    }
  }

  private withIcon(row: MenuItemConstructorOptions, entry: ProductTrayItem, isDark: boolean): MenuItemConstructorOptions {
    const dark = isDark ? entry.iconDark : null;
    const icon = dark ?? entry.icon;
    if (row === TrayMenuTemplate.SEPARATOR || Object.isNull(icon))
      return row;
    return { ...row, icon: this.host.createMenuIcon(icon, Object.isNull(dark) && entry.isTemplate) };
  }

  private static workRows(work: readonly string[], text: string | null): MenuItemConstructorOptions[] {
    if (work.length === 0)
      return [{ label: TrayMenuTemplate.labelOf(text ?? Resources.noWorkLabel), enabled: false }];
    const rows: MenuItemConstructorOptions[] = work.slice(0, Resources.trayWorkRows).map(t => ({ label: TrayMenuTemplate.labelOf(t), enabled: false }));
    return work.length > Resources.trayWorkRows ? [...rows, { label: Resources.formatMoreWork(work.length - Resources.trayWorkRows), enabled: false }] : rows;
  }

  private static collapse(rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    const kept: MenuItemConstructorOptions[] = [];
    for (const row of rows)
      if (row !== TrayMenuTemplate.SEPARATOR || (kept.length > 0 && kept[kept.length - 1] !== TrayMenuTemplate.SEPARATOR))
        kept.push(row);
    if (kept[kept.length - 1] === TrayMenuTemplate.SEPARATOR)
      kept.pop();
    return kept;
  }

  private static labelOf(text: string): string {
    const line = text.replace(Resources.trayLabelSpacesPattern, Resources.trayLabelSpace).trim();
    const short = line.length > Resources.trayLabelLimit ? `${line.slice(0, Resources.trayLabelLimit - 1).trimEnd()}${Resources.trayEllipsis}` : line;
    return short.replaceAll(Resources.mnemonicMarker, Resources.escapedMnemonicMarker);
  }
}
