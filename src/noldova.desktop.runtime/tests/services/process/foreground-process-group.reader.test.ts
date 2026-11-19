/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  CommandFailedException,
  ForegroundGroupReadFailedException,
  ForegroundGroupUnreadableException,
  SystemCommand,
  type SystemCommandException
} from "@noldova/desktop.runtime";

import { ForegroundProcessGroupReader } from "../../../src/services/process/foreground-process-group.reader.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

class AnsweringCommand extends SystemCommand {
  private readonly answer: () => Promise<string>;

  public readonly calls: string[] = [];

  public constructor(answer: () => Promise<string>) {
    super();
    this.answer = answer;
  }

  public override runAsync(file: string, commandArguments: readonly string[], environment: NodeJS.ProcessEnv = {}, timeoutMilliseconds: number = 0): Promise<string> {
    this.calls.push(`${[file, ...commandArguments].join(" ")} LC_ALL=${environment["LC_ALL"]} kept=${Object.keys(process.env).every(t => Object.hasOwn(environment, t))} ${timeoutMilliseconds}`);
    return this.answer();
  }
}

@TestClass
export class ForegroundProcessGroupReaderTests {
  private static readonly ENDED_PROCESS_ID: number = 2_147_483_644;
  private static readonly FOLDER: string = path.join(path.sep, "proc");
  private static readonly START: string = "Tue Nov  3 09:04:05 2026";
  private static readonly STARTED: Date = new Date(Date.parse(ForegroundProcessGroupReaderTests.START) + 300);

  private static stat(group: string, session: string = "4120"): string {
    return `4120 (a) b) S 1 4120 ${session} 34816 ${group} 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0`;
  }

  private static status(group: string, start: string = ForegroundProcessGroupReaderTests.START): string {
    return `${start}  ${group} /bin/bash\n`;
  }

  private static linux(stat: string): ForegroundProcessGroupReader {
    return new ForegroundProcessGroupReader("linux", new AnsweringCommand(async () => String.empty), ForegroundProcessGroupReaderTests.FOLDER, async () => stat);
  }

  private static mac(status: string): ForegroundProcessGroupReader {
    return new ForegroundProcessGroupReader("darwin", new AnsweringCommand(async () => status));
  }

  @TestMethod
  public async readsTheTerminalsGroupFromTheProcessStatFileOnLinuxPastANameWithBracketsAndSpaces(): Promise<void> {
    const read: string[] = [];
    const reader = new ForegroundProcessGroupReader("linux", new AnsweringCommand(async () => String.empty), ForegroundProcessGroupReaderTests.FOLDER, async t => {
      read.push(t);
      return `${ForegroundProcessGroupReaderTests.stat("4188")}\n`;
    });

    const group = await reader.readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(4_188, group);
    Assert.areEqual(path.join(ForegroundProcessGroupReaderTests.FOLDER, "4120", "stat"), read.join(","));
  }

  @TestMethod
  public async readsTheStatFileFromTheProcessFolderOnLinux(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await mkdir(path.join(folder.path, "4120"));
    await writeFile(path.join(folder.path, "4120", "stat"), ForegroundProcessGroupReaderTests.stat("4188"));

    const group = await new ForegroundProcessGroupReader("linux", new AnsweringCommand(async () => String.empty), folder.path).readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(4_188, group);
  }

  @TestMethod
  public async readsTheTerminalsGroupAndTheStartWithPsInTheCLocaleWithinASecondOnMacOS(): Promise<void> {
    const command = new AnsweringCommand(async () => ForegroundProcessGroupReaderTests.status("4188"));
    const reader = new ForegroundProcessGroupReader("darwin", command);

    const group = await reader.readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(4_188, group);
    Assert.areEqual("/bin/ps -o lstart=,tpgid=,comm= -p 4120 LC_ALL=C kept=true 1000", command.calls.join(","));
  }

