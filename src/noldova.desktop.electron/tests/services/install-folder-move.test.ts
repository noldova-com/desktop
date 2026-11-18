/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallFolderMove, type IProgramHost, type IShownPathFiles, type IShownPathStatus, StartedProgram } from "@noldova/desktop.electron";

import { FakeApplicationHost } from "../fixtures/fake-application-host.fixture.js";
import { FakeMainProcessLog } from "../fixtures/fake-main-process-log.fixture.js";
import { FakeShellHost } from "../fixtures/fake-shell-host.fixture.js";

class ScriptedPrograms implements IProgramHost {
  private readonly failures: ReadonlyMap<string, Error>;

  public readonly runs: string[] = [];

  public constructor(failures: ReadonlyMap<string, Error> = new Map()) {
    this.failures = failures;
  }

  public runAsync(file: string, programArguments: readonly string[]): Promise<string> {
    const run = [file, ...programArguments].join(" ");
    this.runs.push(run);
    const failure = [...this.failures].find(([prefix]) => run.startsWith(prefix))?.[1];
    return Object.isUndefined(failure) ? Promise.resolve(String.empty) : Promise.reject(failure);
  }

  public start(): StartedProgram {
    return new StartedProgram(() => undefined);
  }
}

class ExistingFiles implements IShownPathFiles {
  private readonly existing: ReadonlySet<string>;

  public constructor(existing: readonly string[]) {
    this.existing = new Set(existing);
  }

  public lstat(file: string): Promise<IShownPathStatus> {
    return this.existing.has(file) ? Promise.resolve({ mode: 0o40755, isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false }) : Promise.reject(new Error(`ENOENT: ${file}`));
  }

  public readlink(link: string): Promise<string> {
    return Promise.reject(new Error(`EINVAL: ${link}`));
  }

  public realpath(file: string): Promise<string> {
    return Promise.resolve(file);
  }
}

@TestClass
export class InstallFolderMoveTests {
  private static readonly PROGRAM: string = "/Applications/Sample.app/Contents/MacOS/Sample";
  private static readonly TARGET: string = "/Applications/Sample Makers/Sample.app";
  private static readonly STAGING: string = "/Applications/Sample Makers/.Sample.app";

  @TestMethod
  public async copiesTheAppIntoItsFolderTrashesTheOldCopyAndStartsTheCopy(): Promise<void> {
    const move = InstallFolderMoveTests.create();

    const isMoving = await move.runAsync();

    Assert.isTrue(isMoving);
    Assert.areEqual([`/bin/rm -rf ${InstallFolderMoveTests.STAGING}`, `/usr/bin/ditto /Applications/Sample.app ${InstallFolderMoveTests.STAGING}`,
      `/bin/mv ${InstallFolderMoveTests.STAGING} ${InstallFolderMoveTests.TARGET}`].join("\n"), move.programs.runs.join("\n"));
    Assert.areEqual("/Applications/Sample.app", move.shell.trashed.join());
    Assert.areEqual(["releaseSingleInstanceLock", `relaunch ${InstallFolderMoveTests.TARGET}/Contents/MacOS/Sample ["--hidden"]`, "exit 0"].join("|"),
      move.app.calls.join("|"));
    Assert.areEqual(`Moved /Applications/Sample.app into its install folder, as ${InstallFolderMoveTests.TARGET}, and moved the old copy to the Trash.`, move.log.lines.join());
    Assert.areEqual(1, move.log.flushed.length);
  }

  @TestMethod
  public async leavesBothCopiesWhenTheFolderAlreadyHoldsTheApp(): Promise<void> {
    const move = InstallFolderMoveTests.create({ existing: [InstallFolderMoveTests.TARGET] });

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(0, move.programs.runs.length + move.app.calls.length + move.shell.trashed.length);
    Assert.areEqual(`/Applications/Sample.app stays where it is, since ${InstallFolderMoveTests.TARGET} already exists.`, move.log.lines.join("\n"));
  }

