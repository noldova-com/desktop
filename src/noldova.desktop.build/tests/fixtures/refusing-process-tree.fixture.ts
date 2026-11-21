/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ProcessTree } from "../../src/services/processes/process-tree.js";

export class RefusingProcessTreeFixture extends ProcessTree {
  public static readonly MESSAGE: string = "kill EPERM";

  public override async endAsync(processId: number | undefined, launched: number, exited: number | null): Promise<void> {
    await super.endAsync(processId, launched, exited);
    throw Object.assign(new Error(RefusingProcessTreeFixture.MESSAGE), { code: "EPERM" });
  }
}
