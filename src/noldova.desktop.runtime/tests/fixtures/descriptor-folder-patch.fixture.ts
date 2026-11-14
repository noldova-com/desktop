/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

export class DescriptorFolderPatchFixture implements Disposable {
  public static readonly OPENED: number = 42;

  private readonly readdirSync: typeof fs.readdirSync = fs.readdirSync;
  private readonly readlinkSync: typeof fs.readlinkSync = fs.readlinkSync;
  private readonly openSync: typeof fs.openSync = fs.openSync;
  private readonly fstatSync: typeof fs.fstatSync = fs.fstatSync;
  private readonly closeSync: typeof fs.closeSync = fs.closeSync;

  public readonly opened: string[] = [];
  public readonly closed: number[] = [];
  public openFailure: string | null = null;
  public statFailure: string | null = null;
  public linkFailure: string | null = null;
  public openedFifo: boolean = true;
  public openedInode: number = 81234;

  public constructor(folder: string, links: ReadonlyMap<string, string | null>, names: readonly string[] = [...links.keys()]) {
    fs.readdirSync = ((target: fs.PathLike): string[] => {
      if (String(target) !== folder)
        throw Object.assign(new Error(`ENOENT: no such file or directory, scandir '${String(target)}'`), { code: "ENOENT" });
      return [...names];
    }) as typeof fs.readdirSync;
    fs.readlinkSync = ((target: fs.PathLike): string => {
      if (!Object.isNull(this.linkFailure))
        throw Object.assign(new Error(`${this.linkFailure}: cannot read link '${String(target)}'`), { code: this.linkFailure });
      const link = links.get(String(target).slice(folder.length + 1));
      if (Object.isNullOrUndefined(link))
        throw Object.assign(new Error(`EINVAL: invalid argument, readlink '${String(target)}'`), { code: "EINVAL" });
      return link;
    }) as typeof fs.readlinkSync;
    fs.openSync = (target: fs.PathLike, flags?: fs.OpenMode): number => {
      this.opened.push(`${String(target)} ${String(flags)}`);
      if (!Object.isNull(this.openFailure))
        throw Object.assign(new Error(`${this.openFailure}: cannot open '${String(target)}'`), { code: this.openFailure });
      return DescriptorFolderPatchFixture.OPENED;
    };
    Object.assign(fs, { fstatSync: (descriptor: number): Pick<fs.Stats, "isFIFO" | "ino"> => {
      if (!Object.isNull(this.statFailure))
        throw Object.assign(new Error(`${this.statFailure}: cannot stat descriptor ${descriptor}`), { code: this.statFailure });
      return { isFIFO: () => this.openedFifo, ino: this.openedInode };
    } });
    fs.closeSync = (descriptor: number): void => {
      this.closed.push(descriptor);
    };
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.readdirSync = this.readdirSync;
    fs.readlinkSync = this.readlinkSync;
    fs.openSync = this.openSync;
    fs.fstatSync = this.fstatSync;
    fs.closeSync = this.closeSync;
    syncBuiltinESMExports();
  }
}
