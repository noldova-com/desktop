/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFolderProtector } from "../../interfaces/i-folder-protector.js";
import type { IPosixProcessAddon } from "../../interfaces/i-posix-process-addon.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import { NativeAddon } from "../native/native-addon.js";
import { MacFolderProtector } from "./mac-folder-protector.js";
import { PosixFolderProtector } from "./posix-folder-protector.js";
import { WindowsFolderProtector } from "./windows-folder-protector.js";

export class FolderProtectorFactory {
  public static create(platform: string, command: SystemCommand, environment: NodeJS.ProcessEnv): IFolderProtector {
    if (platform === Resources.windowsPlatform)
      return new WindowsFolderProtector(command, environment);
    if (platform !== Resources.macPlatform)
      return new PosixFolderProtector();
    return new MacFolderProtector(command, new NativeAddon<IPosixProcessAddon>(NativeAddon.locate(Resources.posixAddonFile), [Resources.readVolumeFunction]));
  }
}
