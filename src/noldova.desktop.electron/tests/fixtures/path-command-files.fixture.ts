/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";

import "@noldova/context.core";
import type { IPathCommandFiles } from "@noldova/desktop.electron";

import { CodedError } from "./coded-error.fixture.js";

export class PathCommandFilesFixture implements IPathCommandFiles {
  public readingRefusal: string | null = null;
  public writingRefusal: string | null = null;
  public linkStubs: Map<string, string> | null = null;

  public lstat(file: string): Promise<Stats> {
    return PathCommandFilesFixture.refuseOr(this.readingRefusal, async () => {
      if (this.linkStubs?.has(file) !== true)
        return await lstat(file);
      const stub = await lstat(tmpdir());
      stub.isSymbolicLink = () => true;
      return stub;
    });
  }

  public readlink(link: string): Promise<string> {
    const target = this.linkStubs?.get(link);
    return Object.isUndefined(target) ? readlink(link) : Promise.resolve(target);
  }

  public rm(file: string): Promise<void> {
    return this.linkStubs?.delete(file) === true ? Promise.resolve() : rm(file);
  }

  public mkdir(folder: string, options: { readonly recursive: true }): Promise<string | undefined> {
    return PathCommandFilesFixture.refuseOr(this.writingRefusal, () => mkdir(folder, options));
  }

  public symlink(target: string, link: string): Promise<void> {
    if (Object.isNull(this.linkStubs))
      return symlink(target, link);
    this.linkStubs.set(link, target);
    return Promise.resolve();
  }

  private static refuseOr<T>(code: string | null, action: () => Promise<T>): Promise<T> {
    return Object.isNull(code) ? action() : Promise.reject(new CodedError(code, `${code}: refused by the test`));
  }
}
