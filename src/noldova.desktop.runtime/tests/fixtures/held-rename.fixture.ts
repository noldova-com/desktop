/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PathLike } from "node:fs";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

export class HeldRenameFixture implements Disposable {
  private readonly rename: typeof fs.rename = fs.rename;

  public attempts: number = 0;

  public constructor(target: string, codes: readonly string[]) {
    const rename = this.rename;
    fs.rename = (from: PathLike, to: PathLike): Promise<void> => {
      if (String(to) !== target)
        return rename(from, to);
      const code = codes[this.attempts++];
      return Object.isUndefined(code)
        ? rename(from, to)
        : Promise.reject(Object.assign(new Error(`${code}: operation not permitted, rename '${String(from)}' -> '${target}'`), { code }));
    };
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.rename = this.rename;
    syncBuiltinESMExports();
  }
}
