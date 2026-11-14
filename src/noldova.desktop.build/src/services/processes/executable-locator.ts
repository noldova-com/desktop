/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

import "@noldova/context.core";

import { FileErrors } from "../files/file-errors.ts";
import { Resources } from "../../resources.ts";

export class ExecutableLocator {
  public static locate(name: string, platform: string = process.platform, searchPath: string = process.env[Resources.pathVariable] ?? String.empty): string {
    if (platform === Resources.windowsPlatform)
      return name;
    for (const directory of searchPath.split(path.delimiter)) {
      const candidate = path.join(directory, name);
      if (path.isAbsolute(directory) && ExecutableLocator.isExecutableFile(candidate))
        return candidate;
    }
    return name;
  }

  private static isExecutableFile(candidate: string): boolean {
    try {
      accessSync(candidate, constants.X_OK);
      return statSync(candidate).isFile();
    }
    catch (error) {
      if (!FileErrors.isUnreachable(error))
        throw error;
      return false;
    }
  }
}
