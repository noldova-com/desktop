/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { gzipSync } from "node:zlib";

import "@noldova/context.core";

export interface ITarballEntry {
  readonly name: string;
  readonly text?: string;
  readonly type?: string;
  readonly size?: string;
  readonly hasBadChecksum?: boolean;
  readonly prefix?: string;
}

export class TarballFixture {
  public static readonly FOLDER: string = "package/";

  private static readonly BLOCK_SIZE: number = 512;
  private static readonly NAME_LIMIT: number = 100;
  private static readonly CHECKSUM_START: number = 148;
  private static readonly CHECKSUM_LENGTH: number = 8;

  public static create(files: Readonly<Record<string, string>>): Buffer {
    return TarballFixture.createEntries(Object.entries(files).map(([name, text]) => ({ name: `${TarballFixture.FOLDER}${name}`, text })));
  }

  public static createEntries(entries: readonly ITarballEntry[], hasEnd: boolean = true): Buffer {
    const blocks = entries.flatMap(t => t.name.length > TarballFixture.NAME_LIMIT
      ? [...TarballFixture.formatEntry({ name: "PaxHeader", type: "x", text: TarballFixture.formatRecord(`path=${t.name}`) }), ...TarballFixture.formatEntry({ ...t, name: t.name.slice(0, TarballFixture.NAME_LIMIT) })]
      : TarballFixture.formatEntry(t));
    return gzipSync(Buffer.concat([...blocks, Buffer.alloc(hasEnd ? TarballFixture.BLOCK_SIZE * 2 : 0)]));
  }

  private static formatRecord(record: string): string {
    let length = record.length + 2;
    while (`${length} ${record}\n`.length !== length)
      length++;
    return `${length} ${record}\n`;
  }

  private static formatEntry(entry: ITarballEntry): readonly Buffer[] {
    const content = Buffer.from(entry.text ?? String.empty);
    const header = Buffer.alloc(TarballFixture.BLOCK_SIZE);
    header.write(entry.name, 0);
    header.write("0000644\0", 100);
    header.write("0000000\0", 108);
    header.write("0000000\0", 116);
    header.write(entry.size ?? `${content.length.toString(8).padStart(11, "0")}\0`, 124);
    header.write("00000000000\0", 136);
    header.write(entry.type ?? "0", 156);
    header.write("ustar\0", 257);
    header.write("00", 263);
    header.write(entry.prefix ?? String.empty, 345);
    header.fill(" ", TarballFixture.CHECKSUM_START, TarballFixture.CHECKSUM_START + TarballFixture.CHECKSUM_LENGTH);
    const sum = header.reduce((total, t) => total + t, 0) + (entry.hasBadChecksum === true ? 1 : 0);
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, TarballFixture.CHECKSUM_START);
    return [header, content, Buffer.alloc((TarballFixture.BLOCK_SIZE - content.length % TarballFixture.BLOCK_SIZE) % TarballFixture.BLOCK_SIZE)];
  }
}