  @TestMethod
  public async keepsRunningWhereItIsWhenItCantWriteTheFolder(): Promise<void> {
    const move = InstallFolderMoveTests.create({ failures: new Map([["/usr/bin/ditto", new Error("ditto: /Applications/Sample Makers: Permission denied")]]) });

    const isMoving = await move.runAsync();

    Assert.isFalse(isMoving);
    Assert.areEqual(`/bin/rm -rf ${InstallFolderMoveTests.STAGING}`, move.programs.runs.at(-1));
    Assert.areEqual(0, move.shell.trashed.length + move.app.calls.length);
    Assert.areEqual(`/Applications/Sample.app could not be copied to ${InstallFolderMoveTests.TARGET}, so it keeps running where it is: `
      + "Error: ditto: /Applications/Sample Makers: Permission denied", move.log.lines.join("\n"));
  }

  @TestMethod
  public async logsAnUnfinishedCopyItCantRemove(): Promise<void> {
    const move = InstallFolderMoveTests.create({ failures: new Map([["/bin/rm", new Error("rm: Operation not permitted")]]) });

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(`The unfinished copy ${InstallFolderMoveTests.STAGING} could not be removed: Error: rm: Operation not permitted`, move.log.lines.at(-1));
  }

  @TestMethod
  public async startsTheCopyEvenWhenTheOldOneCantGoToTheTrash(): Promise<void> {
    const move = InstallFolderMoveTests.create();
    move.shell.trashFailure = new Error("The Trash is unavailable");

    Assert.isTrue(await move.runAsync());
    Assert.areEqual(`Copied /Applications/Sample.app into its install folder, as ${InstallFolderMoveTests.TARGET}, but the old copy could not be moved to the Trash: `
      + "Error: The Trash is unavailable", move.log.lines.join());
    Assert.areEqual("exit 0", move.app.calls.at(-1));
  }

  @TestMethod
  public async leavesEveryOtherCopyWhereItIs(): Promise<void> {
    const cases: readonly (readonly [string, Partial<{ platform: string, program: string, isPackaged: boolean, installFolder: string | null }>])[] = [
      ["development build", { isPackaged: false }],
      ["Windows", { platform: "win32" }],
      ["no folder", { installFolder: null }],
      ["already in the folder", { program: `${InstallFolderMoveTests.TARGET}/Contents/MacOS/Sample` }],
      ["elsewhere", { program: "/Users/sample/Applications/Sample.app/Contents/MacOS/Sample" }],
      ["translocated", { program: "/private/var/folders/xy/abc/T/AppTranslocation/0A1B2C3D/d/Sample.app/Contents/MacOS/Sample" }],
      ["inside another folder of Applications", { program: "/Applications/Other/Sample.app/Contents/MacOS/Sample" }],
      ["another name", { program: "/Applications/Sample 2.app/Contents/MacOS/Sample" }]
    ];

    for (const [name, options] of cases) {
      const move = InstallFolderMoveTests.create(options);

      Assert.isFalse(await move.runAsync(), name);
      Assert.areEqual(0, move.programs.runs.length + move.app.calls.length + move.shell.trashed.length, name);
    }
  }

  private static create(options: Partial<{ platform: string, program: string, isPackaged: boolean, installFolder: string | null, existing: readonly string[],
    failures: ReadonlyMap<string, Error> }> = {}): { runAsync: () => Promise<boolean>, app: FakeApplicationHost, shell: FakeShellHost, programs: ScriptedPrograms,
    log: FakeMainProcessLog } {
    const app = new FakeApplicationHost(true, true);
    void app.becomeReadyAsync();
    const shell = new FakeShellHost();
    const programs = new ScriptedPrograms(options.failures);
    const log = new FakeMainProcessLog();
    const program = options.program ?? InstallFolderMoveTests.PROGRAM;
    const move = new InstallFolderMove(app, shell, {
      platform: options.platform ?? "darwin",
      execPath: program,
      argv: [program, "--hidden"],
      env: {},
      programs,
      files: new ExistingFiles(options.existing ?? [])
    }, log);
    const installFolder = Object.isUndefined(options.installFolder) ? "Sample Makers" : options.installFolder;
    return { runAsync: () => move.runAsync(options.isPackaged ?? true, "Sample", installFolder), app, shell, programs, log };
  }
}
