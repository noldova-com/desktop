/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FileGrantsEnded, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { IIpcHost } from "../interfaces/i-ipc-host.js";
import type { IIpcOwners } from "../interfaces/i-ipc-owners.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";

export class IpcRouter {
  private readonly ipc: IIpcHost;
  private readonly windows: WindowRegistry;
  private readonly owners: IIpcOwners;

  public constructor(ipc: IIpcHost, windows: WindowRegistry, owners: IIpcOwners) {
    this.ipc = ipc;
    this.windows = windows;
    this.owners = owners;
  }

  public listen(): void {
    const ipc = this.ipc;
    const owners = this.owners;
    ipc.on(Resources.readyChannel, (event, appearance) => owners.appearance.show(this.findTrusted(event), appearance));
    ipc.on(Resources.appearanceChannel, (event, appearance) => owners.appearance.repaint(this.findTrusted(event), appearance));
    ipc.on(Resources.keepAppearanceChannel, (event, preferences) => owners.appearance.keep(this.findTrusted(event), preferences));
    ipc.handle(Resources.readSpellingChannel, event => Object.isNull(this.findTrusted(event)) ? null : owners.spelling.toJson());
    ipc.handle(Resources.readTrayAvailableChannel, event => Object.isNull(this.findTrusted(event)) ? null : owners.trayHosts.isAvailable);
    ipc.handle(Resources.readFullScreenChannel, event => this.findTrusted(event)?.window.isFullScreen() ?? null);
    ipc.handle(Resources.readMaximizedChannel, event => this.findTrusted(event)?.window.isMaximized() ?? null);
    ipc.handle(Resources.windowActionChannel, (event, action) => owners.controls.actOnWindow(this.findTrusted(event), action));
    ipc.on(Resources.spellingChannel, (event, isChecking, languages) => owners.controls.keepSpelling(this.findTrusted(event), isChecking, languages));
    ipc.handle(Resources.replaceMisspellingChannel, (event, text) => owners.controls.replaceMisspelling(this.findTrusted(event), text));
    ipc.handle(Resources.addToDictionaryChannel, (event, word) => owners.controls.addToDictionary(this.findTrusted(event), word));
    ipc.on(Resources.menuBarChannel, (event, menuBar) => owners.controls.showMenuBar(this.findTrusted(event), event.sender.id, menuBar));
    ipc.on(Resources.appShortcutsChannel, (event, shortcuts) => this.receiveAppShortcuts(event, shortcuts));
    ipc.handle(Resources.closeAnswerChannel, (event, requestId, isSaved) => this.findTrusted(event)?.coordinator.answer(requestId, isSaved) ?? false);
    ipc.handle(Resources.updateSaveAnswerChannel, (event, requestId, problems) => this.findTrusted(event)?.updateSaves.answer(requestId, problems) ?? false);
    ipc.handle(Resources.quitAnswerChannel, (event, choice) => this.answerQuit(event, choice));
    ipc.on(Resources.moduleLogChannel, (event, moduleId, message) => owners.textLog.writeModuleLog(this.findTrusted(event), moduleId, message));
    ipc.on(Resources.windowErrorChannel, (event, moduleId, text) => owners.textLog.writeWindowError(this.findTrusted(event), moduleId, text));
    ipc.handle(Resources.readStartupChannel, event => Object.isNull(this.findTrusted(event)) ? null : owners.startup.current.toJson());
    ipc.handle(Resources.startupActionChannel, (event, action) => Object.isNull(this.findTrusted(event)) ? false : owners.startup.actAsync(action));
    ipc.handle(Resources.readLayoutChannel, event => owners.layout.readAsync(event));
    ipc.on(Resources.pageChannel, (event, page) => this.startPage(event, page));
    ipc.handle(Resources.requestChannel, (event, method, payload, page) => owners.requests.requestAsync(event, method, payload, page));
    ipc.handle(Resources.writeLayoutChannel, (event, layout) => owners.layout.writeAsync(event, layout));
    ipc.handle(Resources.readBuildChannel, event => Object.isNull(this.findTrusted(event)) ? null : RuntimeBuild.identity.toJson());
    ipc.handle(Resources.copyTextChannel, (event, text) => owners.clipboard.copyTextFrom(this.findTrusted(event), text));
    ipc.handle(Resources.copyImageChannel, (event, bytes) => owners.clipboard.copyImageAsync(this.findTrusted(event), bytes));
    ipc.handle(Resources.openLogFolderChannel, event => Object.isNull(this.findTrusted(event)) ? false : owners.shellOpener.openLogFolderAsync());
    ipc.handle(Resources.copyDetailsChannel, (event, text) => owners.clipboard.copyDetailsFrom(this.findTrusted(event), text));
    ipc.handle(Resources.openLinkChannel, (event, url) => owners.shellOpener.openLinkAsync(this.findTrusted(event), url));
    ipc.handle(Resources.showInFolderChannel, (event, file) => owners.shellOpener.showInFolderAsync(this.findTrusted(event), file));
    ipc.handle(Resources.openFileChannel, (event, file) => owners.shellOpener.openFileAsync(this.findTrusted(event), file));
    ipc.handle(Resources.chooseFolderChannel, event => owners.fileDialogs.chooseFolderAsync(event));
    ipc.handle(Resources.chooseFilePathChannel, (event, options) => owners.fileDialogs.chooseFilePathAsync(event, options));
    ipc.handle(Resources.saveFileChannel, (event, name, bytes) => owners.fileDialogs.saveFileAsync(event, name, bytes));
    ipc.handle(Resources.chooseFilesChannel, (event, module, options, page) => owners.fileDialogs.chooseFilesAsync(event, module, options, page));
    ipc.handle(Resources.grantFilesChannel, (event, module, files, options, page) => owners.fileDialogs.grantFilesAsync(event, module, files, options, page));
    ipc.handle(Resources.installCommandChannel, event => owners.commandInstaller.installAsync(this.findTrusted(event)));
    ipc.handle(Resources.readUpdateChannel, event => Object.isNull(this.findTrusted(event)) ? null : owners.readUpdate().toJson());
    ipc.handle(Resources.updateActionChannel, (event, action) => !Object.isNull(this.findTrusted(event)) && owners.actOnUpdate(action));
    ipc.handle(Resources.editChannel, (event, action) => owners.controls.edit(this.findTrusted(event), action));
    this.listenToWebViews();
  }

