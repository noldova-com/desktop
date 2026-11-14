/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PendingViewChange } from "../../../src/app/models/pending-view-change";

describe("PendingViewChange", () => {
  it("keeps the module, whether it came early, the view it opened and the change it applies", () => {
    const apply = vi.fn();

    const change = new PendingViewChange("notes", true, "notes.outline", apply);
    change.apply();

    expect([change.moduleId, change.isEarly, change.opened]).toEqual(["notes", true, "notes.outline"]);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("keeps a change that opened no view", () => {
    const change = new PendingViewChange("tasks", false, null, () => undefined);

    expect([change.moduleId, change.isEarly, change.opened]).toEqual(["tasks", false, null]);
  });
});
