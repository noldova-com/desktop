/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";

@TestClass
export class FakeModuleLogTests {
  private static readonly MEMBERS: Readonly<Record<keyof IModuleLog, FakeMember<IModuleLog>>> = {
    write: ["told", t => t.write("Saved the notes.")]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeModuleLogTests.MEMBERS), await FakeMembersFixture.observeAsync<IModuleLog>(() => new FakeModuleLog(), FakeModuleLogTests.MEMBERS));
  }
}
