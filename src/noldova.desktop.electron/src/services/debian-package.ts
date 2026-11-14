/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class DebianPackage {
  public static isInstalled(platform: string, executablePath: string): boolean {
    if (platform !== Resources.linuxPlatform)
      return false;
    try {
      return readFileSync(path.join(path.dirname(executablePath), Resources.packagedResourcesFolder, Resources.packageTypeFile), Resources.textEncoding).trim() === Resources.debianPackageType;
    }
    catch {
      return false;
    }
  }
}
