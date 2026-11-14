/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { renameSync } from "node:fs";

import { ErrorCodeFixture } from "./error-code.fixture.js";

export class RenameRetryFixture {
  public static readonly HELD_CODES: readonly string[] = ["EPERM", "EACCES", "EBUSY"];
  public static readonly ATTEMPTS: number = 40;
  public static readonly DELAY: number = 50;

  private readonly renameFile: (from: string, to: string) => void;
  private readonly pause: Int32Array = new Int32Array(new SharedArrayBuffer(4));

  public constructor(renameFile: (from: string, to: string) => void = renameSync) {
    this.renameFile = renameFile;
  }

  public static renameSync(from: string, to: string): void {
    new RenameRetryFixture().renameSync(from, to);
  }

  public renameSync(from: string, to: string): void {
    for (let attempt = 1; ; attempt++) {
      try {
        this.renameFile(from, to);
        return;
      }
      catch (error) {
        if (attempt >= RenameRetryFixture.ATTEMPTS || !RenameRetryFixture.HELD_CODES.includes(String(ErrorCodeFixture.of(error))))
          throw error;
      }
      Atomics.wait(this.pause, 0, 0, RenameRetryFixture.DELAY);
    }
  }
}
