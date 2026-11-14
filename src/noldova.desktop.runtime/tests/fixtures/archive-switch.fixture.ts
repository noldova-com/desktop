/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

export class ArchiveSwitchFixture implements Disposable {
  private static readonly SWITCH: string = "noAsar";

  public readonly changes: string[] = [];

  public constructor(watched: string) {
    Object.defineProperty(process, ArchiveSwitchFixture.SWITCH, {
      configurable: true,
      get: (): undefined => undefined,
      set: (value: unknown): void => {
        this.changes.push(`${String(value)} ${existsSync(watched) ? "before" : "after"}`);
      }
    });
  }

  public [Symbol.dispose](): void {
    Reflect.deleteProperty(process, ArchiveSwitchFixture.SWITCH);
  }
}
