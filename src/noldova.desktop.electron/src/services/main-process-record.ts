/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Installation, ProcessPresence } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class MainProcessRecord {
  public static async recordAsync(installation: Pick<Installation, "recordMainProcessAsync">, presence: Pick<ProcessPresence, "stampAsync">, processId: number): Promise<boolean> {
    const [mainProcess] = await presence.stampAsync([[processId, Resources.clientName]]);
    if (Object.isUndefined(mainProcess))
      return false;
    await installation.recordMainProcessAsync(mainProcess);
    return true;
  }
}
