/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { UnknownIconsService } from "../../../src/app/services/unknown-icons.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("UnknownIconsService", () => {
  afterEach(() => PreloadBridgeFixture.remove());

  it("logs an icon name the kit doesn't know once for each module, and nothing for a known or missing name", () => {
    const bridge = PreloadBridgeFixture.install();
    const icons = TestBed.inject(UnknownIconsService);

    icons.note("notes", "not_a_kit_icon");
    icons.note("notes", "not_a_kit_icon");
    icons.note("clock", "not_a_kit_icon");
    icons.note("notes", "folder");
    icons.note("notes", null);
    icons.note("notes", "another_unknown");

    expect(bridge.logged).toEqual([
      "notes: The icon not_a_kit_icon isn't one of the kit's icon names, so it shows no icon.",
      "clock: The icon not_a_kit_icon isn't one of the kit's icon names, so it shows no icon.",
      "notes: The icon another_unknown isn't one of the kit's icon names, so it shows no icon."
    ]);
  });
});
