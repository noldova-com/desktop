/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPalette } from "@noldova/desktop.window";

import { FakeMember } from "../models/fake-member";
import { FakeMembersFixture } from "./fake-members.fixture";
import { FakeWindowPalette } from "./fake-window-palette.fixture";

const MEMBERS: Readonly<Record<keyof IWindowPalette<unknown>, FakeMember<IWindowPalette<unknown>>>> = {
  close: FakeMember.told(t => t.close()),
  componentRef: FakeMember.property(t => t.componentRef),
  closed: FakeMember.property(t => t.closed)
};

describe("FakeWindowPalette", () => {
  FakeMembersFixture.check<IWindowPalette<unknown>>(() => new FakeWindowPalette<unknown>(), MEMBERS);
});
