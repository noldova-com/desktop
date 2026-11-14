/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions } from "electron";

import type { IElectron, ISessionHost } from "@noldova/desktop.electron";

import { FakeApplicationHost } from "./fake-application-host.fixture.js";
import { FakeClipboardHost } from "./fake-clipboard-host.fixture.js";
import { FakeMainProcessWindow } from "./fake-main-process-window.fixture.js";
import { FakeDialogHost } from "./fake-dialog-host.fixture.js";
import { FakeDisplayHost } from "./fake-display-host.fixture.js";
import { FakeIpcHost } from "./fake-ipc-host.fixture.js";
import { FakeMenuHost } from "./fake-menu-host.fixture.js";
import { FakeNativeUpdater } from "./fake-native-updater.fixture.js";
import { FakeNotificationHost } from "./fake-notification-host.fixture.js";
import { FakeSchemeRegistry } from "./fake-scheme-registry.fixture.js";
import { FakeSecretStorageHost } from "./fake-secret-storage-host.fixture.js";
import { FakeSession } from "./fake-session.fixture.js";
import { FakeShellHost } from "./fake-shell-host.fixture.js";
import { FakeShortcutHost } from "./fake-shortcut-host.fixture.js";
import { FakeThemeHost } from "./fake-theme-host.fixture.js";
import { FakeTrayHost } from "./fake-tray-host.fixture.js";
import { FakeWebViewEngine } from "./fake-web-view-engine.fixture.js";
import { FakeWindowSession } from "./fake-window-session.fixture.js";

export class FakeElectron implements IElectron {
  public readonly app: FakeApplicationHost;
  public readonly ipcMain: FakeIpcHost = new FakeIpcHost();
  public readonly defaultSession: FakeSession = new FakeSession();
  public readonly session: ISessionHost = { defaultSession: this.defaultSession };
  public readonly protocol: FakeSchemeRegistry = new FakeSchemeRegistry(t => this.app.refuseAfterReady(t));
  public readonly windowSession: FakeWindowSession = new FakeWindowSession();
  public readonly menu: FakeMenuHost = new FakeMenuHost();
  public readonly screen: FakeDisplayHost = new FakeDisplayHost();
  public readonly clipboard: FakeClipboardHost = new FakeClipboardHost();
  public readonly shell: FakeShellHost = new FakeShellHost();
  public readonly dialog: FakeDialogHost = new FakeDialogHost();
  public readonly notifications: FakeNotificationHost = new FakeNotificationHost();
  public readonly theme: FakeThemeHost = new FakeThemeHost();
  public readonly tray: FakeTrayHost = new FakeTrayHost();
  public readonly shortcuts: FakeShortcutHost = new FakeShortcutHost();
  public readonly nativeUpdater: FakeNativeUpdater = new FakeNativeUpdater();
  public readonly webViews: FakeWebViewEngine = new FakeWebViewEngine();
  public readonly safeStorage: FakeSecretStorageHost = new FakeSecretStorageHost();
  public readonly windows: FakeMainProcessWindow[] = [];
  public windowIdOffset: number = 0;

  public constructor(hasLock: boolean = true, isPackaged: boolean = false) {
    this.app = new FakeApplicationHost(hasLock, isPackaged);
    this.nativeUpdater.onInstall = () => {
      for (const window of this.windows)
        window.close();
      if (this.windows.every(t => t.isDestroyed()))
        this.app.quitFully();
    };
  }

  public createWindow(options: BrowserWindowConstructorOptions): FakeMainProcessWindow {
    const window = new FakeMainProcessWindow(options, this.windows.length + 1, this.windowSession, this.windows.length + 1 + this.windowIdOffset);
    this.windows.push(window);
    return window;
  }
}
