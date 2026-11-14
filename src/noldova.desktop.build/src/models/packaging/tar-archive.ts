/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { gunzipSync } from "node:zlib";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";
import { TarFile } from "./tar-file.ts";

export class TarArchive {
  public readonly entries: readonly TarFile[];
  public readonly files: ReadonlyMap<string, TarFile>;
  public readonly topLevelFiles: ReadonlyMap<string, Buffer>;
  public readonly skipped: readonly TarFile[];

  private constructor(entries: readonly TarFile[]) {
    this.entries = entries;
    this.files = new Map(entries.flatMap(t => {
      const packageFile = Resources.tarFileTypes.includes(t.type) ? Resources.tarPackagePath.exec(t.name) : null;
      return Object.isNull(packageFile) ? [] : [[String(packageFile[1]), t] as const];
    }));
    this.topLevelFiles = new Map([...this.files].filter(([name]) => !name.includes(Resources.pathSegmentSeparator)).map(([name, file]) => [name, file.content]));
    this.skipped = entries.filter(t => !Resources.tarFileTypes.includes(t.type) && t.type !== Resources.tarFolderType);
  }

  public static describeEntry(entry: TarFile): string {
    return Resources.tarEntryKinds.get(entry.type) ?? Resources.formatTarEntryType(entry.type);
  }

  public static fromGzip(data: Buffer, source: string): TarArchive {
    const archive = gunzipSync(data);
    const entries: TarFile[] = [];
    let longName: string | null = null;
    let offset = 0;
    for (;;) {
      if (offset + Resources.tarBlockSize > archive.length)
        throw new BuildException(Resources.formatTarUnclosed(source));
      const header = archive.subarray(offset, offset + Resources.tarBlockSize);
      if (header.every(t => t === 0))
        break;
      if (!TarArchive.hasChecksum(header))
        throw new BuildException(Resources.formatTarChecksumMismatch(source, offset));
      const size = TarArchive.readOctal(header, Resources.tarSizeStart, Resources.tarSizeEnd, source, Resources.tarSizeField);
      const start = offset + Resources.tarBlockSize;
      if (start + size > archive.length)
        throw new BuildException(Resources.formatTarEntryOverrun(source, offset));
      const content = archive.subarray(start, start + size);
      const type = TarArchive.readText(header, Resources.tarTypeStart, Resources.tarTypeStart + 1);
      if (type === Resources.tarLongLinkType)
        throw new BuildException(Resources.formatTarLongLink(source, offset));
      if (type === Resources.tarLongNameType)
        longName = TarArchive.readText(content, 0, content.length);
      else if (type === Resources.tarExtendedType)
        longName = TarArchive.readExtendedPath(content, source, offset) ?? longName;
      else if (type !== Resources.tarGlobalType) {
        const prefix = header.toString(Resources.tarHeaderEncoding, Resources.tarMagicStart, Resources.tarMagicEnd) === Resources.tarUstarMagic ? TarArchive.readText(header, Resources.tarPrefixStart, Resources.tarPrefixEnd) : String.empty;
        const name = longName ?? [prefix, TarArchive.readText(header, 0, Resources.tarNameEnd)].filter(t => t.length > 0).join(Resources.pathSegmentSeparator);
        entries.push(new TarFile(name, type, content, TarArchive.readOctal(header, Resources.tarNameEnd, Resources.tarModeEnd, source, Resources.tarModeField)));
        longName = null;
      }
      offset = start + Math.ceil(size / Resources.tarBlockSize) * Resources.tarBlockSize;
    }
    return new TarArchive(entries);
  }

  private static hasChecksum(header: Buffer): boolean {
    const stored = header.toString(Resources.tarHeaderEncoding, Resources.tarChecksumStart, Resources.tarChecksumEnd).replace(Resources.tarFieldPadding, String.empty);
    let sum = 0;
    for (let i = 0; i < header.length; i++)
      sum += i >= Resources.tarChecksumStart && i < Resources.tarChecksumEnd ? Resources.tarSpace : Number(header[i]);
    return Resources.tarOctalField.test(stored) && Number.parseInt(stored, Resources.octalRadix) === sum;
  }

  private static readExtendedPath(content: Buffer, source: string, header: number): string | null {
    let offset = 0;
    while (offset < content.length) {
      const space = content.indexOf(Resources.tarSpace, offset);
      const length = Number.parseInt(content.toString(Resources.tarHeaderEncoding, offset, space), Resources.decimalRadix);
      if (space < 0 || !Number.isInteger(length) || length <= space - offset || offset + length > content.length)
        throw new BuildException(Resources.formatTarPaxUnreadable(source, header));
      const record = content.toString(Resources.textEncoding, space + 1, offset + length - 1);
      if (record.startsWith(Resources.tarExtendedPath))
        return record.slice(Resources.tarExtendedPath.length);
      offset += length;
    }
    return null;
  }

  private static readOctal(header: Buffer, start: number, end: number, source: string, field: string): number {
    const text = header.toString(Resources.tarHeaderEncoding, start, end).replace(Resources.tarFieldPadding, String.empty);
    if (!Resources.tarOctalField.test(text))
      throw new BuildException(Resources.formatTarFieldNotOctal(source, field));
    return Number.parseInt(text, Resources.octalRadix);
  }

  private static readText(header: Buffer, start: number, end: number): string {
    return header.subarray(start, end).toString(Resources.textEncoding).split(Resources.tarNul, 1).join(String.empty);
  }
}
