/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewProtocolEvent } from "@noldova/desktop.runtime";
import type { IWebViewRelay } from "@noldova/desktop.runtime";
import { FakeWebViewRelay } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";

@TestClass
export class FakeWebViewRelayTests {
  private static readonly VIEW: string = "view-1";
  private static readonly MEMBERS: Readonly<Record<keyof IWebViewRelay, FakeMember<IWebViewRelay>>> = {
    sendAsync: ["answered", t => t.sendAsync(FakeWebViewRelayTests.VIEW, "Page.reload", {}, 5_000)],
    onProtocolEvent: ["registered", t => t.onProtocolEvent(FakeWebViewRelayTests.VIEW, () => undefined)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeWebViewRelayTests.MEMBERS), await FakeMembersFixture.observeAsync<IWebViewRelay>(() => new FakeWebViewRelay(), FakeWebViewRelayTests.MEMBERS));
  }

  @TestMethod
  public raisesAProtocolEventToTheListenersOfItsViewOnly(): void {
    const relay = new FakeWebViewRelay();
    const heard: string[] = [];
    relay.onProtocolEvent("view-1", t => heard.push(`one ${t.method}`));
    relay.onProtocolEvent("view-2", t => heard.push(`two ${t.method}`));

    relay.raiseProtocolEvent("view-1", new WebViewProtocolEvent("view-1", "Page.loadEventFired", {}, false));

    Assert.areEqual("one Page.loadEventFired", heard.join("|"));
  }

  @TestMethod
  public stillCallsARemovedListenerAndKeepsAThrownErrorWithoutStoppingTheRest(): void {
    const relay = new FakeWebViewRelay();

    const heard = FakeRaisersFixture.heard(listener => relay.onProtocolEvent("view-1", listener), () => relay.raiseProtocolEvent("view-1", new WebViewProtocolEvent("view-1", "Page.loadEventFired", {}, false)));

    Assert.areEqual("removed|third|fourth", heard);
    Assert.isTrue(relay.errors.length === 1 && relay.errors[0] === FakeRaisersFixture.FAILURE);
  }
}
