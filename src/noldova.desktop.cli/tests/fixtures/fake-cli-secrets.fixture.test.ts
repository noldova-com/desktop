/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICliSecrets } from "@noldova/desktop.cli";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FakeCliSecretsFixture } from "./fake-cli-secrets.fixture.js";
import { type FakeMember, FakeMembersFixture } from "./fake-members.fixture.js";

@TestClass
export class FakeCliSecretsFixtureTests {
  private static readonly SIGNAL: AbortSignal = new AbortController().signal;
  private static readonly MEMBERS: Readonly<Record<keyof ICliSecrets, FakeMember<ICliSecrets>>> = {
    saveAsync: ["answered", t => t.saveAsync("notes.syncToken", "token", FakeCliSecretsFixtureTests.SIGNAL)],
    removeAsync: ["answered", t => t.removeAsync("notes.syncToken", FakeCliSecretsFixtureTests.SIGNAL)],
    isSetAsync: ["answered", t => t.isSetAsync("notes.syncToken", FakeCliSecretsFixtureTests.SIGNAL)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeCliSecretsFixtureTests.MEMBERS), await FakeMembersFixture.observeAsync<ICliSecrets>(() => new FakeCliSecretsFixture(), FakeCliSecretsFixtureTests.MEMBERS));
  }
}
