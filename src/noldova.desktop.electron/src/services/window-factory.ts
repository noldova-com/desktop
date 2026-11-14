/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions } from "electron";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import type { IMainProcessWindow } from "../interfaces/i-main-process-window.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { MainProcessSettings } from "../models/main-process-settings.js";
import { PreloadSettings } from "../models/preload-settings.js";
import type { TaskbarIdentity } from "../models/taskbar-identity.js";
import type { WindowAppearance } from "../models/window-appearance.js";
import type { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import type { AppIcons } from "./app-icons.js";
import type { SenderPolicy } from "./sender-policy.js";

export class WindowFactory {
  private readonly settings: MainProcessSettings;
  private readonly policy: SenderPolicy;
  private readonly electron: IElectron;
  private readonly taskbar: TaskbarIdentity;
  private readonly icons: AppIcons;
  private readonly log: (text: string) => void;

  public constructor(settings: MainProcessSettings, policy: SenderPolicy, electron: IElectron, taskbar: TaskbarIdentity, icons: AppIcons, log: (text: string) => void) {
    this.settings = settings;
    this.policy = policy;
    this.electron = electron;
    this.taskbar = taskbar;
    this.icons = icons;
    this.log = log;
  }

  public create(state: WindowState, appearance: JsonObject | null): IMainProcessWindow {
    const options: BrowserWindowConstructorOptions = {
      width: state.width,
      height: state.height,
      minWidth: Resources.windowMinimumWidth,
      minHeight: Resources.windowMinimumHeight,
      show: false,
      title: Resources.applicationName,
      titleBarStyle: Resources.hiddenTitleBarStyle,
      webPreferences: {
        preload: this.settings.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        webviewTag: true,
        webSecurity: true,
        spellcheck: true,
        additionalArguments: [new PreloadSettings(appearance).toArgument()]
      }
    };
    if (this.settings.isMac)
      options.trafficLightPosition = { ...Resources.trafficLightPosition };
    else
      options.icon = this.icons.themedWindow;
    if (this.isWindows)
      options.titleBarOverlay = true;
    const window = this.electron.createWindow(options);
    if (this.isWindows)
      window.setAppDetails(this.taskbar.toAppDetails());
    if (!this.settings.isMac)
      this.followTheme(window);
    const contents = window.webContents;
    contents.on(Resources.willNavigateEvent, (event, url) => {
      if (!this.policy.isWindowUrl(url))
        event.preventDefault();
    });
    contents.on(Resources.willRedirectEvent, (event, url) => {
      if (!this.policy.isWindowUrl(url))
        event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: Resources.denyWindowOpen }));
    const file = this.settings.windowIndexPath;
    window.loadFile(file).catch((error: unknown) => this.log(Resources.formatWindowPageNotLoaded(file, String(error))));
    return window;
  }

  public paint(window: IMainProcessWindow, appearance: WindowAppearance): void {
    window.setBackgroundColor(appearance.background);
    if (this.isWindows)
      window.setTitleBarOverlay({ color: appearance.titleBar, symbolColor: appearance.titleBarText, height: appearance.titleBarHeight });
  }

  private get isWindows(): boolean {
    return this.settings.platform === Resources.windowsPlatform;
  }

  private followTheme(window: IMainProcessWindow): void {
    const theme = this.electron.theme;
    const update = (): void => window.setIcon(this.icons.themedWindow);
    theme.on(Resources.themeUpdatedEvent, update);
    window.once(Resources.closedEvent, () => theme.off(Resources.themeUpdatedEvent, update));
  }
}
