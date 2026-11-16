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

export class LinuxLaunchFixture implements Disposable {
  private static readonly PATHS: readonly string[] = ["/bin/bash", "/proc/self/fd"];

  private readonly access: typeof fs.access = fs.access;
  private readonly restoreReaddir: () => void;

  public constructor() {
    const { access } = this;
    const readdir = fs.readdir;
    fs.access = (target, mode) => LinuxLaunchFixture.PATHS.includes(String(target)) ? Promise.resolve() : access(target, mode);
    const reading = mock.method(fs, "readdir", (...values: Parameters<typeof fs.readdir>) =>
      LinuxLaunchFixture.PATHS.includes(String(values[0])) ? Promise.resolve([]) : readdir(...values));
    this.restoreReaddir = () => reading.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.access = this.access;
    this.restoreReaddir();
    syncBuiltinESMExports();
  }
}
