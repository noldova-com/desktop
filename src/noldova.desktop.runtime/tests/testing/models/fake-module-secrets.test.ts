/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleSecrets } from "@noldova/desktop.runtime";
import { FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";

@TestClass
export class FakeModuleSecretsTests {
  private static readonly NAME: string = "notes.syncToken";
  private static readonly MEMBERS: Readonly<Record<keyof IModuleSecrets, FakeMember<IModuleSecrets>>> = {
    saveAsync: ["answered", t => t.saveAsync(FakeModuleSecretsTests.NAME, "token-1")],
    readAsync: ["answered", t => t.readAsync(FakeModuleSecretsTests.NAME)],
    removeAsync: ["answered", t => t.removeAsync(FakeModuleSecretsTests.NAME)],
    isSetAsync: ["answered", t => t.isSetAsync(FakeModuleSecretsTests.NAME)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeModuleSecretsTests.MEMBERS), await FakeMembersFixture.observeAsync<IModuleSecrets>(() => new FakeModuleSecrets(), FakeModuleSecretsTests.MEMBERS));
  }
}
