/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { WindowsEnvironment } from "../../../src/services/environment/windows-environment.js";
import { LineProcessFixture } from "../../fixtures/line-process.fixture.js";
import { LineProcessStarterFixture } from "../../fixtures/line-process-starter.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class WindowsEnvironmentTests {
  private static readonly INHERITED: Readonly<Record<string, string>> = { SystemRoot: "C:\\Windows", Path: "C:\\Windows\\system32", TEMP: "C:\\Temp", OLD: "kept" };
  private static readonly UNREAD: string = "Programs start with the last environment read, or the app's own, since the person's current environment could not be read: ";
  private static readonly DROPPED: string = "Windows PowerShell wrote a line that answers no read of the environment under way, so it was dropped.\n";
  private static readonly INVALID: string = "Windows PowerShell did not write the machine's and the person's variables as text.";

  @TestMethod
  public async startsWindowsPowerShellFromTheSystemFolderWithTheEncodedScriptAndAsksOnceForARead(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, new TextOutputFixture());

    const reading = source.readAsync();
    const child = starter.last;
    const script = Buffer.from(child.launchArguments.at(-1) ?? String.empty, "base64").toString("utf16le");
    child.reply({}, {});
    await reading;

    Assert.areEqual("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", child.file);
    Assert.areEqual("-NoLogo,-NoProfile,-NonInteractive,-EncodedCommand", child.launchArguments.slice(0, -1).join(","));
    Assert.isTrue(script.includes("[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')"));
    Assert.isTrue(script.includes("SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"));
    Assert.areEqual(JSON.stringify(WindowsEnvironmentTests.INHERITED), JSON.stringify(child.environment));
    Assert.areEqual("1", child.written.join(","));
  }

  @TestMethod
  public async laysTheMachinesAndThenThePersonsVariablesOverTheInheritedOnesExpandedAsWindowsDoesWithBothPathsJoined(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, new TextOutputFixture());

    const reading = source.readAsync();
    starter.last.reply(
      { PATH: ["%SystemRoot%\\system32;C:\\Tools", true], TOOLS: ["C:\\Tools", false], temp: ["%TOOLS%\\temp", true] },
      { Path: ["%USERPROFILE%\\bin", true], USERPROFILE: ["C:\\Users\\person", false], LITERAL: ["100%", false], UNKNOWN: ["%NOT_SET%\\x%", true] });
    const environment = await reading;

    Assert.areEqual(JSON.stringify({
      SystemRoot: "C:\\Windows", PATH: "C:\\Windows\\system32;C:\\Tools;C:\\Users\\person\\bin", temp: "C:\\Tools\\temp", OLD: "kept", TOOLS: "C:\\Tools",
      USERPROFILE: "C:\\Users\\person", LITERAL: "100%", UNKNOWN: "%NOT_SET%\\x%"
    }), JSON.stringify(environment));
  }

  @TestMethod
  public async sharesAReadUnderWayAndAsksAgainForTheNextCallThroughTheSameWindowsPowerShell(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, new TextOutputFixture());

    const first = source.readAsync();
    const shared = source.readAsync();
    starter.last.reply(LineProcessFixture.plain({ ADDED: "first" }), {});
    const firstEnvironment = await first;
    const sharedEnvironment = await shared;
    const second = source.readAsync();
    starter.last.reply(LineProcessFixture.plain({ ADDED: "second" }), {});
    const secondEnvironment = await second;

    Assert.areEqual(first, shared);
    Assert.areEqual("first", firstEnvironment["ADDED"]);
    Assert.areEqual(firstEnvironment, sharedEnvironment);
    Assert.areEqual("second", secondEnvironment["ADDED"]);
    Assert.areEqual(1, starter.started.length);
    Assert.areEqual("1,2", starter.last.written.join(","));
  }

  @TestMethod
  public async dropsALineThatAnswersNoReadUnderWayAndWaitsOnForItsOwnAnswer(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const diagnostics = new TextOutputFixture();
    const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, diagnostics);

    const reading = source.readAsync();
    starter.last.line("WARNING: a line that isn't an answer");
    starter.last.line(LineProcessFixture.encode({ id: "7", machine: {}, user: {} }));
    const isWaiting = await WaitFixture.isPendingAsync(reading);
    starter.last.reply({}, LineProcessFixture.plain({ ADDED: "own" }));
    const environment = await reading;

    Assert.isTrue(isWaiting);
    Assert.areEqual("own", environment["ADDED"]);
    Assert.areEqual(`${WindowsEnvironmentTests.DROPPED}${WindowsEnvironmentTests.DROPPED}`, diagnostics.text);
  }

  @TestMethod
  public async givesTheInheritedEnvironmentAndSaysWhyWhenTheAnswersVariablesAreNotText(): Promise<void> {
    for (const [machine, user] of [[{ PATH: ["C:\\Tools", "yes"] }, {}], [{}, []], [{ PATH: ["C:\\Tools"] }, {}], [{ PATH: "C:\\Tools" }, {}], [null, {}]] as const) {
      const starter = new LineProcessStarterFixture();
      const diagnostics = new TextOutputFixture();
      const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, diagnostics);

      const reading = source.readAsync();
      starter.last.line(LineProcessFixture.encode({ id: "1", machine, user }));
      const environment = await reading;

      Assert.areEqual(WindowsEnvironmentTests.INHERITED, environment);
      Assert.areEqual(`${WindowsEnvironmentTests.UNREAD}${WindowsEnvironmentTests.INVALID}\n`, diagnostics.text);
    }
  }

  @TestMethod
  public async replacesAWindowsPowerShellThatDoesNotAnswerInTimeAndGivesTheInheritedEnvironmentMeanwhile(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const diagnostics = new TextOutputFixture();
    const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, diagnostics, 20);

    const environment = await source.readAsync();
    const [first, second] = starter.started;
    first?.reply(LineProcessFixture.plain({ ADDED: "late" }), {});
    const next = source.readAsync();
    second?.reply(LineProcessFixture.plain({ ADDED: "next" }), {});
    const nextEnvironment = await next;

    Assert.areEqual(WindowsEnvironmentTests.INHERITED, environment);
    Assert.areEqual(2, starter.started.length);
    Assert.areEqual(1, first?.kills);
    Assert.areEqual("next", nextEnvironment["ADDED"]);
    Assert.areEqual(`${WindowsEnvironmentTests.UNREAD}Windows PowerShell did not answer within 0.02 seconds.\n`, diagnostics.text);
  }

  @TestMethod
  public async replacesAWindowsPowerShellThatEndsDuringAReadAndStartsAnotherForTheNextReadAfterOneEndsWhileIdle(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const diagnostics = new TextOutputFixture();
    const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, diagnostics);

    const reading = source.readAsync();
    starter.last.exit("powershell.exe exited with 1.");
    const environment = await reading;
    const replacement = starter.last;
    replacement.exit("powershell.exe exited with 0.");
    const next = source.readAsync();
    starter.last.reply({}, {});
    await next;

    Assert.areEqual(WindowsEnvironmentTests.INHERITED, environment);
    Assert.areEqual(3, starter.started.length);
    Assert.areNotEqual(replacement, starter.last);
    Assert.areEqual(`${WindowsEnvironmentTests.UNREAD}powershell.exe exited with 1.\n`, diagnostics.text);
  }

  @TestMethod
  public async startsNothingAndSaysWhyWhenSystemRootIsNotSet(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const diagnostics = new TextOutputFixture();
    const inherited = { Path: "C:\\Windows\\system32" };
    const source = new WindowsEnvironment(inherited, starter, diagnostics);

    const environment = await source.readAsync();

    Assert.areEqual(inherited, environment);
    Assert.areEqual(0, starter.started.length);
    Assert.areEqual(`${WindowsEnvironmentTests.UNREAD}SystemRoot is not set, so Windows PowerShell can't be found.\n`, diagnostics.text);
  }

  @TestMethod
  public async endsItsWindowsPowerShellAndGivesTheInheritedEnvironmentOnceEnded(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const diagnostics = new TextOutputFixture();
    const source = new WindowsEnvironment(WindowsEnvironmentTests.INHERITED, starter, diagnostics);

    const reading = source.readAsync();
    const child = starter.last;
    source.end();
    const environment = await reading;
    child.exit("powershell.exe exited with null.");
    const ended = await source.readAsync();
    source.end();

    Assert.areEqual(WindowsEnvironmentTests.INHERITED, environment);
    Assert.areEqual(WindowsEnvironmentTests.INHERITED, ended);
    Assert.areEqual(1, child.kills);
    Assert.areEqual(1, starter.started.length);
    Assert.areEqual(String.empty, diagnostics.text);
  }
}
