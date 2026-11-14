/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewAction, WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";

@TestClass
export class FakeRuntimeWebViewsTests {
  private static readonly VIEW: string = "view-1";
  private static readonly MEMBERS: Readonly<Record<keyof IRuntimeWebViews, FakeMember<IRuntimeWebViews>>> = {
    relay: ["fake", t => t.relay],
    list: ["answered", t => t.list()],
    navigateAsync: ["answered", t => t.navigateAsync(FakeRuntimeWebViewsTests.VIEW, "https://example.com/")],
    actAsync: ["answered", t => t.actAsync(FakeRuntimeWebViewsTests.VIEW, WebViewAction.Back)],
    setAllowedOriginsAsync: ["answered", t => t.setAllowedOriginsAsync(FakeRuntimeWebViewsTests.VIEW, ["https://example.com"])],
    clearProfileAsync: ["answered", t => t.clearProfileAsync("notes.preview")],
    onViewEvent: ["registered", t => t.onViewEvent(() => undefined)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeRuntimeWebViewsTests.MEMBERS), await FakeMembersFixture.observeAsync<IRuntimeWebViews>(() => new FakeRuntimeWebViews(), FakeRuntimeWebViewsTests.MEMBERS));
  }

  @TestMethod
  public raisesAViewEventUntilTheListenersDisposerRuns(): void {
    const webViews = new FakeRuntimeWebViews();
    const heard: string[] = [];
    const stop = webViews.onViewEvent(t => heard.push(t.kind));

    webViews.raiseViewEvent(new WebViewEvent("notes", "view-1", WebViewEventKind.Closed));
    stop();
    webViews.raiseViewEvent(new WebViewEvent("notes", "view-1", WebViewEventKind.Closed));

    Assert.areEqual("Closed", heard.join("|"));
  }

  @TestMethod
  public stillCallsARemovedListenerAndKeepsAThrownErrorWithoutStoppingTheRest(): void {
    const webViews = new FakeRuntimeWebViews();

    const heard = FakeRaisersFixture.heard(listener => webViews.onViewEvent(listener), () => webViews.raiseViewEvent(new WebViewEvent("notes", "view-1", WebViewEventKind.Closed)));

    Assert.areEqual("removed|third|fourth", heard);
    Assert.isTrue(webViews.errors.length === 1 && webViews.errors[0] === FakeRaisersFixture.FAILURE);
  }

  @TestMethod
  public makesItsRelayStrictWithItself(): void {
    const webViews = new FakeRuntimeWebViews();
    webViews.beStrict();

    Assert.areEqual("onViewEvent", Assert.throws(() => webViews.onViewEvent(() => undefined), UnansweredCallException).member);
    Assert.areEqual("onProtocolEvent", Assert.throws(() => webViews.relay.onProtocolEvent("notes.view", () => undefined), UnansweredCallException).member);
  }
}
