/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { TrayIconState } from "../enums/tray-icon-state.js";
import type { IThemeHost } from "../interfaces/i-theme-host.js";
import { Resources } from "../resources.js";

export class AppIcons {
  private readonly folder: string;
  private readonly platform: string;
  private readonly theme: IThemeHost;
  private readonly files: ReadonlySet<string>;

  public constructor(folder: string, platform: string, theme: IThemeHost, files: ReadonlySet<string>) {
    this.folder = folder;
    this.platform = platform;
    this.theme = theme;
    this.files = files;
  }

  public get isMenuDark(): boolean {
    return this.platform !== Resources.macPlatform && this.theme.shouldUseDarkColors;
  }

  public get window(): string {
    return join(this.folder, this.platform === Resources.windowsPlatform ? Resources.windowsIcon : Resources.windowIcon);
  }

  public get themedWindow(): string {
    return this.themed(this.window, join(this.folder, this.platform === Resources.windowsPlatform ? Resources.lightWindowsIcon : Resources.lightWindowIcon));
  }

  public get dock(): string {
    return join(this.folder, Resources.dockIcon);
  }

  public static async locateAsync(folder: string, platform: string, theme: IThemeHost): Promise<AppIcons> {
    const lists = await Promise.all([folder, join(folder, Resources.trayFolder)].map(async t => (await readdir(t).catch(() => [])).map(u => join(t, u))));
    return new AppIcons(folder, platform, theme, new Set(lists.flat()));
  }

  public tray(state: TrayIconState): string {
    const name = join(this.folder, Resources.trayFolder, `${Resources.trayIconPrefix}${state.toLowerCase()}`);
    const extension = this.platform === Resources.macPlatform ? null : this.platform === Resources.windowsPlatform ? Resources.trayWindowsExtension : Resources.trayLinuxExtension;
    const dark = Object.isNull(extension) ? `${name}${Resources.trayMacSuffix}` : `${name}${extension}`;
    if (state === TrayIconState.Update && !this.files.has(dark))
      return this.tray(TrayIconState.Unread);
    return Object.isNull(extension) ? dark : this.themed(dark, `${name}${Resources.lightIconSuffix}${extension}`);
  }

  private themed(dark: string, light: string): string {
    const isDark = this.platform === Resources.windowsPlatform ? this.theme.shouldUseDarkColorsForSystemIntegratedUI : this.theme.shouldUseDarkColors;
    return isDark || !this.files.has(light) ? dark : light;
  }
}
