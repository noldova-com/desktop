/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { IconNames } from "@noldova/ui.components.angular";

import { KnownIcon } from "../../../src/app/models/known-icon";

describe("KnownIcon", () => {
  it("knows every one of the kit's icon names", () => {
    expect(IconNames.all.every(t => KnownIcon.isKnown(t))).toBe(true);
  });

  it("keeps a name the kit knows and gives no icon for a missing or unknown name", () => {
    expect([KnownIcon.of("folder"), KnownIcon.of("not_a_kit_icon"), KnownIcon.of(String.empty), KnownIcon.of(null)]).toEqual(["folder", null, null, null]);
  });
});
