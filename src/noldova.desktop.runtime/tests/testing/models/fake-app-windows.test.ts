/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IAppWindows } from "@noldova/desktop.runtime";
import { FakeAppWindows } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";

@TestClass
export class FakeAppWindowsTests {
  private static readonly MEMBERS: Readonly<Record<keyof IAppWindows, FakeMember<IAppWindows>>> = {
    list: ["answered", t => t.list()],
    onChanged: ["registered", t => t.onChanged(() => undefined)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeAppWindowsTests.MEMBERS), await FakeMembersFixture.observeAsync<IAppWindows>(() => new FakeAppWindows(), FakeAppWindowsTests.MEMBERS));
  }

  @TestMethod
  public raisesAChangeUntilTheListenersDisposerRuns(): void {
    const windows = new FakeAppWindows();
    let heard = 0;
    const stop = windows.onChanged(() => heard++);

    windows.raiseChanged();
    stop();
    windows.raiseChanged();

    Assert.areEqual(1, heard);
  }

  @TestMethod
  public skipsARemovedListenerAndKeepsAThrownErrorWithoutStoppingTheRest(): void {
    const windows = new FakeAppWindows();

    const heard = FakeRaisersFixture.heard(listener => windows.onChanged(listener), () => windows.raiseChanged());

    Assert.areEqual("third|fourth", heard);
    Assert.isTrue(windows.errors.length === 1 && windows.errors[0] === FakeRaisersFixture.FAILURE);
  }
}
