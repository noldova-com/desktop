/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readlink, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  CommandFailedException,
  ForegroundGroupReadFailedException,
  ForegroundGroupUnreadableException,
  type ForegroundProcess,
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
    return `${start}  ${group}\n`;
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
  public async readsTheProgramsLinkAndCommandLineFromTheProcessFolderOnLinux(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const location = path.join(folder.path, "4120");
    await mkdir(location);
    await writeFile(path.join(location, "stat"), ForegroundProcessGroupReaderTests.stat("4120"));
    await writeFile(path.join(location, "cmdline"), ["/bin/bash", "-i", String.empty].join(String.fromCharCode(0)));
    await symlink(folder.path, path.join(location, "exe"), "junction");

    const foreground = await new ForegroundProcessGroupReader("linux", new AnsweringCommand(async () => String.empty), folder.path).readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(`4120 ${await readlink(path.join(location, "exe"))}|/bin/bash -i true`,
      `${foreground?.group} ${foreground?.program}|${foreground?.commandLine} ${foreground?.isTerminalProgram}`);
  }

  @TestMethod
  public async readsTheTerminalsGroupAndTheStartWithPsInTheCLocaleWithinASecondOnMacOS(): Promise<void> {
    const command = new AnsweringCommand(async () => ForegroundProcessGroupReaderTests.status("4188"));
    const reader = new ForegroundProcessGroupReader("darwin", command);

    const group = await reader.readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(4_188, group);
    Assert.areEqual("/bin/ps -o lstart=,tpgid= -p 4120 LC_ALL=C kept=true 1000", command.calls.join(","));
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
  public async throwsWhatItCannotReadAsAGroup(platform: string, text: string): Promise<void> {
    const reader = platform === "linux" ? ForegroundProcessGroupReaderTests.linux(text) : ForegroundProcessGroupReaderTests.mac(text);

    const failure = await Assert.throwsAsync(() => reader.readAsync(4_120, ForegroundProcessGroupReaderTests.STARTED), ForegroundGroupUnreadableException);

    Assert.areEqual(`The foreground process group of process 4120's terminal could not be read from: ${text}`, failure.message);
  }

  @TestMethod
  @TestData("/usr/bin/bash", "/bin/bash --norc -i", true)
  @TestData("/usr/bin/bash", "bash x.sh", false)
  @TestData("/usr/bin/sleep", "sleep 600", false)
  public async readsTheLeadersAndTheTerminalsProgramAndCommandLineFromProcOnLinux(program: string, commandLine: string, isTerminalProgram: boolean): Promise<void> {
    const read: string[] = [];
    const reader = ForegroundProcessGroupReaderTests.linuxWith(ForegroundProcessGroupReaderTests.stat("4188"),
      { 4120: ["/usr/bin/bash", "/bin/bash --norc -i"], 4188: [program, commandLine] }, read);

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(`4188 ${program}|${commandLine} /usr/bin/bash|/bin/bash --norc -i ${isTerminalProgram}`, ForegroundProcessGroupReaderTests.describe(foreground));
    Assert.areEqual(["4120/stat", "4120/exe", "4120/cmdline", "4188/exe", "4188/cmdline"].map(t => path.join(ForegroundProcessGroupReaderTests.FOLDER, ...t.split("/"))).join(","),
      read.join(","));
  }

  @TestMethod
  @TestData("/bin/bash", "/bin/bash --norc -i", true)
  @TestData("/bin/bash", "/bin/bash x.sh", false)
  @TestData("sleep", "sleep 600", false)
  public async readsTheLeadersAndTheTerminalsProgramAndCommandLineWithPsOnMacOS(program: string, commandLine: string, isTerminalProgram: boolean): Promise<void> {
    const command = ForegroundProcessGroupReaderTests.macWith("4188", ` 4120 /bin/bash\n 4188 ${program}\n`, ` 4120 /bin/bash --norc -i\n 4188 ${commandLine}\n`);

    const foreground = await new ForegroundProcessGroupReader("darwin", command).readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(`4188 ${program}|${commandLine} /bin/bash|/bin/bash --norc -i ${isTerminalProgram}`, ForegroundProcessGroupReaderTests.describe(foreground));
    Assert.areEqual([
      "/bin/ps -o lstart=,tpgid= -p 4120 LC_ALL=C kept=true 1000",
      "/bin/ps -o pid=,comm= -p 4120,4188 LC_ALL=C kept=true 1000",
      "/bin/ps -o pid=,args= -p 4120,4188 LC_ALL=C kept=true 1000"
    ].join(","), command.calls.join(","));
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async readsOnlyTheProgramWhileItHoldsItsOwnTerminal(platform: string): Promise<void> {
    const read: string[] = [];
    const command = ForegroundProcessGroupReaderTests.macWith("4120", " 4120 /bin/bash\n", " 4120 /bin/bash -i\n");
    const reader = platform === "linux"
      ? ForegroundProcessGroupReaderTests.linuxWith(ForegroundProcessGroupReaderTests.stat("4120"), { 4120: ["/usr/bin/bash", "/bin/bash -i"] }, read)
      : new ForegroundProcessGroupReader(platform, command);

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(true, foreground?.isTerminalProgram);
    Assert.areEqual(platform === "linux" ? "4120/stat,4120/exe,4120/cmdline" : "-p 4120,-p 4120,-p 4120",
      platform === "linux" ? read.map(t => path.relative(ForegroundProcessGroupReaderTests.FOLDER, t).split(path.sep).join("/")).join(",") : command.calls.map(t => t.split(" ").slice(3, 5).join(" ")).join(","));
  }

  @TestMethod
  @TestData("linux", "")
  @TestData("darwin", "")
  @TestData("darwin", " 2147483644 /bin/bash\n")
  public async givesNoProgramForALeaderThatExitedBeforeOrBetweenItsReads(platform: string, leaderName: string): Promise<void> {
    const ended = String(ForegroundProcessGroupReaderTests.ENDED_PROCESS_ID);
    const reader = platform === "linux"
      ? ForegroundProcessGroupReaderTests.linuxWith(ForegroundProcessGroupReaderTests.stat(ended), { 4120: ["/usr/bin/bash", "/bin/bash -i"] }, [])
      : new ForegroundProcessGroupReader(platform, ForegroundProcessGroupReaderTests.macWith(ended, ` 4120 /bin/bash\n${leaderName}`, " 4120 /bin/bash -i\n"));

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(`${ended} null|null ${platform === "linux" ? "/usr/bin/bash" : "/bin/bash"}|/bin/bash -i false`, ForegroundProcessGroupReaderTests.describe(foreground));
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async answersNullWhenTheProgramExitsBeforeItsOwnProgramIsRead(platform: string): Promise<void> {
    const ended = ForegroundProcessGroupReaderTests.ENDED_PROCESS_ID;
    const command: AnsweringCommand = new AnsweringCommand(() => command.calls.length === 1
      ? Promise.resolve(ForegroundProcessGroupReaderTests.status("4188"))
      : Promise.reject(new CommandFailedException("/bin/ps", new Error("exited with 1"))));
    const reader = platform === "linux"
      ? ForegroundProcessGroupReaderTests.linuxWith(ForegroundProcessGroupReaderTests.stat("4188", String(ended)), { 4188: ["/usr/bin/sleep", "sleep 600"] }, [])
      : new ForegroundProcessGroupReader(platform, command);

    Assert.isNull(await reader.readProcessAsync(ended, ForegroundProcessGroupReaderTests.STARTED));
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async throwsWhenAProgramOfAProcessThatRunsCannotBeRead(platform: string): Promise<void> {
    const group = String(process.pid);
    const command: AnsweringCommand = new AnsweringCommand(() => command.calls.length === 1
      ? Promise.resolve(ForegroundProcessGroupReaderTests.status(group))
      : Promise.reject(new CommandFailedException("/bin/ps", new Error("timed out"))));
    const reader = platform === "linux"
      ? ForegroundProcessGroupReaderTests.linuxWith(ForegroundProcessGroupReaderTests.stat(group), { 4120: ["/usr/bin/bash", "/bin/bash -i"] }, [], { [`${group}/exe`]: "EIO" })
      : new ForegroundProcessGroupReader(platform, command);
    const thrown: new (...arguments_: never[]) => SystemCommandException = platform === "linux" ? ForegroundGroupReadFailedException : CommandFailedException;

    const failure = await Assert.throwsAsync(() => reader.readProcessAsync(platform === "linux" ? 4_120 : process.pid, ForegroundProcessGroupReaderTests.STARTED), thrown);

    Assert.areEqual(platform === "linux"
      ? "The foreground process group of process 4120's terminal could not be read from: Error: EIO"
      : "/bin/ps failed: timed out", failure.message);
  }

  @TestMethod
  @TestData("EACCES", "EACCES", "null|null")
  @TestData("EACCES", "", "null|sudo apt upgrade")
  @TestData("EPERM", "", "null|sudo apt upgrade")
  @TestData("ENOENT", "ENOENT", "null|null")
  public async readsALeaderWhoseProgramCannotBeReadWhileItRunsAsNotTheTerminalsProgramOnLinux(exeCode: string, commandLineCode: string, leader: string): Promise<void> {
    const group = String(process.pid);
    const failing: Record<string, string> = { [`${group}/exe`]: exeCode };
    if (commandLineCode !== String.empty)
      failing[`${group}/cmdline`] = commandLineCode;
    const reader = ForegroundProcessGroupReaderTests.linuxWith(ForegroundProcessGroupReaderTests.stat(group),
      { 4120: ["/usr/bin/bash", "/bin/bash -i"], [process.pid]: ["/usr/bin/sudo", "sudo apt upgrade"] }, [], failing);

    const foreground = await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED);

    Assert.areEqual(`${group} ${leader} /usr/bin/bash|/bin/bash -i false`, ForegroundProcessGroupReaderTests.describe(foreground));
  }

  @TestMethod
  public async throwsARowItCannotReadAsAProgramOnMacOS(): Promise<void> {
    const reader = new ForegroundProcessGroupReader("darwin", ForegroundProcessGroupReaderTests.macWith("4188", " 4120 /bin/bash\nps: no row\n", String.empty));

    const failure = await Assert.throwsAsync(() => reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED), ForegroundGroupUnreadableException);

    Assert.areEqual("The foreground process group of process 4120's terminal could not be read from: ps: no row", failure.message);
  }

  @TestMethod
  @TestData("win32", "4188")
  @TestData("linux", "-1")
  @TestData("darwin", "0")
  public async readsNoProgramWithoutAGroupOrOnWindows(platform: string, group: string): Promise<void> {
    const read: string[] = [];
    const command = ForegroundProcessGroupReaderTests.macWith(group, " 4120 /bin/bash\n", " 4120 /bin/bash -i\n");
    const reader = platform === "linux"
      ? ForegroundProcessGroupReaderTests.linuxWith(ForegroundProcessGroupReaderTests.stat(group), { 4120: ["/usr/bin/bash", "/bin/bash -i"] }, read)
      : new ForegroundProcessGroupReader(platform, command);

    Assert.isNull(await reader.readProcessAsync(4_120, ForegroundProcessGroupReaderTests.STARTED));
    Assert.areEqual(platform === "darwin" ? 1 : 0, command.calls.length + read.length - (platform === "linux" ? 1 : 0));
  }

  private static describe(foreground: ForegroundProcess | null): string {
    return `${foreground?.group} ${foreground?.program}|${foreground?.commandLine} ${foreground?.terminalProgram}|${foreground?.terminalCommandLine} ${foreground?.isTerminalProgram}`;
  }

  private static linuxWith(
    stat: string, programs: Readonly<Record<number, readonly [string, string]>>, read: string[], failing: Readonly<Record<string, string>> = {}
  ): ForegroundProcessGroupReader {
    const answer = (file: string, part: 0 | 1): Promise<string> => {
      read.push(file);
      const [id = String.empty, name = String.empty] = path.relative(ForegroundProcessGroupReaderTests.FOLDER, file).split(path.sep);
      const code = failing[`${id}/${name}`];
      if (!Object.isUndefined(code))
        return Promise.reject(Object.assign(new Error(code), { code }));
      if (name === "stat")
        return Promise.resolve(stat);
      const program = programs[Number(id)];
      return Object.isUndefined(program)
        ? Promise.reject(Object.assign(new Error("gone"), { code: "ENOENT" }))
        : Promise.resolve(part === 0 ? program[0] : `${program[1].split(" ").join(String.fromCharCode(0))}${String.fromCharCode(0)}`);
    };
    return new ForegroundProcessGroupReader("linux", new AnsweringCommand(async () => String.empty), ForegroundProcessGroupReaderTests.FOLDER, t => answer(t, 1), t => answer(t, 0));
  }

  private static macWith(group: string, names: string, commandLines: string): AnsweringCommand {
    const command: AnsweringCommand = new AnsweringCommand(async () => {
      const call = command.calls.at(-1) ?? String.empty;
      if (call.includes("lstart="))
        return ForegroundProcessGroupReaderTests.status(group);
      return call.includes("comm=") ? names : commandLines;
    });
    return command;
  }
}
