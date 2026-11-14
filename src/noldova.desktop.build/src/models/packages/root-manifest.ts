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
import { JsonException, JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { FileErrors } from "../../services/files/file-errors.ts";
import { Resources } from "../../resources.ts";

export class RootManifest {
  public readonly productVersion: string;
  public readonly protocolVersion: number | null;
  public readonly overrides: unknown;

  public constructor(productVersion: string, protocolVersion: number | null = null, overrides: unknown = undefined) {
    if (!Resources.rootVersionPattern.test(productVersion))
      throw new BuildException(Resources.rootVersionInvalid);
    if (!Object.isNull(protocolVersion) && (!Number.isSafeInteger(protocolVersion) || protocolVersion < 1))
      throw new BuildException(Resources.rootProtocolVersionInvalid);

    this.productVersion = productVersion;
    this.protocolVersion = protocolVersion;
    this.overrides = overrides;
  }

  public static async readAsync(root: string): Promise<RootManifest> {
    let text: string;
    try {
      text = await readFile(path.join(root, Resources.packageManifestFileName), Resources.textEncoding);
    }
    catch (error) {
      throw new BuildException(Resources.rootVersionInvalid, new ExceptionOptions(error));
    }
    return RootManifest.parse(text);
  }

  public static async readModulePackagePrefixAsync(root: string): Promise<string> {
    let manifest: JsonReader;
    try {
      manifest = JsonReader.parse(await readFile(path.join(root, Resources.packageManifestFileName), Resources.textEncoding));
    }
    catch (error) {
      if (!(error instanceof JsonException || FileErrors.isMissing(error)))
        throw error;
      return Resources.modulesPrefix;
    }
    const desktop = RootManifest.readDesktop(manifest);
    if (Object.isNull(desktop) || !desktop.hasField(Resources.modulePackagePrefixField))
      return Resources.modulesPrefix;
    const prefix = desktop.readValue(Resources.modulePackagePrefixField);
    if (!Object.isString(prefix) || !Resources.modulesPrefixPattern.test(prefix))
      throw new BuildException(Resources.rootModulesPrefixInvalid);
    return prefix;
  }

  public static parse(text: string): RootManifest {
    let manifest: JsonReader;
    try {
      manifest = JsonReader.parse(text);
    }
    catch (error) {
      throw new BuildException(Resources.rootVersionInvalid, new ExceptionOptions(error));
    }
    const version = manifest.hasField(Resources.manifestVersionField) ? manifest.readValue(Resources.manifestVersionField) : undefined;
    if (!Object.isString(version))
      throw new BuildException(Resources.rootVersionInvalid);
    return new RootManifest(version, RootManifest.readProtocolVersion(manifest),
      manifest.hasField(Resources.manifestOverridesField) ? manifest.readValue(Resources.manifestOverridesField) : undefined);
  }

  private static readDesktop(manifest: JsonReader): JsonReader | null {
    if (!manifest.hasField(Resources.manifestDesktopField))
      return null;
    const desktop = manifest.readValue(Resources.manifestDesktopField);
    return Object.isPlainObject(desktop) ? manifest.readObject(Resources.manifestDesktopField) : null;
  }

  private static readProtocolVersion(manifest: JsonReader): number | null {
    const desktop = RootManifest.readDesktop(manifest);
    if (Object.isNull(desktop) || !desktop.hasField(Resources.protocolVersionField))
      return null;
    const protocolVersion = desktop.readValue(Resources.protocolVersionField);
    if (!Object.isNumber(protocolVersion))
      throw new BuildException(Resources.rootProtocolVersionInvalid);
    return protocolVersion;
  }
}
