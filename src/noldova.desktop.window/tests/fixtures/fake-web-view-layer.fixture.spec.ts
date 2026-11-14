/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewLayer } from "@noldova/desktop.window";

import type { FakeMember } from "../types/fake-member";
import { FakeMembersFixture } from "./fake-members.fixture";
import { FakeWebViewLayer } from "./fake-web-view-layer.fixture";

const MEMBERS: Readonly<Record<keyof IWebViewLayer<unknown>, FakeMember<IWebViewLayer<unknown>>>> = {
  close: ["told", t => t.close()],
  componentRef: ["property", t => t.componentRef],
  closed: ["property", t => t.closed]
};

describe("FakeWebViewLayer", () => {
  FakeMembersFixture.check<IWebViewLayer<unknown>>(() => new FakeWebViewLayer<unknown>(), MEMBERS);
});
