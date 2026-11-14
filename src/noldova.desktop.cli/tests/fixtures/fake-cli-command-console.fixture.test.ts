/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICliCommandConsole } from "@noldova/desktop.cli";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FakeCliCommandConsoleFixture } from "./fake-cli-command-console.fixture.js";
import { type FakeMember, FakeMembersFixture } from "./fake-members.fixture.js";
import { FakeRaisersFixture } from "./fake-raisers.fixture.js";

@TestClass
export class FakeCliCommandConsoleFixtureTests {
  private static readonly MEMBERS: Readonly<Record<keyof ICliCommandConsole, FakeMember<ICliCommandConsole>>> = {
    writeLine: ["told", t => t.writeLine("Synced.")],
    askAsync: ["answered", t => t.askAsync("Sync now?")],
    onEvent: ["registered", t => t.onEvent("notes.done", () => undefined)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeCliCommandConsoleFixtureTests.MEMBERS), await FakeMembersFixture.observeAsync<ICliCommandConsole>(() => new FakeCliCommandConsoleFixture(), FakeCliCommandConsoleFixtureTests.MEMBERS));
  }

  @TestMethod
  public raisesAnEventToTheListenersOfItsNameUntilTheirDisposableIsDisposed(): void {
    const commandConsole = new FakeCliCommandConsoleFixture();
    const heard: string[] = [];
    const listening = commandConsole.onEvent("notes.done", t => heard.push(`done ${JSON.stringify(t)}`));
    commandConsole.onEvent("notes.other", t => heard.push(`other ${JSON.stringify(t)}`));

    commandConsole.raiseEvent("notes.done", 1);
    listening[Symbol.dispose]();
    commandConsole.raiseEvent("notes.done", 2);

    Assert.areEqual("done 1", heard.join("|"));
  }

  @TestMethod
  public stillCallsARemovedListenerAndStopsAtOneThatThrowsAsTheCommandLineDoes(): void {
    const commandConsole = new FakeCliCommandConsoleFixture();

    const heard = FakeRaisersFixture.heard(listener => {
      const registration = commandConsole.onEvent("notes.done", listener);
      return () => registration[Symbol.dispose]();
    }, () => commandConsole.raiseEvent("notes.done", 1));

    Assert.areEqual("removed|third|threw", heard);
    Assert.areEqual(0, commandConsole.errors.length);
  }
}
