/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { OctalEscapeService } from "@noldova/context.text";

import { Resources } from "../resources.js";
import { SystemErrorCode } from "./system-error-code.js";

export class AppImageSource {
  public readonly file: string;
  public readonly folder: string;

  private constructor(file: string, folder: string) {
    this.file = file;
    this.folder = folder;
  }

  public async isMountedAsync(): Promise<boolean> {
    const mountPoints = (await AppImageSource.readMountTableAsync()).split(Resources.lineEnd)
      .map(t => t.split(Resources.mountTableFieldSeparator)[Resources.mountPointField] ?? String.empty)
      .map(t => OctalEscapeService.decode(t));
    return mountPoints.includes(this.folder);
  }

  public static find(environment: NodeJS.ProcessEnv, executablePath: string): AppImageSource | null {
    const file = environment[Resources.appImageVariable] ?? String.empty;
    const folder = path.posix.normalize(environment[Resources.appImageFolderVariable] ?? String.empty).replace(Resources.trailingSlashes, String.empty);
    if (!path.posix.isAbsolute(file) || !path.posix.isAbsolute(folder))
      return null;
    const relative = path.posix.relative(folder, executablePath);
    return relative.length === 0 || relative === Resources.parentFolder || relative.startsWith(Resources.formatFolderPrefix(Resources.parentFolder)) ? null : new AppImageSource(file, folder);
  }

  public static locateProgram(environment: NodeJS.ProcessEnv, executablePath: string): string {
    return AppImageSource.find(environment, executablePath)?.file ?? executablePath;
  }

  private static async readMountTableAsync(): Promise<string> {
    try {
      return await readFile(Resources.mountTableFile, Resources.utf8Encoding);
    }
    catch (error) {
      if (SystemErrorCode.is(error, Resources.missingFileErrorCode))
        return String.empty;
      throw error;
    }
  }
}
