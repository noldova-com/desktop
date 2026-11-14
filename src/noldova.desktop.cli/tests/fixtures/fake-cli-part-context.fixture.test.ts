/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import type { ICliCommandHandler, ICliPartContext } from "@noldova/desktop.cli";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FakeCliPartContextFixture } from "./fake-cli-part-context.fixture.js";
import { type FakeMember, FakeMembersFixture } from "./fake-members.fixture.js";

@TestClass
export class FakeCliPartContextFixtureTests {
  private static readonly HANDLER: ICliCommandHandler = { handleAsync: values => Promise.resolve(new CliCommandResult(values, "Done.")) };
  private static readonly MEMBERS: Readonly<Record<keyof ICliPartContext, FakeMember<ICliPartContext>>> = {
    secrets: ["fake", t => t.secrets],
    registerCommand: ["told", t => t.registerCommand("sync", FakeCliPartContextFixtureTests.HANDLER)],
    requestAsync: ["answered", t => t.requestAsync("notes.sync", null, new AbortController().signal)],
    moduleId: ["property", t => t.moduleId]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeCliPartContextFixtureTests.MEMBERS), await FakeMembersFixture.observeAsync<ICliPartContext>(() => new FakeCliPartContextFixture(), FakeCliPartContextFixtureTests.MEMBERS));
  }

  @TestMethod
  public refusesWhenStrictAnUnansweredCommandRegistration(): void {
    const context = new FakeCliPartContextFixture();
    context.beStrict();

    Assert.areEqual("registerCommand", Assert.throws(() => context.registerCommand("sync", FakeCliPartContextFixtureTests.HANDLER), UnansweredCallException).member);
  }
}
