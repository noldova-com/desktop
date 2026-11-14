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
import { JsonReader, type JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ApiEntryNoExportsException } from "./api-entry-no-exports.exception.ts";
import { ApiEntryNotDeclarationsException } from "./api-entry-not-declarations.exception.ts";
import { ApiEntryUnreadableException } from "./api-entry-unreadable.exception.ts";
import { ApiEntryUntypedException } from "./api-entry-untyped.exception.ts";

export class ApiEntry {
  public static readonly MAIN: ApiEntry = new ApiEntry(Resources.apiMainEntrySubpath, Resources.apiMainEntryName);

  public readonly subpath: string;
  public readonly name: string;

  private constructor(subpath: string, name: string) {
    this.subpath = subpath;
    this.name = name;
  }

  public get isMain(): boolean {
    return this.subpath === ApiEntry.MAIN.subpath;
  }

  public static async readAsync(root: string, directory: string): Promise<readonly ApiEntry[]> {
    const file = [directory, Resources.manifestFile].join(Resources.pathSeparator);
    let manifest: JsonReader;
    try {
      manifest = JsonReader.parse(await readFile(path.join(root, file), Resources.encoding));
    }
    catch (error) {
      throw new ApiEntryUnreadableException(file, error);
    }
    const exports = ApiEntry.readObjectField(manifest, Resources.manifestExportsField);
    const types = ApiEntry.readOptionalValue(manifest, Resources.apiEntryTypesField);
    const listed: readonly (readonly [string, JsonValue | undefined])[] = Object.isUndefined(exports)
      ? Object.isUndefined(types) ? [] : [[ApiEntry.MAIN.subpath, ApiEntry.qualify(types)]]
      : Object.keys(exports.toJson()).filter(t => !ApiEntry.isAsset(exports.readValue(t)))
        .map(t => [t, ApiEntry.readOptionalValue(ApiEntry.readObjectField(exports, t), Resources.apiEntryTypesField)]);
    if (listed.length === 0)
      throw new ApiEntryNoExportsException(file);
    const untyped = listed.filter(([, t]) => Object.isUndefined(t)).map(([subpath]) => subpath);
    if (untyped.length > 0)
      throw new ApiEntryUntypedException(file, untyped);
    return listed.map(([subpath, t]) => ApiEntry.parse(file, subpath, t));
  }

  private static isAsset(target: JsonValue): boolean {
    return Object.isString(target) && !Resources.apiEntryScriptPattern.test(target);
  }

  private static readObjectField(reader: JsonReader, name: string): JsonReader | undefined {
    const value = ApiEntry.readOptionalValue(reader, name);
    return Object.isPlainObject(value) ? reader.readObject(name) : undefined;
  }

  private static readOptionalValue(reader: JsonReader | undefined, name: string): JsonValue | undefined {
    return reader?.hasField(name) === true ? reader.readValue(name) : undefined;
  }

  private static qualify(types: JsonValue): JsonValue {
    return Object.isString(types) && !types.startsWith(Resources.apiEntryRelativePrefix) ? Resources.formatApiEntryRelativePath(types) : types;
  }

  private static parse(file: string, subpath: string, types: JsonValue | undefined): ApiEntry {
    const name = Object.isString(types) ? Resources.apiEntryTypesPattern.exec(types)?.[1] : undefined;
    if (Object.isUndefined(name))
      throw new ApiEntryNotDeclarationsException(file, subpath, JSON.stringify(types));
    return new ApiEntry(subpath, name);
  }
}
