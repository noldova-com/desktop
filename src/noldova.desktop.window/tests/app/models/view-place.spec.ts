/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewPlace } from "../../../src/app/models/view-place";

describe("ViewPlace", () => {
  it("is the same place only for the same view, instance and place", () => {
    const place = new ViewPlace("terminal.shell", "1", "/home");

    expect([
      place.equals(new ViewPlace("terminal.shell", "1", "/home")),
      place.equals(new ViewPlace("files.tree", "1", "/home")),
      place.equals(new ViewPlace("terminal.shell", "2", "/home")),
      place.equals(new ViewPlace("terminal.shell", null, "/home")),
      place.equals(new ViewPlace("terminal.shell", "1", "/tmp")),
      place.equals(new DocumentTab("terminal.shell", "1")),
      place.equals(undefined)
    ]).toEqual([true, false, false, false, false, false, false]);
  });

  it("names the tab of its view's instance, or of the view without instances", () => {
    expect([new ViewPlace("terminal.shell", "1", "/home").tab, new ViewPlace("files.tree", null, "a").tab]).toEqual([new ViewTab("terminal.shell", "1"), new ViewTab("files.tree")]);
  });
});