  @TestMethod
  @TestData("4121")
  @TestData("1")
  public async answersNullOnLinuxWhenTheProcessAtTheIdLeadsAnotherSessionAsAReusedIdDoes(session: string): Promise<void> {
    Assert.isNull(await ForegroundProcessGroupReaderTests.linux(ForegroundProcessGroupReaderTests.stat("4188", session)).readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED));
  }

  @TestMethod
  @TestData("Tue Nov  3 09:04:03 2026")
  @TestData("Tue Nov  3 09:04:07 2026")
  @TestData("Wed Nov  4 09:04:05 2026")
  public async answersNullOnMacOSWhenTheProcessAtTheIdStartedAtAnotherTimeAsAReusedIdDoes(start: string): Promise<void> {
    Assert.isNull(await ForegroundProcessGroupReaderTests.mac(ForegroundProcessGroupReaderTests.status("4188", start)).readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED));
  }

  @TestMethod
  public async takesAProgramThatStartedUpToTheMarginAfterItsRecordedStartOnMacOS(): Promise<void> {
    const early = new Date(Date.parse(ForegroundProcessGroupReaderTests.START) - 900);

    Assert.areEqual(4_188, await ForegroundProcessGroupReaderTests.mac(ForegroundProcessGroupReaderTests.status("4188")).readAsync(4_120, early));
  }

  @TestMethod
  @TestData("linux", "-1")
  @TestData("darwin", "0")
  public async answersNullForAProcessWithoutATerminal(platform: string, group: string): Promise<void> {
    const reader = platform === "linux"
      ? ForegroundProcessGroupReaderTests.linux(ForegroundProcessGroupReaderTests.stat(group))
      : ForegroundProcessGroupReaderTests.mac(ForegroundProcessGroupReaderTests.status(group));

    Assert.isNull(await reader.readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED));
  }

  @TestMethod
  public async answersNullOnWindowsWithoutReadingAnything(): Promise<void> {
    const command = new AnsweringCommand(async () => "4188");
    const read: string[] = [];
    const reader = new ForegroundProcessGroupReader("win32", command, ForegroundProcessGroupReaderTests.FOLDER, async t => {
      read.push(t);
      return ForegroundProcessGroupReaderTests.stat("4188");
    });

    const group = await reader.readAsync(process.pid, ForegroundProcessGroupReaderTests.STARTED);

    Assert.isNull(group);
    Assert.areEqual(0, command.calls.length + read.length);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async answersNullWhenTheReadFailsForAProcessThatIsGoneAndThrowsASystemCommandExceptionForOneThatRuns(platform: string): Promise<void> {
    const gone = Object.assign(new Error("gone"), { code: "ENOENT" });
    const reader = new ForegroundProcessGroupReader(platform, new AnsweringCommand(() => Promise.reject(new CommandFailedException("/bin/ps", new Error("timed out")))),
      ForegroundProcessGroupReaderTests.FOLDER, () => Promise.reject(gone));
    const thrown: new (...arguments_: never[]) => SystemCommandException = platform === "linux" ? ForegroundGroupReadFailedException : CommandFailedException;

    const ended = await reader.readAsync(ForegroundProcessGroupReaderTests.ENDED_PROCESS_ID, ForegroundProcessGroupReaderTests.STARTED);
    const failure = await Assert.throwsAsync(() => reader.readAsync(process.pid, ForegroundProcessGroupReaderTests.STARTED), thrown);

    Assert.isNull(ended);
    Assert.areEqual(platform === "linux"
      ? `The foreground process group of process ${process.pid}'s terminal could not be read from: Error: gone`
      : "/bin/ps failed: timed out", failure.message);
  }

  @TestMethod
  @TestData("linux", "no name end")
  @TestData("linux", "4120 (a) S 1 4120 x 34816 4188")
  @TestData("darwin", "tty")
  @TestData("darwin", "Tue Nov  3 09:04:05 2026  x")
  @TestData("darwin", "Tue Nov  3 09:04:05 2026  4188")
  public async throwsWhatItCannotReadAsAGroup(platform: string, text: string): Promise<void> {
    const reader = platform === "linux" ? ForegroundProcessGroupReaderTests.linux(text) : ForegroundProcessGroupReaderTests.mac(text);

    const failure = await Assert.throwsAsync(() => reader.readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED), ForegroundGroupUnreadableException);

    Assert.areEqual(`The foreground process group of process 4120's terminal could not be read from: ${text}`, failure.message);
  }

  @TestMethod
  @TestData("/usr/bin/bash", true)
  @TestData("/usr/bin/sleep", false)
  public async readsTheLeadersProgramAndTheTerminalsOwnFromTheirExecutableLinksOnLinux(leader: string, isTerminalProgram: boolean): Promise<void> {
    const linked: string[] = [];
    const reader = new ForegroundProcessGroupReader("linux", new AnsweringCommand(async () => String.empty), ForegroundProcessGroupReaderTests.FOLDER,
      async () => ForegroundProcessGroupReaderTests.stat("4188"), async t => {
        linked.push(t);
        return t.includes("4188") ? leader : "/usr/bin/bash";
      });

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(`4188 ${leader} /usr/bin/bash ${isTerminalProgram}`,
      `${foreground?.group} ${foreground?.program} ${foreground?.terminalProgram} ${foreground?.isTerminalProgram}`);
    Assert.areEqual([path.join(ForegroundProcessGroupReaderTests.FOLDER, "4120", "exe"), path.join(ForegroundProcessGroupReaderTests.FOLDER, "4188", "exe")].join(","), linked.join(","));
  }

  @TestMethod
  @TestData("/bin/bash", true)
  @TestData("sleep", false)
  public async readsTheProgramsCommWithItsGroupAndTheLeadersWithOneMorePsOnMacOS(leader: string, isTerminalProgram: boolean): Promise<void> {
    const answers = [ForegroundProcessGroupReaderTests.status("4188"), `${leader}\n`];
    const command: AnsweringCommand = new AnsweringCommand(async () => answers[command.calls.length - 1] ?? String.empty);
    const reader = new ForegroundProcessGroupReader("darwin", command);

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(`4188 ${leader} /bin/bash ${isTerminalProgram}`,
      `${foreground?.group} ${foreground?.program} ${foreground?.terminalProgram} ${foreground?.isTerminalProgram}`);
    Assert.areEqual("/bin/ps -o lstart=,tpgid=,comm= -p 4120 LC_ALL=C kept=true 1000,/bin/ps -o comm= -p 4188 LC_ALL=C kept=true 1000", command.calls.join(","));
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async readsTheProgramOnceWhileItHoldsItsOwnTerminal(platform: string): Promise<void> {
    const command = new AnsweringCommand(async () => ForegroundProcessGroupReaderTests.status("4120"));
    const linked: string[] = [];
    const reader = new ForegroundProcessGroupReader(platform, command, ForegroundProcessGroupReaderTests.FOLDER, async () => ForegroundProcessGroupReaderTests.stat("4120"),
      async t => {
        linked.push(t);
        return "/usr/bin/bash";
      });

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(4_120, foreground?.group);
    Assert.isTrue(foreground?.isTerminalProgram);
    Assert.areEqual(1, command.calls.length + linked.length);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async givesNoProgramForALeaderThatExitedBetweenTheTwoReads(platform: string): Promise<void> {
    const ended = String(ForegroundProcessGroupReaderTests.ENDED_PROCESS_ID);
    const gone = Object.assign(new Error("gone"), { code: "ENOENT" });
    const command: AnsweringCommand = new AnsweringCommand(() => command.calls.length === 1
      ? Promise.resolve(ForegroundProcessGroupReaderTests.status(ended))
      : Promise.reject(new CommandFailedException("/bin/ps", new Error("exited with 1"))));
    const reader = new ForegroundProcessGroupReader(platform, command, ForegroundProcessGroupReaderTests.FOLDER, async () => ForegroundProcessGroupReaderTests.stat(ended),
      t => t.includes(ended) ? Promise.reject(gone) : Promise.resolve("/usr/bin/bash"));

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(ForegroundProcessGroupReaderTests.ENDED_PROCESS_ID, foreground?.group);
    Assert.isNull(foreground?.program);
    Assert.isFalse(foreground?.isTerminalProgram);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async throwsWhenTheProgramOfALeaderThatRunsCannotBeRead(platform: string): Promise<void> {
    const group = String(process.pid);
    const command: AnsweringCommand = new AnsweringCommand(() => command.calls.length === 1
      ? Promise.resolve(ForegroundProcessGroupReaderTests.status(group))
      : Promise.reject(new CommandFailedException("/bin/ps", new Error("timed out"))));
    const reader = new ForegroundProcessGroupReader(platform, command, ForegroundProcessGroupReaderTests.FOLDER, async () => ForegroundProcessGroupReaderTests.stat(group),
      t => t === path.join(ForegroundProcessGroupReaderTests.FOLDER, group, "exe") ? Promise.reject(Object.assign(new Error("denied"), { code: "EACCES" })) : Promise.resolve("/usr/bin/bash"));
    const thrown: new (...arguments_: never[]) => SystemCommandException = platform === "linux" ? ForegroundGroupReadFailedException : CommandFailedException;

    const failure = await Assert.throwsAsync(() => reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED), thrown);

    Assert.areEqual(platform === "linux"
      ? "The foreground process group of process 4120's terminal could not be read from: Error: denied"
      : "/bin/ps failed: timed out", failure.message);
  }

  @TestMethod
  public async answersNullOnLinuxWhenTheProgramExitsBeforeItsOwnLinkIsRead(): Promise<void> {
    const ended = ForegroundProcessGroupReaderTests.ENDED_PROCESS_ID;
    const reader = new ForegroundProcessGroupReader("linux", new AnsweringCommand(async () => String.empty), ForegroundProcessGroupReaderTests.FOLDER,
      async () => ForegroundProcessGroupReaderTests.stat("4188", String(ended)), () => Promise.reject(Object.assign(new Error("gone"), { code: "ENOENT" })));

    Assert.isNull(await reader.readProcessAsync(ended, ForegroundProcessGroupReaderTests.STARTED));
  }

  @TestMethod
  @TestData("win32", "4188")
  @TestData("linux", "-1")
  @TestData("darwin", "0")
  public async readsNoProgramWithoutAGroupOrOnWindows(platform: string, group: string): Promise<void> {
    const command = new AnsweringCommand(async () => platform === "win32" ? "4188" : ForegroundProcessGroupReaderTests.status(group));
    const linked: string[] = [];
    const reader = new ForegroundProcessGroupReader(platform, command, ForegroundProcessGroupReaderTests.FOLDER, async () => ForegroundProcessGroupReaderTests.stat(group),
      async t => {
        linked.push(t);
        return "/usr/bin/bash";
      });

    const foreground = await reader.readProcessAsync(process.pid, ForegroundProcessGroupReaderTests.STARTED);

    Assert.isNull(foreground);
    Assert.areEqual(platform === "darwin" ? 1 : 0, command.calls.length + linked.length);
  }
}
