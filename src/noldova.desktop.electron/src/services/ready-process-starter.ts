/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IProcessStarter } from "@noldova/desktop.runtime";

export class ReadyProcessStarter implements IProcessStarter {
  private readonly starter: IProcessStarter;
  private readonly whenReady: () => Promise<unknown>;

  public constructor(starter: IProcessStarter, whenReady: () => Promise<unknown>) {
    this.starter = starter;
    this.whenReady = whenReady;
  }

  public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string, workingFolder?: string): Promise<number> {
    await this.whenReady();
    return await this.starter.startAsync(executable, launchArguments, environment, errorFile, workingFolder);
  }
}
