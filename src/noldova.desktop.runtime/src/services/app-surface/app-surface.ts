/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { type AppShortcut, AppShortcutList, type AppWindow, AppWindowList, type KeyChord, type MainWindow } from "@noldova/desktop.protocol";

import type { Registration } from "../../models/registration.js";
import { Resources } from "../../resources.js";
import type { ClientClosures } from "../endpoint/client-closures.js";
import { ReportedList } from "./reported-list.js";

export class AppSurface {
  private readonly platform: string;
  private readonly windowList: ReportedList<AppWindowList>;
  private readonly shortcutList: ReportedList<AppShortcutList>;
  private reportedMainWindow: { readonly connection: number; readonly window: MainWindow } | null = null;

  public constructor(closures: ClientClosures, platform: string, diagnostics: Writable) {
    this.platform = platform;
    this.windowList = new ReportedList(new AppWindowList([]), Resources.appWindowsName, diagnostics);
    this.shortcutList = new ReportedList(new AppShortcutList([]), Resources.appShortcutsName, diagnostics);
    closures.listen(t => {
      if (!Object.isNull(t.window))
        return;
      this.windowList.close(t.connection);
      this.shortcutList.close(t.connection);
      if (this.reportedMainWindow?.connection === t.connection)
        this.reportedMainWindow = null;
    });
  }

  public get windows(): readonly AppWindow[] {
    return this.windowList.current.windows;
  }

  public get shortcuts(): readonly AppShortcut[] {
    return this.shortcutList.current.shortcuts;
  }

  public get mainWindow(): MainWindow | null {
    return this.reportedMainWindow?.window ?? null;
  }

  public hasShortcut(key: KeyChord): boolean {
    return this.shortcuts.some(t => t.key.isSameOn(key, this.platform));
  }

  public receiveWindows(connection: number, list: AppWindowList): void {
    this.windowList.receive(connection, list);
  }

  public receiveShortcuts(connection: number, list: AppShortcutList): void {
    this.shortcutList.receive(connection, list);
  }

  public receiveMainWindow(connection: number, window: MainWindow): void {
    this.reportedMainWindow = { connection, window };
  }

  public onWindowsChanged(listener: () => void): Registration {
    return this.windowList.listen(listener);
  }

  public onShortcutsChanged(listener: () => void): Registration {
    return this.shortcutList.listen(listener);
  }
}
