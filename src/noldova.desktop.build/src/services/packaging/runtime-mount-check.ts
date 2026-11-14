/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class RuntimeMountCheck {
  private readonly runner: ProcessRunner;
  private readonly readMountsAsync: () => Promise<readonly string[]>;
  private readonly readPublishedAsync: () => Promise<number | null>;
  private readonly output: Writable;

  public constructor(runner: ProcessRunner, readMountsAsync: () => Promise<readonly string[]>, readPublishedAsync: () => Promise<number | null>, output: Writable) {
    this.runner = runner;
    this.readMountsAsync = readMountsAsync;
    this.readPublishedAsync = readPublishedAsync;
    this.output = output;
  }

  public async requireOutlivesAsync(mount: string, runtime: number, moment: string): Promise<void> {
    if (!this.runner.isRunning(runtime))
      return;
    if ((await this.readMountsAsync()).includes(mount)) {
      this.output.write(Resources.formatMountOutlived(moment));
      return;
    }
    if (await this.readPublishedAsync() === runtime)
      throw new BuildException(Resources.formatMountEndedEarly(mount, moment, runtime));
    this.output.write(Resources.formatMountEndedAfterRuntime(runtime, moment));
  }
}
