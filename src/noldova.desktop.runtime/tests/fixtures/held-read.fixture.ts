/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

import "@noldova/context.core";

export class HeldReadFixture implements Disposable {
  private static readonly MESSAGES: ReadonlyMap<string, string> = new Map([
    ["EPERM", "operation not permitted"],
    ["EBUSY", "resource busy or locked"],
    ["EACCES", "permission denied"],
    ["EIO", "i/o error"]
  ]);

  private readonly restore: () => void;

  public attempts: number = 0;

  public constructor(target: string, codes: readonly string[]) {
    const readFile = fs.readFile;
    const reading = mock.method(fs, "readFile", (...values: Parameters<typeof fs.readFile>): Promise<string | Buffer> => {
      const [file] = values;
      if (String(file) !== target)
        return readFile(...values);
      const code = codes[this.attempts++];
      return Object.isUndefined(code)
        ? readFile(...values)
        : Promise.reject(Object.assign(new Error(`${code}: ${HeldReadFixture.MESSAGES.get(code) ?? code}, open '${target}'`), { code }));
    });
    this.restore = () => reading.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }
}
