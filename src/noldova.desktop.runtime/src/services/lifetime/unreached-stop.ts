/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IIdleParticipant } from "../../interfaces/i-idle-participant.js";

export class UnreachedStop implements IIdleParticipant {
  private readonly stop: () => void;

  public constructor(stop: () => void) {
    this.stop = stop;
  }

  public get isIdle(): boolean {
    return true;
  }

  public handleIdle(): void {
    this.stop();
  }
}
