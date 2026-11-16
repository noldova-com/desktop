/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";

import { FileErrors } from "../files/file-errors.ts";
import { Resources } from "../../resources.ts";
import { VersionRange } from "../../models/modules/version-range.ts";

export class ModuleRange {
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly command: string;

  public constructor(folder: string, environment: NodeJS.ProcessEnv, output: Writable, command: string) {
    this.folder = folder;
    this.environment = environment;
    this.output = output;
    this.command = command;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const [moduleFolder] = commandArguments;
    if (commandArguments.length !== 1 || Object.isUndefined(moduleFolder)) {
      this.output.write(Resources.formatModuleRangeUsage(this.command));
      return Resources.usageExitCode;
    }
    const outputFile = this.environment[Resources.githubOutputVariable];
    if (Object.isUndefined(outputFile) || outputFile.length === 0)
      return this.refuse(Resources.moduleRangeNoOutputFile);
    const file = path.join(moduleFolder, Resources.moduleDeclarationFileName);
    const declaration = await ModuleRange.readObjectAsync(path.resolve(this.folder, file));
    if (Object.isNull(declaration))
      return this.refuse(Resources.formatDeclarationNotObject(file));
    const declared = declaration.hasField(Resources.noldovaDesktopField) ? declaration.readValue(Resources.noldovaDesktopField) : undefined;
    if (!Object.isString(declared))
      return this.refuse(Resources.formatModuleRangeMissing(file));
    const range = VersionRange.parse(declared);
    if (Object.isNull(range))
      return this.refuse(Resources.formatModuleRangeForm(file, declared));
    if (!range.isFollowing())
      return this.refuse(Resources.formatModuleRangeNotFollowing(file, range.toString(), range.minimum, String(VersionRange.following(range.minimum))));
    const manifest = await ModuleRange.readObjectAsync(path.resolve(this.folder, Resources.packageManifestFileName));
    if (Object.isNull(manifest))
      return this.refuse(Resources.rootManifestUnreadable);
    const pins = ModuleRange.readDesktopDependencies(manifest);
    const loose = pins.find(([, version]) => !Object.isString(version) || !VersionRange.isVersion(version));
    if (!Object.isUndefined(loose))
      return this.refuse(Resources.formatModuleRangePinNotExact(loose[0], JSON.stringify(loose[1])));
    if (pins.length === 0)
      return this.refuse(Resources.moduleRangeNoPin);
    const other = pins.find(([, version]) => version !== range.minimum);
    if (!Object.isUndefined(other))
      return this.refuse(Resources.formatModuleRangeNotPin(file, range.toString(), other[0], String(other[1])));
    const published = ModuleRange.readVersions(this.environment[Resources.publishedVersionsVariable] ?? String.empty);
    if (Object.isNull(published))
      return this.refuse(Resources.moduleRangeNoPublished);
    const newest = range.newestOf(published);
    if (Object.isNull(newest))
      return this.refuse(Resources.formatModuleRangeNoneInside(file, range.toString()));
    this.output.write(Resources.formatModuleRangeHolds(range.toString(), published.filter(t => range.includes(t)).length, newest));
    await appendFile(outputFile, Resources.formatModuleRangeOutputs(range.toString(), newest));
    return 0;
  }

  private static readDesktopDependencies(manifest: JsonReader): readonly (readonly [string, unknown])[] {
    const record = new Map(Object.entries(manifest.toJson()));
    return [Resources.manifestDependenciesField, Resources.manifestDevDependenciesField].flatMap(field => {
      const dependencies = record.get(field);
      return Object.isPlainObject(dependencies) ? Object.entries(dependencies) : [];
    }).filter(([name]) => name.startsWith(Resources.modulesPrefix));
  }

  private static readVersions(text: string): readonly string[] | null {
    let read: unknown;
    try {
      read = JsonReader.parseValue(text);
    }
    catch {
      return null;
    }
    const versions: readonly unknown[] = Array.isArray(read) ? read : [read];
    const strings = versions.filter((t): t is string => Object.isString(t));
    return strings.length === versions.length ? strings : null;
  }

  private static async readObjectAsync(file: string): Promise<JsonReader | null> {
    try {
      return JsonReader.parse(await readFile(file, Resources.textEncoding));
    }
    catch (error) {
      if (!(error instanceof JsonException || FileErrors.isMissing(error)))
        throw error;
      return null;
    }
  }

  private refuse(message: string): number {
    this.output.write(Resources.formatGithubError(message));
    return Resources.failureExitCode;
  }
}
