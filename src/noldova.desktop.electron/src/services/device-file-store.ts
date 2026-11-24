/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { FolderCreation } from "@noldova/desktop.runtime";

import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import { Resources } from "../resources.js";
import { FilePresence } from "./file-presence.js";

export class DeviceFileStore implements IDeviceFileStore {
  private readonly folder: string;
  private readonly file: string;
  private writing: Promise<void> = Promise.resolve();

  public constructor(folder: string, fileName: string) {
    ArgumentException.throwIfNullOrWhitespace(fileName, Resources.fileNameParameter);

    this.folder = folder;
    this.file = join(folder, fileName);
  }

  public async readAsync(): Promise<JsonObject | null> {
    if (!await FilePresence.existsAsync(this.file))
      return null;
    return JsonReader.parse(await readFile(this.file, Resources.textEncoding)).toJson();
  }

  public writeAsync(value: JsonObject): Promise<void> {
    const write = this.writing.catch(() => undefined).then(() => this.writeNowAsync(value));
    this.writing = write;
    return write;
  }

  public deleteAsync(): Promise<void> {
    const deletion = this.writing.catch(() => undefined).then(() => rm(this.file, { force: true }));
    this.writing = deletion;
    return deletion;
  }

  private async writeNowAsync(value: JsonObject): Promise<void> {
    const temporary = `${this.file}${Resources.temporarySuffix}`;
    await FolderCreation.createAsync(this.folder);
    await writeFile(temporary, JSON.stringify(value), Resources.textEncoding);
    await rename(temporary, this.file);
  }
}
