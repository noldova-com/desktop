/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { DockGrowth } from "../../../../src/app/models/layout/dock-growth";

describe("DockGrowth", () => {
  it("starts unfitted, with no side and no sizes, when only its id and minimum are given", () => {
    const growth = new DockGrowth(7, 120);

    expect([growth.id, growth.minimum, growth.isFitted, growth.side, growth.before, growth.grown]).toEqual([7, 120, false, null, null, null]);
  });

  it("keeps every value it is given", () => {
    const growth = new DockGrowth(7, 120, true, DockSide.Bottom, 200, 260);

    expect([growth.id, growth.minimum, growth.isFitted, growth.side, growth.before, growth.grown]).toEqual([7, 120, true, DockSide.Bottom, 200, 260]);
  });

  it("is fitted as a new growth with the same id and minimum, leaving itself as it was", () => {
    const growth = new DockGrowth(7, 120);

    const fitted = growth.withFitted(DockSide.Left, 180, 240);
    const unsided = growth.withFitted(null, null, null);

    expect([fitted.id, fitted.minimum, fitted.isFitted, fitted.side, fitted.before, fitted.grown]).toEqual([7, 120, true, DockSide.Left, 180, 240]);
    expect([unsided.isFitted, unsided.side, unsided.before, unsided.grown]).toEqual([true, null, null, null]);
    expect([growth.isFitted, growth.side]).toEqual([false, null]);
  });
});
