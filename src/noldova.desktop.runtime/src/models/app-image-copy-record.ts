/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, rename, writeFile } from "node:fs/promises";

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { UpdateProcess, WireContract } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";

export class AppImageCopyRecord {
  private static readonly FIELDS: readonly string[] = [Resources.holderField, Resources.extractionField, Resources.mounterField];

  public readonly holder: UpdateProcess;
  public readonly extraction: string | null;
  public readonly mounter: UpdateProcess | null;

  public constructor(holder: UpdateProcess, extraction: string | null, mounter: UpdateProcess | null = null) {
    this.holder = holder;
    this.extraction = extraction;
    this.mounter = mounter;
  }

  public static fromJson(value: unknown, path?: string): AppImageCopyRecord {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, AppImageCopyRecord.FIELDS);
    const holder = reader.readObject(Resources.holderField);
    const mounter = reader.readNullableObject(Resources.mounterField);
    return WireContract.create(reader, () => new AppImageCopyRecord(UpdateProcess.fromJson(holder.toJson(), holder.path), reader.readNullableString(Resources.extractionField),
      Object.isNull(mounter) ? null : UpdateProcess.fromJson(mounter.toJson(), mounter.path)));
  }

  public static async readAsync(file: string): Promise<AppImageCopyRecord | null> {
    try {
      return AppImageCopyRecord.fromJson(JsonReader.parse(await readFile(file, Resources.utf8Encoding)).toJson());
    }
    catch (error) {
      if (error instanceof Error && Resources.nodeErrorCodeField in error && error[Resources.nodeErrorCodeField] === Resources.missingFileCode)
        return null;
      throw error;
    }
  }

  public async writeAsync(file: string): Promise<void> {
    const temporary = `${file}${Resources.temporarySuffix}`;
    await writeFile(temporary, JSON.stringify(this.toJson()), { mode: Resources.privateFileMode });
    await rename(temporary, file);
  }

  public toJson(): JsonObject {
    return { [Resources.holderField]: this.holder.toJson(), [Resources.extractionField]: this.extraction, [Resources.mounterField]: this.mounter?.toJson() ?? null };
  }
}
