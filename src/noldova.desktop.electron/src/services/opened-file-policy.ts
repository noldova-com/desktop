/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { ICheckedPath } from "../interfaces/i-checked-path.js";
import type { IShownPathFiles } from "../interfaces/i-shown-path-files.js";
import { Resources } from "../resources.js";
import { ShownFilePolicy } from "./shown-file-policy.js";

export class OpenedFilePolicy {
  public static async checkAsync(file: string, platform: string, files: IShownPathFiles): Promise<ICheckedPath> {
    const refusal = ShownFilePolicy.findPathRefusal(file, platform, Resources.openedFileNotAbsolute)
      ?? (OpenedFilePolicy.isListed(file, platform) ? null : Resources.openedFileKindRefused);
    if (!Object.isNull(refusal))
      return { path: file, refusal };
    const found = await ShownFilePolicy.findTargetAsync(file, platform, files);
    if (Object.isNull(found))
      return { path: file, refusal: Resources.shownFileMissing };
    if (Object.isNull(found.status))
      return { path: found.path, refusal: Resources.openedFileLinkElsewhere };
    const target = await files.realpath(found.path).catch(() => null);
    if (Object.isNull(target))
      return { path: found.path, refusal: Resources.shownFileMissing };
    return { path: target, refusal: OpenedFilePolicy.findTargetRefusal(target, platform, found.status.isFile(), found.status.mode) };
  }

  private static findTargetRefusal(target: string, platform: string, isFile: boolean, mode: number): string | null {
    const refusal = ShownFilePolicy.findPathRefusal(target, platform, Resources.openedFileNotAbsolute);
    if (!Object.isNull(refusal))
      return refusal;
    if (!isFile)
      return Resources.openedFileNotRegular;
    if (!OpenedFilePolicy.isListed(target, platform))
      return Resources.openedFileKindRefused;
    return platform !== Resources.windowsPlatform && (mode & Resources.executableModeBits) !== 0 ? Resources.openedFileExecutable : null;
  }

  private static isListed(file: string, platform: string): boolean {
    const separators = platform === Resources.windowsPlatform ? Resources.windowsPathSeparators : Resources.posixPathSeparators;
    const name = file.slice(Math.max(...separators.map(t => file.lastIndexOf(t))) + 1);
    const dot = name.lastIndexOf(Resources.extensionSeparator);
    if (dot <= 0 || (platform === Resources.windowsPlatform && name.includes(Resources.streamSeparator)))
      return false;
    return Resources.openedFileExtensions.has(name.slice(dot).toLowerCase());
  }
}
