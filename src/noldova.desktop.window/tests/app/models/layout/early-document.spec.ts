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
  it("holds a document the person opened before the layout loaded, whether it opened as a preview and the document it opened after", () => {
    const early = new EarlyDocument(LayoutFixture.plan, true, LayoutFixture.todo);

    expect([early.tab, early.isPreview, early.after]).toEqual([LayoutFixture.plan, true, LayoutFixture.todo]);
    expect(new EarlyDocument(LayoutFixture.plan, false, null).after).toBeNull();
  });
});
