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

export class PackagingSection {
  public static async readAsync<T>(root: string, field: string, shape: string, read: (entry: JsonReader) => T | null): Promise<ReadonlyMap<string, T>> {
    let manifest: JsonReader;
    try {
      manifest = JsonReader.parse(await readFile(path.join(root, Resources.packageManifestFileName), Resources.textEncoding));
    }
    catch (error) {
      throw new BuildException(Resources.rootManifestUnreadable, new ExceptionOptions(error));
    }
    let entries: readonly (readonly [string, T | null])[];
    try {
      entries = PackagingSection.readEntries(manifest, field).map(([id, entry]) => [id, read(entry)] as const);
    }
    catch (error) {
      throw new BuildException(shape, new ExceptionOptions(error));
    }
    const values = new Map<string, T>();
    for (const [id, value] of entries) {
      if (!Resources.packageIdPattern.test(id) || Object.isNull(value))
        throw new BuildException(shape);
      values.set(id, value);
    }
    return values;
  }

  public static readNames(entry: JsonReader, field: string): ReadonlySet<string> | null {
    const names = entry.readStringArray(field);
    entry.readNonBlankString(Resources.packagingReasonField);
    return names.length === 0 || names.some(t => String.isNullOrWhitespace(t)) ? null : new Set(names);
  }

  private static readEntries(manifest: JsonReader, field: string): readonly (readonly [string, JsonReader])[] {
    let section = manifest;
    for (const name of [Resources.manifestDesktopField, Resources.manifestPackagingField, field]) {
      if (!section.hasField(name))
        return [];
      section = section.readObject(name);
    }
    const found = section;
    return Object.keys(found.toJson()).map(t => [t, found.readObject(t)] as const);
  }
}
