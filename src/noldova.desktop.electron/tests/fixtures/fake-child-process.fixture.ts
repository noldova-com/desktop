/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChildProcess } from "node:child_process";

export class FakeChildProcess extends ChildProcess {
  private static readonly SPAWN_EVENT: string = "spawn";

  public override readonly pid: number;

  public constructor(processId: number) {
    super();
    this.pid = processId;
    process.nextTick(() => this.emit(FakeChildProcess.SPAWN_EVENT));
  }

  public override unref(): void {
    return undefined;
  }
}
