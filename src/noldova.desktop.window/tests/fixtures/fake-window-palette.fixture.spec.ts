/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPalette } from "@noldova/desktop.window";

import type { FakeMember } from "../types/fake-member";
import { FakeMembersFixture } from "./fake-members.fixture";
import { FakeWindowPalette } from "./fake-window-palette.fixture";

const MEMBERS: Readonly<Record<keyof IWindowPalette<unknown>, FakeMember<IWindowPalette<unknown>>>> = {
  close: ["told", t => t.close()],
  componentRef: ["property", t => t.componentRef],
  closed: ["property", t => t.closed]
};

describe("FakeWindowPalette", () => {
  FakeMembersFixture.check<IWindowPalette<unknown>>(() => new FakeWindowPalette<unknown>(), MEMBERS);
});
