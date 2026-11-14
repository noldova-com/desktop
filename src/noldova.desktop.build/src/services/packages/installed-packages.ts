/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";

import { FileErrors } from "../files/file-errors.ts";
import { Resources } from "../../resources.ts";

export class InstalledPackages {
  public static async listAsync(folder: string): Promise<readonly (readonly [name: string, folder: string])[]> {
    const modules = path.join(folder, Resources.nodeModulesFolder);
    if (!existsSync(modules))
      return [];
    const found: (readonly [string, string])[] = [];
    for (const entry of (await readdir(modules)).filter(t => !t.startsWith(Resources.hiddenEntryPrefix))) {
      const names = entry.startsWith(Resources.packageScopeMark) && await InstalledPackages.isFolderAsync(path.join(modules, entry))
        ? (await readdir(path.join(modules, entry))).map(t => Resources.formatFolderPath(entry, t))
        : [entry];
      for (const name of names) {
        const packageFolder = path.join(modules, ...name.split(Resources.pathSegmentSeparator));
        if (!await InstalledPackages.isFolderAsync(packageFolder))
          continue;
        found.push([await InstalledPackages.readNameAsync(packageFolder, name), packageFolder]);
        if (!(await lstat(packageFolder)).isSymbolicLink())
          found.push(...await InstalledPackages.listAsync(packageFolder));
      }
    }
    return found;
  }

  public static async readNameAsync(folder: string, fallback: string): Promise<string> {
    try {
      return JsonReader.parse(await readFile(path.join(folder, Resources.packageManifestFileName), Resources.textEncoding)).readString(Resources.manifestNameField);
    }
    catch (error) {
      if (!(error instanceof JsonException || FileErrors.isMissing(error)))
        throw error;
      return fallback;
    }
  }

  public static async readDependencyNamesAsync(folder: string, fields: readonly string[] = Resources.installedDependencyFields): Promise<readonly string[]> {
    const entries = new Map(Object.entries(JsonReader.parse(await readFile(path.join(folder, Resources.packageManifestFileName), Resources.textEncoding)).toJson()));
    const names: string[] = [];
    for (const field of fields) {
      const listed = entries.get(field);
      if (Object.isPlainObject(listed))
        names.push(...Object.keys(listed));
    }
    return names;
  }

  public static async readVersionAsync(folder: string): Promise<string> {
    const version = JsonReader.parse(await readFile(path.join(folder, Resources.packageManifestFileName), Resources.textEncoding)).toJson()[Resources.manifestVersionField];
    return Object.isString(version) ? version : String.empty;
  }

  public static resolve(root: string, from: string, name: string): string | null {
    for (let folder = from; ; folder = path.dirname(folder)) {
      const candidate = path.join(folder, Resources.nodeModulesFolder, ...name.split(Resources.pathSegmentSeparator));
      if (existsSync(path.join(candidate, Resources.packageManifestFileName)))
        return candidate;
      if (folder === root || path.dirname(folder) === folder)
        return null;
    }
  }

  private static async isFolderAsync(item: string): Promise<boolean> {
    return existsSync(item) && (await stat(item)).isDirectory();
  }
}
