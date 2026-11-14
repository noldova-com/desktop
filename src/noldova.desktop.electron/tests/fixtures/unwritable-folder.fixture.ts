/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

import { CodedError } from "./coded-error.fixture.js";

export class UnwritableFolderFixture implements Disposable {
  private readonly open: typeof fs.open = fs.open;

  public constructor(folder: string) {
    const open = this.open;
    fs.open = (target, flags, mode) =>
      path.dirname(String(target)) === folder
        ? Promise.reject(new CodedError("EACCES", `EACCES: permission denied, open '${String(target)}'`))
        : open(target, flags, mode);
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.open = this.open;
    syncBuiltinESMExports();
  }
}
