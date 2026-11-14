/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SubmenuRow } from "../../../src/app/models/submenu-row";

describe("SubmenuRow", () => {
  it("is a row that opens a submenu, with no icon or context unless it is given them", () => {
    const row = new SubmenuRow("notes.templates", "Templates");
    const given = new SubmenuRow("notes.templates", "Templates", "add", { tabGroup: "3" });

    expect([row.isSubmenu, row.place, row.title, row.icon, row.context, given.icon, given.context]).toEqual([true, "notes.templates", "Templates", null, {}, "add", { tabGroup: "3" }]);
  });
});
