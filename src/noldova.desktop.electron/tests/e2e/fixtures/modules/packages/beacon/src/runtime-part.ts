/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IRuntimePart, type IRuntimePartContext, RuntimeCommand } from "@noldova/desktop.runtime";

export class RuntimePart implements IRuntimePart {
  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    context.registerCommand(new RuntimeCommand("beacon.ping", "Ping", null, null, { handleAsync: async () => ({}) }));
  }

  public async deactivateAsync(): Promise<void> {
  }
}
