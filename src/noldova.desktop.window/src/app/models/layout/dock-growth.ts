/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../../enums/dock-side.js";

export class DockGrowth {
  public readonly id: number;
  public readonly minimum: number;
  public readonly isFitted: boolean;
  public readonly side: DockSide | null;
  public readonly before: number | null;
  public readonly grown: number | null;

  public constructor(id: number, minimum: number, isFitted: boolean = false, side: DockSide | null = null, before: number | null = null,
    grown: number | null = null) {
    this.id = id;
    this.minimum = minimum;
    this.isFitted = isFitted;
    this.side = side;
    this.before = before;
    this.grown = grown;
  }

  public withFitted(side: DockSide | null, before: number | null, grown: number | null): DockGrowth {
    return new DockGrowth(this.id, this.minimum, true, side, before, grown);
  }
}
