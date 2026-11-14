/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class FilePathChoice {
  public readonly extensions: readonly string[];
  public readonly folder: string | null;

  public constructor(extensions: readonly string[], folder: string | null) {
    this.extensions = extensions;
    this.folder = folder;
  }

  public static read(options: unknown): FilePathChoice | null {
    try {
      const reader = JsonReader.fromValue(options);
      const extensions = reader.hasField(Resources.extensionsField) ? FilePathChoice.readExtensions(reader.readStringArray(Resources.extensionsField)) : [];
      const folder = reader.hasField(Resources.folderField) ? reader.readNullableString(Resources.folderField) : null;
      if (Object.isNull(extensions))
        return null;
      if (Object.isNull(folder))
        return new FilePathChoice(extensions, null);
      return !Resources.controlCharacterPattern.test(folder) && path.isAbsolute(folder) ? new FilePathChoice(extensions, folder) : null;
    }
    catch {
      return null;
    }
  }

  private static readExtensions(value: readonly string[]): readonly string[] | null {
    return value.length > 0 && value.length <= Resources.maximumFileExtensions && value.every(t => Resources.fileExtensionPattern.test(t)) ? value : null;
  }
}
