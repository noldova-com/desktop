/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProcessRunner } from "../../../../src/noldova.desktop.build/src/services/processes/process-runner.ts";

export class RecordingRunner extends ProcessRunner {
  public readonly calls: (readonly string[])[] = [];

  public override runAsync(command: string, commandArguments: readonly string[], directory: string): Promise<number | null> {
    this.calls.push([command, ...commandArguments, directory]);
    return Promise.resolve(0);
  }
}
