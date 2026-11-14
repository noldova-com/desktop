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
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class ReleaseSettings {

  public static async readAsync(root: string, invalid: string): Promise<JsonReader> {
    const settings = await ReleaseSettings.inspectAsync(root, invalid);
    if (settings instanceof BuildException)
      throw settings;
    return settings;
  }

  public static async inspectAsync(root: string, invalid: string): Promise<JsonReader | BuildException> {
    try {
      return JsonReader.parse(await readFile(path.join(root, Resources.packageManifestFileName), Resources.textEncoding)).readObject(Resources.manifestDesktopField);
    }
    catch (error) {
      return new BuildException(invalid, new ExceptionOptions(error));
    }
  }
}
