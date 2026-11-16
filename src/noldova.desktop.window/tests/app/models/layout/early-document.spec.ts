/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EarlyDocument } from "../../../../src/app/models/layout/early-document";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("EarlyDocument", () => {
  it("holds a document the person opened before the layout loaded, whether it opened as a preview, the document it opened after and whether it activates", () => {
    const early = new EarlyDocument(LayoutFixture.plan, true, LayoutFixture.todo, false);

    expect([early.tab, early.isPreview, early.after, early.activates]).toEqual([LayoutFixture.plan, true, LayoutFixture.todo, false]);
    expect([new EarlyDocument(LayoutFixture.plan, false, null, true).after, new EarlyDocument(LayoutFixture.plan, false, null, true).activates]).toEqual([null, true]);
  });
});
