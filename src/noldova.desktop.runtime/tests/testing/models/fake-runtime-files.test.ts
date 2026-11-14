/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RequestContext } from "@noldova/desktop.runtime";
import type { IRuntimeFiles } from "@noldova/desktop.runtime";
import { FakeRuntimeFiles } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";

@TestClass
export class FakeRuntimeFilesTests {
  private static readonly REQUEST: RequestContext = new RequestContext("main", null, new AbortController().signal, 3);
  private static readonly MEMBERS: Readonly<Record<keyof IRuntimeFiles, FakeMember<IRuntimeFiles>>> = {
    redeemAsync: ["answered", t => t.redeemAsync("grant-1", FakeRuntimeFilesTests.REQUEST)],
    shareAsync: ["answered", t => t.shareAsync("notes.md", FakeRuntimeFilesTests.REQUEST)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeRuntimeFilesTests.MEMBERS), await FakeMembersFixture.observeAsync<IRuntimeFiles>(() => new FakeRuntimeFiles(), FakeRuntimeFilesTests.MEMBERS));
  }
}
