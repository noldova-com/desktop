/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileShareResolve, ShellMethods } from "@noldova/desktop.protocol";

import type { IMainProcessOptions } from "../interfaces/i-main-process-options.js";
import type { KnownDevice } from "../models/known-device.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import { ClipboardCopier } from "./clipboard-copier.js";
import { CommandInstaller } from "./command-installer.js";
import { FileDialogs } from "./file-dialogs.js";
import { FileGrantIssuer } from "./file-grant-issuer.js";
import type { RuntimeCaller } from "./runtime-caller.js";
import { SecretAnswerer } from "./secret-answerer.js";
import { SharedFileServer } from "./shared-file-server.js";
import { ShellOpener } from "./shell-opener.js";

export class MainProcessServices {
  public readonly sharedFiles: SharedFileServer;
  public readonly clipboard: ClipboardCopier;
  public readonly shellOpener: ShellOpener;
  public readonly fileDialogs: FileDialogs;
  public readonly commandInstaller: CommandInstaller;
  public readonly secrets: SecretAnswerer;

  public constructor(options: IMainProcessOptions, windows: WindowRegistry, runtime: RuntimeCaller, device: KnownDevice) {
    const { electron, process, dataDirectory, log } = options;
    this.sharedFiles = new SharedFileServer(t => runtime.callAsync(ShellMethods.resolveFileShare, new FileShareResolve(t).toJson()),
      (window, page) => windows.findPage(window)?.serial === page, t => log.write(t));
    this.clipboard = new ClipboardCopier(electron.clipboard, process.homeFolder, dataDirectory.root, t => log.write(t));
    this.shellOpener = new ShellOpener(electron.shell, process.platform, process.files, dataDirectory.logsFolder, t => log.write(t));
    this.fileDialogs = new FileDialogs(electron.dialog, windows,
      new FileGrantIssuer(dataDirectory.stagedFolder, process.platform, process.files, t => runtime.callAsync(ShellMethods.grantFile, t.toJson())), runtime,
      () => electron.app.getPath(Resources.downloadsPath), t => log.write(t));
    this.commandInstaller = new CommandInstaller(electron.dialog, process.platform, process.execPath, t => options.createPathCommand(t), t => log.write(t));
    this.secrets = new SecretAnswerer(electron.safeStorage, process.platform, () => device.readAsync(), runtime, t => log.write(t));
  }
}
