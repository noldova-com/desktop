/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { Stats } from "node:fs";

export class StatsFixture implements Stats {
  private readonly kind: "file" | "folder" | "link";

  public readonly dev: number = 0;
  public readonly ino: number = 0;
  public readonly mode: number = 0;
  public readonly nlink: number = 0;
  public readonly uid: number = 0;
  public readonly gid: number = 0;
  public readonly rdev: number = 0;
  public readonly size: number = 0;
  public readonly blksize: number = 0;
  public readonly blocks: number = 0;
  public readonly atimeMs: number = 0;
  public readonly mtimeMs: number = 0;
  public readonly ctimeMs: number = 0;
  public readonly birthtimeMs: number = 0;
  public readonly atime: Date = new Date(0);
  public readonly mtime: Date = new Date(0);
  public readonly ctime: Date = new Date(0);
  public readonly birthtime: Date = new Date(0);
  public readonly atimeInstant: Stats["atimeInstant"] = undefined;
  public readonly mtimeInstant: Stats["mtimeInstant"] = undefined;
  public readonly ctimeInstant: Stats["ctimeInstant"] = undefined;
  public readonly birthtimeInstant: Stats["birthtimeInstant"] = undefined;

  public constructor(kind: "file" | "folder" | "link") {
    this.kind = kind;
  }

  public isFile(): boolean {
    return this.kind === "file";
  }

  public isDirectory(): boolean {
    return this.kind === "folder";
  }

  public isBlockDevice(): boolean {
    return false;
  }

  public isCharacterDevice(): boolean {
    return false;
  }

  public isSymbolicLink(): boolean {
    return this.kind === "link";
  }

  public isFIFO(): boolean {
    return false;
  }

  public isSocket(): boolean {
    return false;
  }
}
