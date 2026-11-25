/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";
import type { IWindowWebViews } from "@noldova/desktop.window";
import { FakeWindowWebViews } from "@noldova/desktop.window/testing";

import { FakeMembersFixture } from "../../fixtures/fake-members.fixture";
import { FakeMember } from "../../models/fake-member";

const MEMBERS: Readonly<Record<keyof IWindowWebViews, FakeMember<IWindowWebViews>>> = {
  openAsync: FakeMember.answered(t => t.openAsync(new WebViewPane(QualifiedName.parse("notes.list")), "workspace-1"))
};

describe("FakeWindowWebViews", () => {
  FakeMembersFixture.check<IWindowWebViews>(() => new FakeWindowWebViews(), MEMBERS);
});
