/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import childProcess, { type ChildProcess, type SpawnOptions } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

import { FakeChildProcess } from "./fake-child-process.fixture.js";

export class SpawnPatchFixture implements Disposable {
  public static readonly PROCESS_ID: number = 4321;

  private readonly restore: () => void;

  public readonly options: SpawnOptions[] = [];

  public constructor() {
    const spawning = mock.method(childProcess, "spawn", (_command: string, _arguments: readonly string[], options: SpawnOptions): ChildProcess => {
      this.options.push(options);
      return new FakeChildProcess(SpawnPatchFixture.PROCESS_ID);
    });
    this.restore = () => spawning.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }
}
