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

export class HeldReadFixture implements Disposable {
  private static readonly MESSAGES: ReadonlyMap<string, string> = new Map([
    ["EPERM", "operation not permitted"],
    ["EBUSY", "resource busy or locked"],
    ["EACCES", "permission denied"],
    ["EIO", "i/o error"]
  ]);

  private readonly readFile: typeof fs.readFile = fs.readFile;

  public attempts: number = 0;

  public constructor(target: string, codes: readonly string[]) {
    const readFile = this.readFile;
    fs.readFile = ((...values: Parameters<typeof fs.readFile>): Promise<string | Buffer> => {
      const [file] = values;
      if (String(file) !== target)
        return readFile(...values);
      const code = codes[this.attempts++];
      return Object.isUndefined(code)
        ? readFile(...values)
        : Promise.reject(Object.assign(new Error(`${code}: ${HeldReadFixture.MESSAGES.get(code) ?? code}, open '${target}'`), { code }));
    }) as typeof fs.readFile;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.readFile = this.readFile;
    syncBuiltinESMExports();
  }
}
