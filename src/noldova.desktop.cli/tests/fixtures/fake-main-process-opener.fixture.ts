/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IMainProcessOpener } from "@noldova/desktop.cli";

export class FakeMainProcessOpenerFixture implements IMainProcessOpener {
  public readonly opened: { executable: string; launchArguments: readonly string[]; environment: NodeJS.ProcessEnv }[] = [];
  public failure: Error | null = null;

  public openAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<void> {
    if (!Object.isNull(this.failure))
      return Promise.reject(this.failure);
    this.opened.push({ executable, launchArguments, environment });
    return Promise.resolve();
  }
}
