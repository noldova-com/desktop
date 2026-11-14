/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SystemCommand } from "@noldova/desktop.runtime";

export class SystemCommandFixture extends SystemCommand {
  private readonly outputs: (string | Error | ((commandArguments: readonly string[]) => Promise<string>))[];

  public readonly calls: (readonly string[])[] = [];
  public readonly environments: (NodeJS.ProcessEnv | undefined)[] = [];
  public readonly timeouts: (number | undefined)[] = [];

  public constructor(outputs: readonly (string | Error | ((commandArguments: readonly string[]) => Promise<string>))[]) {
    super();

    this.outputs = [...outputs];
  }

  public override async runAsync(file: string, commandArguments: readonly string[], environment?: NodeJS.ProcessEnv, timeoutMilliseconds?: number): Promise<string> {
    this.calls.push([file, ...commandArguments]);
    this.environments.push(environment);
    this.timeouts.push(timeoutMilliseconds);
    const output = this.outputs.shift() ?? String.empty;
    if (output instanceof Error)
      throw output;
    return Object.isFunction(output) ? await output(commandArguments) : output;
  }
}
