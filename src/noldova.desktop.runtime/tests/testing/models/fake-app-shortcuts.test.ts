/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyChord } from "@noldova/desktop.protocol";
import type { IAppShortcuts } from "@noldova/desktop.runtime";
import { FakeAppShortcuts } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";

@TestClass
export class FakeAppShortcutsTests {
  private static readonly MEMBERS: Readonly<Record<keyof IAppShortcuts, FakeMember<IAppShortcuts>>> = {
    list: ["answered", t => t.list()],
    has: ["answered", t => t.has(KeyChord.parse("Mod+K"))],
    onChanged: ["registered", t => t.onChanged(() => undefined)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeAppShortcutsTests.MEMBERS), await FakeMembersFixture.observeAsync<IAppShortcuts>(() => new FakeAppShortcuts(), FakeAppShortcutsTests.MEMBERS));
  }

  @TestMethod
  public raisesAChangeUntilTheListenersDisposerRuns(): void {
    const shortcuts = new FakeAppShortcuts();
    let heard = 0;
    const stop = shortcuts.onChanged(() => heard++);

    shortcuts.raiseChanged();
    stop();
    shortcuts.raiseChanged();

    Assert.areEqual(1, heard);
  }

  @TestMethod
  public skipsARemovedListenerAndKeepsAThrownErrorWithoutStoppingTheRest(): void {
    const shortcuts = new FakeAppShortcuts();

    const heard = FakeRaisersFixture.heard(listener => shortcuts.onChanged(listener), () => shortcuts.raiseChanged());

    Assert.areEqual("third|fourth", heard);
    Assert.isTrue(shortcuts.errors.length === 1 && shortcuts.errors[0] === FakeRaisersFixture.FAILURE);
  }
}
