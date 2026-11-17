/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IProcessStarter } from "@noldova/desktop.runtime";

export class ListedStarterFixture implements IProcessStarter {
  public readonly starts: string[] = [];
  private readonly processId: number;

  public constructor(processId: number) {
    this.processId = processId;
  }

  public startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string, workingFolder?: string): Promise<number> {
    this.starts.push(JSON.stringify([executable, launchArguments, environment, errorFile, workingFolder ?? null]));
    return Promise.resolve(this.processId);
  }
}
