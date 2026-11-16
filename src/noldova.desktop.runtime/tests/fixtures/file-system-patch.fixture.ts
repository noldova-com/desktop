/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

import "@noldova/context.core";

export class FileSystemPatchFixture implements Disposable {
  private static readonly MOUNT_TABLE: string = "/proc/self/mountinfo";

  private readonly access: typeof fs.promises.access = fs.promises.access;
  private readonly readdir: typeof fs.promises.readdir = fs.promises.readdir;
  private readonly restoreReadFile: () => void;

  public readonly checked: string[] = [];

  public constructor(failingPath: string | null, mountTable: string | null = String.empty) {
    const readFile = fs.promises.readFile;
    fs.promises.access = (target: fs.PathLike): Promise<void> => Promise.try(() => this.check(target, failingPath));
    fs.promises.readdir = (target: fs.PathLike): Promise<never[]> => Promise.try(() => {
      this.check(target, failingPath);
      return [];
    });
    const reading = mock.method(fs.promises, "readFile", (...values: Parameters<typeof fs.promises.readFile>): Promise<string | Buffer> => {
      const [target] = values;
      if (target !== FileSystemPatchFixture.MOUNT_TABLE)
        return readFile(...values);
      return Promise.try(() => {
        this.check(FileSystemPatchFixture.MOUNT_TABLE, failingPath);
        if (Object.isNull(mountTable))
          throw Object.assign(new Error(`ENOENT: no such file or directory, open '${FileSystemPatchFixture.MOUNT_TABLE}'`), { code: "ENOENT" });
        return mountTable;
      });
    });
    this.restoreReadFile = () => reading.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.promises.access = this.access;
    fs.promises.readdir = this.readdir;
    this.restoreReadFile();
    syncBuiltinESMExports();
  }

  private check(target: fs.PathLike, failingPath: string | null): void {
    this.checked.push(String(target));
    if (String(target) === failingPath)
      throw Object.assign(new Error(`EACCES: permission denied, access '${failingPath}'`), { code: "EACCES" });
  }
}
