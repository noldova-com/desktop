/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleDatabase } from "@noldova/desktop.runtime";
import { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";

@TestClass
export class FakeModuleDatabaseTests {
  private static readonly MEMBERS: Readonly<Record<keyof IModuleDatabase, FakeMember<IModuleDatabase>>> = {
    read: ["answered", t => t.read("SELECT title FROM notes WHERE id = ?", 1)],
    readAll: ["answered", t => t.readAll("SELECT title FROM notes")],
    run: ["answered", t => t.run("DELETE FROM notes WHERE id = ?", 1)],
    transaction: ["answered", t => t.transaction<number>(() => 3)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeModuleDatabaseTests.MEMBERS), await FakeMembersFixture.observeAsync<IModuleDatabase>(() => new FakeModuleDatabase(), FakeModuleDatabaseTests.MEMBERS));
  }

  @TestMethod
  public runsATransactionThroughTheTestsAnswer(): void {
    const database = new FakeModuleDatabase();
    database.answer("transaction", t => t());

    const result = database.transaction(() => 3);

    Assert.areEqual(3, result);
    Assert.areEqual(1, database.callsOf("transaction").length);
  }
}
