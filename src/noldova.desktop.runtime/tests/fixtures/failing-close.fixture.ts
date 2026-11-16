/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

type CloseCallback = (failure: NodeJS.ErrnoException | null) => void;

export class FailingCloseFixture implements Disposable {
  private readonly close: typeof fs.close = fs.close;
  private readonly failure: NodeJS.ErrnoException;

  public calls: number = 0;

  public constructor(failure: NodeJS.ErrnoException) {
    const close = this.close;
    this.failure = failure;
    fs.close = ((handle: number, callback: CloseCallback): void => {
      this.calls++;
      close(handle, () => callback(this.failure));
    }) as typeof fs.close;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.close = this.close;
    syncBuiltinESMExports();
  }
}
