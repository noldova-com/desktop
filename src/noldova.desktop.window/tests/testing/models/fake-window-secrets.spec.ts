/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowSecrets } from "@noldova/desktop.window";
import { FakeWindowSecrets } from "@noldova/desktop.window/testing";

import { FakeMembersFixture } from "../../fixtures/fake-members.fixture";
import type { FakeMember } from "../../types/fake-member";

const MEMBERS: Readonly<Record<keyof IWindowSecrets, FakeMember<IWindowSecrets>>> = {
  saveAsync: ["answered", t => t.saveAsync("token", "secret-value")],
  removeAsync: ["answered", t => t.removeAsync("token")],
  isSetAsync: ["answered", t => t.isSetAsync("token")]
};

describe("FakeWindowSecrets", () => {
  FakeMembersFixture.check<IWindowSecrets>(() => new FakeWindowSecrets(), MEMBERS);
});
