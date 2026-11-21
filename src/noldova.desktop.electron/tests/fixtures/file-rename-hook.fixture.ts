/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

export class FileRenameHookFixture implements Disposable {
  private readonly rename: typeof fs.rename = fs.rename;

  public constructor(file: string, afterAsync: () => Promise<void>) {
    const rename = this.rename;
    fs.rename = async (from, to) => {
      await rename(from, to);
      if (String(from) === file)
        await afterAsync();
    };
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.rename = this.rename;
    syncBuiltinESMExports();
  }
}
