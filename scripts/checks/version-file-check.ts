/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class VersionFileCheck implements ICheck {
  private readonly root: string;

  public readonly title: string = Resources.versionFileCheckTitle;

  public constructor(root: string) {
    this.root = root;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const released = await this.readVersionAsync(Resources.versionFile, output);
    const built = await this.readVersionAsync(Resources.manifestFile, output);
    if (Object.isNull(released) || Object.isNull(built))
      return false;
    if (released !== built) {
      output.write(Resources.formatVersionFileDiffering(released, built));
      return false;
    }
    output.write(Resources.formatVersionFileMatching(released));
    return true;
  }

  private async readVersionAsync(file: string, output: Writable): Promise<string | null> {
    let text: string;
    try {
      text = await readFile(path.join(this.root, file), Resources.encoding);
    }
    catch (error) {
      output.write(Resources.formatVersionFileUnreadable(file, error instanceof Error ? error.message : String(error)));
      return null;
    }
    let fields: JsonReader;
    try {
      fields = JsonReader.parse(text);
    }
    catch (error) {
      output.write(Resources.formatVersionFileInvalid(file, error instanceof Error ? error.message : String(error)));
      return null;
    }
    const version = fields.hasField(Resources.versionFileVersionField) ? fields.readValue(Resources.versionFileVersionField) : null;
    if (!Object.isString(version)) {
      output.write(Resources.formatVersionFileNoVersion(file, JSON.stringify(version)));
      return null;
    }
    return version;
  }
}
