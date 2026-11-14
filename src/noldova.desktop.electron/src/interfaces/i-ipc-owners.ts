/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateStatus } from "../models/update-status.js";
import type { AppSurfaceFeed } from "../services/app-surface-feed.js";
import type { AppearanceKeeper } from "../services/appearance-keeper.js";
import type { ClipboardCopier } from "../services/clipboard-copier.js";
import type { CommandInstaller } from "../services/command-installer.js";
import type { FileDialogs } from "../services/file-dialogs.js";
import type { LayoutKeeper } from "../services/layout-keeper.js";
import type { OpenWindow } from "../services/open-window.js";
import type { RuntimeCaller } from "../services/runtime-caller.js";
import type { RuntimeRequests } from "../services/runtime-requests.js";
import type { RuntimeStartup } from "../services/runtime-startup.js";
import type { ShellOpener } from "../services/shell-opener.js";
import type { SpellChecker } from "../services/spell-checker.js";
import type { TrayHostWatcher } from "../services/tray-host-watcher.js";
import type { WebViewHost } from "../services/web-view-host.js";
import type { WindowControls } from "../services/window-controls.js";
import type { WindowTextLog } from "../services/window-text-log.js";

export interface IIpcOwners {
  readonly appearance: AppearanceKeeper;
  readonly spelling: SpellChecker;
  readonly trayHosts: TrayHostWatcher;
  readonly controls: WindowControls;
  readonly textLog: WindowTextLog;
  readonly startup: RuntimeStartup;
  readonly layout: LayoutKeeper;
  readonly requests: RuntimeRequests;
  readonly runtime: RuntimeCaller;
  readonly clipboard: ClipboardCopier;
  readonly shellOpener: ShellOpener;
  readonly fileDialogs: FileDialogs;
  readonly commandInstaller: CommandInstaller;
  readonly surface: AppSurfaceFeed;
  readonly webViews: WebViewHost;

  readUpdate(): UpdateStatus;
  actOnUpdate(action: unknown): boolean;
  answerQuit(open: OpenWindow, choice: unknown): boolean;
}
