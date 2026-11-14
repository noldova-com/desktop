/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

import { CodedError } from "./coded-error.fixture.js";

export class FailingFileCallFixture implements Disposable {
  private readonly link: typeof fs.link = fs.link;
  private readonly open: typeof fs.open = fs.open;
  private readonly rename: typeof fs.rename = fs.rename;
  private readonly rm: typeof fs.rm = fs.rm;

  public constructor(name: "link" | "open" | "rename" | "rm", file: string, code: string | null) {
    const { link, open, rename, rm } = this;
    const isFailing = (...paths: readonly unknown[]): boolean => paths.some(t => String(t) === file);
    const fail = (): Promise<never> => Promise.reject(Object.isNull(code) ? new Error(`${name} failed without a code`) : new CodedError(code, `${code}: operation failed, ${name} '${file}'`));
    if (name === "link")
      fs.link = (from, to) => isFailing(from, to) ? fail() : link(from, to);
    else if (name === "open")
      fs.open = (target, flags, mode) => isFailing(target) ? fail() : open(target, flags, mode);
    else if (name === "rename")
      fs.rename = (from, to) => isFailing(from, to) ? fail() : rename(from, to);
    else
      fs.rm = (target, options) => isFailing(target) ? fail() : rm(target, options);
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.link = this.link;
    fs.open = this.open;
    fs.rename = this.rename;
    fs.rm = this.rm;
    syncBuiltinESMExports();
  }
}