  private listenToWebViews(): void {
    const ipc = this.ipc;
    const views = this.owners.webViews;
    ipc.handle(Resources.webViewOpenChannel, (event, module, pane, profileKey) => this.onWebView(event, null, t => views.openAsync(t, module, pane, profileKey)));
    ipc.handle(Resources.webViewAttachChannel, (event, module, view, contentsId) => this.onWebView(event, null, t => views.attachAsync(t, module, view, contentsId)));
    ipc.handle(Resources.webViewNavigateChannel, (event, module, view, url) => this.onWebView(event, null, t => views.navigateAsync(t, module, view, url)));
    ipc.handle(Resources.webViewActChannel, (event, module, view, action) => this.onWebView(event, null, t => views.actAsync(t, module, view, action)));
    ipc.handle(Resources.webViewZoomChannel, (event, module, view, change) => this.onWebView(event, null, t => views.zoom(t, module, view, change)));
    ipc.handle(Resources.webViewFindChannel, (event, module, view, request) => this.onWebView(event, null, t => views.findAsync(t, module, view, request)));
    ipc.on(Resources.webViewCloseChannel, (event, module, view) => this.onWebView(event, false, t => views.close(t, module, view)));
    ipc.on(Resources.webViewShortcutsChannel, (event, keys) => this.onWebView(event, false, t => views.setShortcuts(t, keys)));
  }

  private onWebView(event: IIpcEvent, refused: unknown, run: (windowId: number) => unknown): unknown {
    return Object.isNull(this.findTrusted(event)) ? refused : run(event.sender.id);
  }

  private receiveAppShortcuts(event: IIpcEvent, shortcuts: unknown): void {
    if (!Object.isNull(this.findTrusted(event)))
      this.owners.surface.receiveShortcuts(event.sender.id, shortcuts);
  }

  private answerQuit(event: IIpcEvent, choice: unknown): boolean {
    const open = this.findTrusted(event);
    return !Object.isNull(open) && this.owners.answerQuit(open, choice);
  }

  private startPage(event: IIpcEvent, page: unknown): void {
    if (Object.isNull(this.findTrusted(event)) || !Object.isString(page) || page.length === 0)
      return;
    const contentsId = event.sender.id;
    const ended = this.windows.startPage(contentsId, page);
    if (!Object.isNull(ended))
      void this.owners.runtime.callAsync(ShellMethods.endFileGrants, new FileGrantsEnded(contentsId, ended.serial).toJson());
  }

  private findTrusted(event: IIpcEvent): OpenWindow | null {
    return this.windows.findTrusted(event);
  }
}
