/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";

import { VersionRange } from "../../models/modules/version-range.ts";
import { Resources } from "../../resources.ts";

export class NoldovaDesktopRange {
  private readonly output: Writable;
  private readonly command: string;

  public constructor(output: Writable, command: string) {
    this.output = output;
    this.command = command;
  }

  public runAsync(commandArguments: readonly string[]): Promise<number> {
    const [lowest] = commandArguments;
    if (commandArguments.length !== 1 || Object.isUndefined(lowest)) {
      this.output.write(Resources.formatNoldovaDesktopRangeUsage(this.command));
      return Promise.resolve(Resources.usageExitCode);
    }
    const range = VersionRange.following(lowest);
    if (Object.isNull(range)) {
      this.output.write(Resources.formatNotOneExactVersion(lowest));
      return Promise.resolve(Resources.failureExitCode);
    }
    this.output.write(Resources.formatOutputLine(range.toString()));
    return Promise.resolve(0);
  }
}
