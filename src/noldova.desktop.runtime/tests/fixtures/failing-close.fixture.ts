/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

import "@noldova/context.core";

type CloseCallback = (failure: NodeJS.ErrnoException | null) => void;

export class FailingCloseFixture implements Disposable {
  private readonly restore: () => void;
  private readonly failure: NodeJS.ErrnoException;

  public calls: number = 0;

  public constructor(failure: NodeJS.ErrnoException) {
    const close = fs.close;
    this.failure = failure;
    const replaced = mock.method(fs, "close", (handle: number, callback: CloseCallback): void => {
      this.calls++;
      close(handle, () => callback(this.failure));
    });
    this.restore = () => replaced.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }
}
