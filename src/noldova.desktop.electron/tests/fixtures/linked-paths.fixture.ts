/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { posix, win32 } from "node:path";

import type { IShownPathFiles, IShownPathStatus } from "@noldova/desktop.electron";

import { CodedError } from "./coded-error.fixture.js";

export class LinkedPathsFixture implements IShownPathFiles {
  public static readonly folderMode: number = 0o040755;
  public static readonly fileMode: number = 0o100644;

  public readonly looked: string[] = [];
  private readonly entries: Readonly<Record<string, string | number | null>>;
  private readonly realpaths: Readonly<Record<string, string | null>>;
  private readonly folders: ReadonlySet<string>;

  public constructor(platform: string, entries: Readonly<Record<string, string | number | null>>, realpaths: Readonly<Record<string, string | null>> = {}) {
    const paths = platform === "win32" ? win32 : posix;
    this.entries = entries;
    this.realpaths = realpaths;
    this.folders = new Set(Object.keys(entries).flatMap(t => LinkedPathsFixture.ancestors(t, paths)));
  }

  public lstat(file: string): Promise<IShownPathStatus> {
    this.looked.push(file);
    const entry = this.entries[file];
    if (Object.isString(entry) || Object.isNull(entry))
      return LinkedPathsFixture.status(0o120777);
    if (!Object.isUndefined(entry))
      return LinkedPathsFixture.status(entry);
    return this.folders.has(file) ? LinkedPathsFixture.status(LinkedPathsFixture.folderMode) : LinkedPathsFixture.missing(file);
  }

  public readlink(link: string): Promise<string> {
    this.looked.push(link);
    const entry = this.entries[link];
    return Object.isString(entry) ? Promise.resolve(entry) : LinkedPathsFixture.missing(link);
  }

  public realpath(file: string): Promise<string> {
    this.looked.push(file);
    const real = Object.hasOwn(this.realpaths, file) ? this.realpaths[file] : file;
    return Object.isString(real) ? Promise.resolve(real) : LinkedPathsFixture.missing(file);
  }

  private static ancestors(path: string, paths: typeof posix): string[] {
    const parent = paths.dirname(path);
    return parent === path ? [path] : [parent, ...LinkedPathsFixture.ancestors(parent, paths)];
  }

  private static status(mode: number): Promise<IShownPathStatus> {
    const kind = mode & 0o170000;
    return Promise.resolve({
      mode,
      isFile: (): boolean => kind === 0o100000,
      isDirectory: (): boolean => kind === 0o040000,
      isSymbolicLink: (): boolean => kind === 0o120000
    });
  }

  private static missing(path: string): Promise<never> {
    return Promise.reject(new CodedError("ENOENT", `ENOENT: ${path}`));
  }
}
