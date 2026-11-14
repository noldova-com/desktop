/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import zlib from "node:zlib";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class ArchiveReader {
  public async readAsync(archive: string): Promise<ReadonlyMap<string, Buffer>> {
    let tar: Buffer;
    try {
      tar = zlib.gunzipSync(await readFile(archive));
    }
    catch (error) {
      throw new BuildException(Resources.formatArchiveUnreadable(archive), new ExceptionOptions(error));
    }

    const files = new Map<string, Buffer>();
    let extendedName: string | null = null;
    for (let offset = 0; offset + Resources.tarBlockSize <= tar.length && tar[offset] !== 0;) {
      const header = tar.subarray(offset, offset + Resources.tarBlockSize);
      const size = Number.parseInt(ArchiveReader.readField(header, Resources.tarSizeStart, Resources.tarSizeEnd).trim(), Resources.tarSizeRadix);
      if (!Number.isInteger(size) || offset + Resources.tarBlockSize + size > tar.length)
        throw new BuildException(Resources.formatArchiveEntryMalformed(archive, offset));
      const content = tar.subarray(offset + Resources.tarBlockSize, offset + Resources.tarBlockSize + size);
      const type = header.toString(Resources.tarTypeEncoding, Resources.tarTypeAt, Resources.tarTypeAt + 1);
      if (type === Resources.tarExtendedType)
        extendedName = Resources.tarPathRecordPattern.exec(content.toString(Resources.textEncoding))?.[1] ?? null;
      else {
        if (Resources.tarReadFileTypes.includes(type))
          files.set(extendedName ?? ArchiveReader.readName(header), Buffer.from(content));
        extendedName = null;
      }
      offset += Resources.tarBlockSize * (1 + Math.ceil(size / Resources.tarBlockSize));
    }
    return files;
  }

  private static readName(header: Buffer): string {
    const name = ArchiveReader.readField(header, 0, Resources.tarNameEnd);
    const prefix = ArchiveReader.readField(header, Resources.tarPrefixStart, Resources.tarPrefixEnd);
    return prefix.length > 0 ? Resources.formatFolderPath(prefix, name) : name;
  }

  private static readField(header: Buffer, start: number, end: number): string {
    return header.toString(Resources.textEncoding, start, end).replace(Resources.tarFieldEndPattern, String.empty);
  }
}
