/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FileHandle, open } from "node:fs/promises";

import "@noldova/context.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class AsarArchive {
  public static async readTextAsync(archive: string, segments: readonly string[]): Promise<string | null> {
    const file = await open(archive, Resources.fileReadFlag);
    try {
      const [header, length] = await AsarArchive.readHeaderAsync(file, archive);
      const entry = AsarArchive.findEntry(header, segments);
      const size = AsarArchive.readField(entry, Resources.asarSizeField);
      const offset = AsarArchive.readField(entry, Resources.asarOffsetField);
      if (Object.isUndefined(entry))
        return null;
      if (!Object.isNumber(size) || !Object.isString(offset))
        throw new BuildException(Resources.formatAsarEntryNotFile(archive, segments));
      return (await AsarArchive.readAsync(file, archive, size, Resources.asarSizeLength + length + Number(offset))).toString(Resources.textEncoding);
    }
    finally {
      await file.close();
    }
  }

  public static async listFilesAsync(archive: string): Promise<readonly string[]> {
    const file = await open(archive, Resources.fileReadFlag);
    try {
      return AsarArchive.listFiles((await AsarArchive.readHeaderAsync(file, archive))[0], []).sort();
    }
    finally {
      await file.close();
    }
  }

  public static async isUnpackedAsync(archive: string, segments: readonly string[]): Promise<boolean | null> {
    const file = await open(archive, Resources.fileReadFlag);
    try {
      const entry = AsarArchive.findEntry((await AsarArchive.readHeaderAsync(file, archive))[0], segments);
      return Object.isUndefined(entry) ? null : AsarArchive.readField(entry, Resources.asarUnpackedField) === true;
    }
    finally {
      await file.close();
    }
  }

  private static async readHeaderAsync(file: FileHandle, archive: string): Promise<readonly [JsonObject, number]> {
    const sizes = await AsarArchive.readAsync(file, archive, Resources.asarSizeLength, 0);
    const header = await AsarArchive.readAsync(file, archive, sizes.readUInt32LE(Resources.asarHeaderSizeOffset), Resources.asarSizeLength);
    const length = header.readUInt32LE(Resources.asarHeaderLengthOffset);
    return [JsonReader.parse(header.toString(Resources.textEncoding, Resources.asarHeaderOffset, Resources.asarHeaderOffset + length)).toJson(), header.length];
  }

  private static listFiles(entry: JsonValue | undefined, segments: readonly string[]): string[] {
    const files = AsarArchive.readField(entry, Resources.asarFilesField);
    if (!Object.isPlainObject(files))
      return segments.length === 0 ? [] : [segments.join(Resources.pathSegmentSeparator)];
    return Object.entries(files).flatMap(([name, inner]) => AsarArchive.listFiles(inner, [...segments, name]));
  }

  private static findEntry(header: JsonObject, segments: readonly string[]): JsonValue | undefined {
    let entry: JsonValue | undefined = header;
    for (const segment of segments)
      entry = AsarArchive.readField(AsarArchive.readField(entry, Resources.asarFilesField), segment);
    return entry;
  }

  private static async readAsync(file: FileHandle, archive: string, length: number, position: number): Promise<Buffer> {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await file.read(buffer, 0, length, position);
    if (bytesRead !== length)
      throw new BuildException(Resources.formatAsarTruncated(archive, length, position));
    return buffer;
  }

  private static readField(value: JsonValue | undefined, name: string): JsonValue | undefined {
    return Object.isPlainObject(value) ? new Map(Object.entries(value)).get(name) : undefined;
  }
}
