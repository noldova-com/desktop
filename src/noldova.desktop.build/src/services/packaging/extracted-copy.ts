/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

import type { ISmokeCopy } from "../../interfaces/i-smoke-copy.ts";

export class ExtractedCopy implements ISmokeCopy {
  public readonly items: readonly string[];

  public constructor(record: string, extraction: string) {
    this.items = [record, extraction];
  }

  public isPresentAsync(): Promise<boolean> {
    return Promise.resolve(this.items.some(t => existsSync(t)));
  }

  public requireOutlivesAsync(): Promise<void> {
    return Promise.resolve();
  }

  public checkKilledAsync(): Promise<void> {
    return Promise.resolve();
  }
}
