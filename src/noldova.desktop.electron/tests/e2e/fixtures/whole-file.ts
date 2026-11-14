/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rename, writeFile } from "node:fs/promises";

import "@noldova/context.core";

import { ErrorCodeFixture } from "./error-code.fixture.ts";
import { WaitFixture } from "./wait.fixture.ts";

export class WholeFile {
  private static readonly STAGING_SUFFIX: string = ".new";
  private static readonly LOCKED_CODES: readonly string[] = ["EBUSY", "EPERM", "EACCES"];
  private static readonly RENAME_TIMEOUT: number = 1_000;
  private static readonly RENAME_INTERVAL: number = 100;

  public static async writeAsync(file: string, text: string, mode?: number): Promise<void> {
    const staging = `${file}${WholeFile.STAGING_SUFFIX}`;
    await writeFile(staging, text, Object.isUndefined(mode) ? {} : { mode });
    await WholeFile.renameAsync(staging, file);
  }

  public static async renameAsync(from: string, to: string): Promise<void> {
    let locked: unknown = null;
    const isRenamed = await WaitFixture.holdsWithinAsync(async () => {
      try {
        await rename(from, to);
        return true;
      }
      catch (error) {
        if (!WholeFile.LOCKED_CODES.includes(ErrorCodeFixture.of(error) ?? String.empty))
          throw error;
        locked = error;
        return false;
      }
    }, WholeFile.RENAME_TIMEOUT, WholeFile.RENAME_INTERVAL);
    if (!isRenamed)
      throw locked;
  }
}
