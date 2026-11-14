/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { type PlatformPath, posix, win32 } from "node:path";

import type { ICheckedPath } from "../interfaces/i-checked-path.js";
import type { IShownPathFiles } from "../interfaces/i-shown-path-files.js";
import type { IShownPathStatus } from "../interfaces/i-shown-path-status.js";
import type { ISplitPath } from "../interfaces/i-split-path.js";
import { ErrorCode } from "../models/error-code.js";
import { Resources } from "../resources.js";

export class ShownFilePolicy {
  public static async checkAsync(file: string, platform: string, files: IShownPathFiles): Promise<ICheckedPath> {
    const refusal = ShownFilePolicy.findPathRefusal(file, platform, Resources.shownFileNotAbsolute);
    if (!Object.isNull(refusal))
      return { path: file, refusal };
    const found = await ShownFilePolicy.findTargetAsync(file, platform, files);
    if (Object.isNull(found))
      return { path: file, refusal: Resources.shownFileMissing };
    if (Object.isNull(found.status))
      return { path: found.path, refusal: Resources.shownFileLinkElsewhere };
    return { path: found.path, refusal: found.status.isFile() || found.status.isDirectory() ? null : Resources.shownFileNotRegular };
  }

  public static findPathRefusal(file: string, platform: string, notAbsolute: string): string | null {
    if (file.includes(Resources.nullCharacter))
      return Resources.shownFileNotText;
    return (platform === Resources.windowsPlatform ? Resources.windowsDrivePathPattern.test(file) : posix.isAbsolute(file)) ? null : notAbsolute;
  }

  public static async findTargetAsync(file: string, platform: string, files: IShownPathFiles): Promise<{ readonly path: string; readonly status: IShownPathStatus | null } | null> {
    const paths = platform === Resources.windowsPlatform ? win32 : posix;
    const start = ShownFilePolicy.split(paths === win32 ? win32.normalize(file) : file, paths);
    let resolved = start.root;
    let parts = [...start.parts];
    let found = await ShownFilePolicy.readAsync(files, resolved);
    let links = 0;
    while (!Object.isNull(found) && parts.length > 0) {
      const part = String(parts.shift());
      if (part === Resources.currentFolderName)
        continue;
      if (part === Resources.parentFolderName) {
        resolved = paths.dirname(resolved);
        found = await ShownFilePolicy.readAsync(files, resolved);
        continue;
      }
      const next = paths.join(resolved, part);
      const status = await ShownFilePolicy.readAsync(files, next);
      if (Object.isNull(status) || !status.isSymbolicLink()) {
        resolved = next;
        found = status;
        continue;
      }
      links += 1;
      const link = links > Resources.followedLinkLimit ? null : await ShownFilePolicy.readLinkAsync(files, next);
      if (Object.isNull(link))
        return null;
      const target = paths.isAbsolute(link) ? link : paths.join(resolved, link);
      if (!Object.isNull(ShownFilePolicy.findPathRefusal(target, platform, Resources.shownFileLinkElsewhere)))
        return { path: target, status: null };
      const split = ShownFilePolicy.split(paths === win32 ? win32.normalize(target) : link, paths);
      if (split.root.length > 0)
        resolved = split.root;
      parts = [...split.parts, ...parts];
      found = await ShownFilePolicy.readAsync(files, resolved);
    }
    return Object.isNull(found) ? null : { path: resolved, status: found };
  }

  private static async readAsync(files: IShownPathFiles, path: string): Promise<IShownPathStatus | null> {
    try {
      return await files.lstat(path);
    }
    catch (error) {
      return ShownFilePolicy.unlessUnreadable(error);
    }
  }

  private static async readLinkAsync(files: IShownPathFiles, link: string): Promise<string | null> {
    try {
      return await files.readlink(link);
    }
    catch (error) {
      return ShownFilePolicy.unlessUnreadable(error);
    }
  }

  private static unlessUnreadable(error: unknown): null {
    if (!ErrorCode.isOneOf(error, Resources.unreadablePathCodes))
      throw error;
    return null;
  }

  private static split(file: string, paths: PlatformPath): ISplitPath {
    const root = paths.parse(file).root;
    const separators = paths === win32 ? Resources.windowsPathSeparators : Resources.posixPathSeparators;
    const parts = separators.reduce<string[]>((found, separator) => found.flatMap(t => t.split(separator)), [file.slice(root.length)]);
    return { root, parts: parts.filter(t => t.length > 0) };
  }
}
