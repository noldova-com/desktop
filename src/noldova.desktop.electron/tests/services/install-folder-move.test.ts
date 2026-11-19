/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallFolderMove, type IMainProcessFiles, type IProgramHost, type IShownPathStatus, StartedProgram } from "@noldova/desktop.electron";

import { FakeApplicationHost } from "../fixtures/fake-application-host.fixture.js";
import { FakeMainProcessLog } from "../fixtures/fake-main-process-log.fixture.js";
import { FakeShellHost } from "../fixtures/fake-shell-host.fixture.js";

class ScriptedPrograms implements IProgramHost {
  private readonly failures: ReadonlyMap<string, Error>;
  private readonly bundles: ReadonlyMap<string, readonly [string, string]>;

  public readonly runs: string[] = [];

  public constructor(failures: ReadonlyMap<string, Error>, bundles: ReadonlyMap<string, readonly [string, string]>) {
    this.failures = failures;
    this.bundles = bundles;
  }

  public runAsync(file: string, programArguments: readonly string[]): Promise<string> {
    const run = [file, ...programArguments].join(" ");
    this.runs.push(run);
    const failure = [...this.failures].find(([prefix]) => run.startsWith(prefix))?.[1];
    if (!Object.isUndefined(failure))
      return Promise.reject(failure);
    const bundle = [...this.bundles].find(([folder]) => run.endsWith(`${folder}/Contents/Info.plist`))?.[1];
    const read = Object.isUndefined(bundle) ? String.empty : run.includes(" CFBundleIdentifier ") ? bundle[0] : bundle[1];
    return Promise.resolve(`${read}\n`);
  }

  public start(): StartedProgram {
    return new StartedProgram(() => undefined);
  }
}

class ExistingFiles implements IMainProcessFiles {
  private readonly existing: ReadonlySet<string>;

  public readonly renames: string[] = [];
  public readonly folders: Map<string, string[]> = new Map();
  public readonly links: Map<string, string> = new Map();
  public renameFailure: Error | null;
  public readdirFailure: Error | null;

  public constructor(existing: readonly string[]) {
    this.existing = new Set(existing);
    this.renameFailure = null;
    this.readdirFailure = null;
  }

  public static systemError(code: string, message: string): Error {
    return Object.assign(new Error(message), { code });
  }

  public readdir(folder: string): Promise<string[]> {
    const entries = this.folders.get(folder);
    if (!Object.isNull(this.readdirFailure))
      return Promise.reject(this.readdirFailure);
    return Object.isUndefined(entries) ? Promise.reject(ExistingFiles.systemError("ENOENT", `ENOENT: no such file or directory, scandir '${folder}'`)) : Promise.resolve(entries);
  }

  public rename(from: string, to: string): Promise<void> {
    this.renames.push(`${from} -> ${to}`);
    return Object.isNull(this.renameFailure) ? Promise.resolve() : Promise.reject(this.renameFailure);
  }

  public lstat(file: string): Promise<IShownPathStatus> {
    return this.existing.has(file) ? Promise.resolve({ mode: 0o40755, isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false }) : Promise.reject(new Error(`ENOENT: ${file}`));
  }

  public readlink(link: string): Promise<string> {
    return Promise.reject(new Error(`EINVAL: ${link}`));
  }

  public realpath(file: string): Promise<string> {
    const resolved = this.links.get(file) ?? file;
    return this.existing.has(resolved) ? Promise.resolve(resolved) : Promise.reject(ExistingFiles.systemError("ENOENT", `ENOENT: no such file or directory, realpath '${file}'`));
  }
}

@TestClass
export class InstallFolderMoveTests {
  private static readonly PROGRAM: string = "/Applications/Sample.app/Contents/MacOS/Sample";
  private static readonly TARGET: string = "/Applications/Sample Makers/Sample.app";
  private static readonly STAGING: string = "/Applications/Sample Makers/.4321-Sample.app";
  private static readonly OLD: string = "/Applications/Sample.app";
  private static readonly FOLDER_PROGRAM: string = "/Applications/Sample Makers/Sample.app/Contents/MacOS/Sample";
  private static readonly HOME_COPY: string = "/Users/sample/Applications/Sample Makers/Sample.app";

  @TestMethod
  public async copiesTheAppIntoItsFolderTrashesTheOldCopyAndStartsTheCopy(): Promise<void> {
    const move = InstallFolderMoveTests.create();

    const isMoving = await move.runAsync();

    Assert.isTrue(isMoving);
    Assert.areEqual([`/bin/rm -rf ${InstallFolderMoveTests.STAGING}`, `/usr/bin/ditto /Applications/Sample.app ${InstallFolderMoveTests.STAGING}`].join("\n"),
      move.programs.runs.join("\n"));
    Assert.areEqual(`${InstallFolderMoveTests.STAGING} -> ${InstallFolderMoveTests.TARGET}`, move.files.renames.join("\n"));
    Assert.areEqual("/Applications/Sample.app", move.shell.trashed.join());
    Assert.areEqual(["releaseSingleInstanceLock", `relaunch ${InstallFolderMoveTests.TARGET}/Contents/MacOS/Sample ["--hidden"]`, "exit 0"].join("|"),
      move.app.calls.join("|"));
    Assert.areEqual(`Moved /Applications/Sample.app into its install folder, as ${InstallFolderMoveTests.TARGET}, and moved the old copy to the Trash.`, move.log.lines.join());
    Assert.areEqual(1, move.log.flushed.length);
  }

  @TestMethod
  public async trashesTheOldCopyAndStartsTheFoldersWhenItIsTheSameAppAsNewOrNewer(): Promise<void> {
    for (const version of ["1.2.3", "1.3.0"]) {
      const move = InstallFolderMoveTests.create({ existing: [InstallFolderMoveTests.TARGET],
        bundles: new Map([[InstallFolderMoveTests.OLD, ["com.example.sample", "1.2.3"]], [InstallFolderMoveTests.TARGET, ["com.example.sample", version]]]) });

      Assert.isTrue(await move.runAsync(), version);
      Assert.areEqual(["CFBundleIdentifier raw -o - /Applications/Sample.app", `CFBundleIdentifier raw -o - ${InstallFolderMoveTests.TARGET}`,
        "CFBundleShortVersionString raw -o - /Applications/Sample.app", `CFBundleShortVersionString raw -o - ${InstallFolderMoveTests.TARGET}`]
        .map(t => `/usr/bin/plutil -extract ${t}/Contents/Info.plist`).join("\n"), move.programs.runs.join("\n"), version);
      Assert.areEqual(0, move.files.renames.length, version);
      Assert.areEqual(InstallFolderMoveTests.OLD, move.shell.trashed.join(), version);
      Assert.areEqual(`relaunch ${InstallFolderMoveTests.TARGET}/Contents/MacOS/Sample ["--hidden"]`, move.app.calls.find(t => t.startsWith("relaunch")), version);
      Assert.areEqual(`${InstallFolderMoveTests.TARGET} already holds the app, as new as /Applications/Sample.app or newer, so the old copy was moved to the Trash.`,
        move.log.lines.join("\n"), version);
    }
  }

  @TestMethod
  public async leavesBothCopiesWhenTheFolderHoldsAnotherAppAnOlderCopyOrAnUnreadableVersion(): Promise<void> {
    const cases: readonly (readonly [string, readonly [string, string], string])[] = [
      ["another app", ["com.example.other", "1.2.3"], "com.example.sample and com.example.other, versions 1.2.3 and 1.2.3"],
      ["an older copy", ["com.example.sample", "1.2.2"], "com.example.sample and com.example.sample, versions 1.2.3 and 1.2.2"],
      ["an unreadable version", ["com.example.sample", "next"], "com.example.sample and com.example.sample, versions 1.2.3 and next"]
    ];

    for (const [name, target, read] of cases) {
      const move = InstallFolderMoveTests.create({ existing: [InstallFolderMoveTests.TARGET],
        bundles: new Map([[InstallFolderMoveTests.OLD, ["com.example.sample", "1.2.3"]], [InstallFolderMoveTests.TARGET, target]]) });

      Assert.isFalse(await move.runAsync(), name);
      Assert.areEqual(0, move.files.renames.length + move.app.calls.length + move.shell.trashed.length, name);
      Assert.areEqual(`/Applications/Sample.app stays where it is, since ${InstallFolderMoveTests.TARGET} already exists and is not the same app as new or newer: ${read}.`,
        move.log.lines.join("\n"), name);
    }
  }

  @TestMethod
  public async leavesBothCopiesWhenTheOldCopyIsAPreRelease(): Promise<void> {
    const move = InstallFolderMoveTests.create({ existing: [InstallFolderMoveTests.TARGET],
      bundles: new Map([[InstallFolderMoveTests.OLD, ["com.example.sample", "1.2.2-beta.1"]], [InstallFolderMoveTests.TARGET, ["com.example.sample", "1.2.3"]]]) });

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(0, move.files.renames.length + move.app.calls.length + move.shell.trashed.length);
    Assert.areEqual(`/Applications/Sample.app stays where it is, since ${InstallFolderMoveTests.TARGET} already exists and is not the same app as new or newer: `
      + "com.example.sample and com.example.sample, versions 1.2.2-beta.1 and 1.2.3.", move.log.lines.join("\n"));
  }

  @TestMethod
  public async leavesBothCopiesWhenTheFoldersCopyCantBeRead(): Promise<void> {
    const move = InstallFolderMoveTests.create({ existing: [InstallFolderMoveTests.TARGET], failures: new Map([["/usr/bin/plutil", new Error("plutil: no such file")]]) });

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(0, move.files.renames.length + move.app.calls.length + move.shell.trashed.length);
    Assert.areEqual(`/Applications/Sample.app stays where it is, since ${InstallFolderMoveTests.TARGET} already exists and could not be read: Error: plutil: no such file`,
      move.log.lines.join("\n"));
  }

  @TestMethod
  public async keepsRunningWhereItIsWhenTheTargetAppearsDuringTheCopy(): Promise<void> {
    const move = InstallFolderMoveTests.create();
    move.files.renameFailure = new Error(`ENOTEMPTY: directory not empty, rename '${InstallFolderMoveTests.STAGING}' -> '${InstallFolderMoveTests.TARGET}'`);

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(`/bin/rm -rf ${InstallFolderMoveTests.STAGING}`, move.programs.runs.at(-1));
    Assert.areEqual(0, move.shell.trashed.length + move.app.calls.length);
    Assert.areEqual(`/Applications/Sample.app could not be copied to ${InstallFolderMoveTests.TARGET}, so it keeps running where it is: `
      + `Error: ENOTEMPTY: directory not empty, rename '${InstallFolderMoveTests.STAGING}' -> '${InstallFolderMoveTests.TARGET}'`, move.log.lines.join("\n"));
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
  public async removesTheUnfinishedCopiesOfProcessesThatAreGoneBeforeItCopies(): Promise<void> {
    const move = InstallFolderMoveTests.create({ processes: new Map([[18, null], [19, ExistingFiles.systemError("EPERM", "kill EPERM")]]) });
    move.files.folders.set("/Applications/Sample Makers", [".17-Sample.app", ".18-Sample.app", ".19-Sample.app", ".0-Sample.app", ".x-Sample.app", ".17-Other.app", "17-Sample.app",
      "Other.app"]);

    Assert.isTrue(await move.runAsync());
    Assert.areEqual(["/bin/rm -rf /Applications/Sample Makers/.17-Sample.app", `/bin/rm -rf ${InstallFolderMoveTests.STAGING}`,
      `/usr/bin/ditto /Applications/Sample.app ${InstallFolderMoveTests.STAGING}`].join("\n"), move.programs.runs.join("\n"));
    Assert.areEqual("17,18,19", move.probed.join());
  }

  @TestMethod
  public async logsAnUnfinishedCopyOfAGoneProcessItCantRemoveAndStillMoves(): Promise<void> {
    const move = InstallFolderMoveTests.create({ failures: new Map([["/bin/rm -rf /Applications/Sample Makers/.17-", new Error("rm: Operation not permitted")]]) });
    move.files.folders.set("/Applications/Sample Makers", [".17-Sample.app"]);

    Assert.isTrue(await move.runAsync());
    Assert.areEqual("The unfinished copy /Applications/Sample Makers/.17-Sample.app could not be removed: Error: rm: Operation not permitted", move.log.lines.at(0));
    Assert.areEqual(`${InstallFolderMoveTests.STAGING} -> ${InstallFolderMoveTests.TARGET}`, move.files.renames.join());
  }

  @TestMethod
  public async keepsRunningWhereItIsWhenItCantListTheFolder(): Promise<void> {
    const move = InstallFolderMoveTests.create();
    move.files.readdirFailure = ExistingFiles.systemError("EACCES", "EACCES: permission denied, scandir '/Applications/Sample Makers'");

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(`/bin/rm -rf ${InstallFolderMoveTests.STAGING}`, move.programs.runs.join());
    Assert.areEqual(`/Applications/Sample.app could not be copied to ${InstallFolderMoveTests.TARGET}, so it keeps running where it is: `
      + "Error: EACCES: permission denied, scandir '/Applications/Sample Makers'", move.log.lines.join("\n"));
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
  public async startsTheFoldersCopyEvenWhenTheOldOneCantGoToTheTrash(): Promise<void> {
    const move = InstallFolderMoveTests.create({ existing: [InstallFolderMoveTests.TARGET],
      bundles: new Map([[InstallFolderMoveTests.OLD, ["com.example.sample", "1.2.3"]], [InstallFolderMoveTests.TARGET, ["com.example.sample", "1.2.3"]]]) });
    move.shell.trashFailure = new Error("The Trash is unavailable");

    Assert.isTrue(await move.runAsync());
    Assert.areEqual(`Copied /Applications/Sample.app into its install folder, as ${InstallFolderMoveTests.TARGET}, but the old copy could not be moved to the Trash: `
      + "Error: The Trash is unavailable", move.log.lines.join());
    Assert.areEqual(`relaunch ${InstallFolderMoveTests.TARGET}/Contents/MacOS/Sample ["--hidden"]`, move.app.calls.find(t => t.startsWith("relaunch")));
  }

  @TestMethod
  public async trashesTheHomeFoldersCopyWhenTheFoldersCopyStartsAsTheSameAppAsNewOrNewer(): Promise<void> {
    for (const version of ["1.2.3", "1.3.0"]) {
      const move = InstallFolderMoveTests.create({ program: InstallFolderMoveTests.FOLDER_PROGRAM, home: "/Users/sample", existing: [InstallFolderMoveTests.HOME_COPY, InstallFolderMoveTests.TARGET],
        bundles: new Map([[InstallFolderMoveTests.HOME_COPY, ["com.example.sample", "1.2.3"]], [InstallFolderMoveTests.TARGET, ["com.example.sample", version]]]) });

      Assert.isFalse(await move.runAsync(), version);
      Assert.areEqual(InstallFolderMoveTests.HOME_COPY, move.shell.trashed.join(), version);
      Assert.areEqual(`${InstallFolderMoveTests.TARGET} holds the app, as new as ${InstallFolderMoveTests.HOME_COPY} or newer, so the copy in the home folder's Applications was moved to the Trash.`,
        move.log.lines.join(), version);
      Assert.areEqual(0, move.app.calls.length + move.files.renames.length, version);
    }
  }

  @TestMethod
  public async keepsTheHomeFoldersCopyWhenItIsNewerAnotherAppOrUnreadable(): Promise<void> {
    const cases: readonly (readonly [string, ReadonlyMap<string, Error>, readonly [string, string]])[] = [
      ["newer", new Map(), ["com.example.sample", "1.3.0"]],
      ["another app", new Map(), ["com.example.other", "1.2.3"]],
      ["a pre-release", new Map(), ["com.example.sample", "1.2.4-beta.1"]],
      ["unreadable", new Map([["/usr/bin/plutil", new Error("plutil failed")]]), ["com.example.sample", "1.2.3"]]
    ];

    for (const [name, failures, copy] of cases) {
      const move = InstallFolderMoveTests.create({ program: InstallFolderMoveTests.FOLDER_PROGRAM, home: "/Users/sample", existing: [InstallFolderMoveTests.HOME_COPY, InstallFolderMoveTests.TARGET], failures,
        bundles: new Map([[InstallFolderMoveTests.HOME_COPY, copy], [InstallFolderMoveTests.TARGET, ["com.example.sample", "1.2.3"]]]) });

      Assert.isFalse(await move.runAsync(), name);
      Assert.areEqual(0, move.shell.trashed.length + move.app.calls.length, name);
      Assert.isTrue(move.log.lines.join().startsWith(`${InstallFolderMoveTests.HOME_COPY} stays where it is, since ${InstallFolderMoveTests.TARGET} already exists and `), name);
    }
  }

  @TestMethod
  public async keepsAHomeFoldersCopyThatIsTheRunningAppOrReachedThroughALink(): Promise<void> {
    const elsewhere = "/Volumes/Apps/Sample Makers/Sample.app";
    const cases: readonly (readonly [string, string, string, string | null])[] = [
      ["a linked Applications or install folder", "/Users/sample", InstallFolderMoveTests.HOME_COPY, InstallFolderMoveTests.TARGET],
      ["a link to another copy", "/Users/sample", InstallFolderMoveTests.HOME_COPY, elsewhere],
      ["a home folder at the root", "/", InstallFolderMoveTests.TARGET, null]
    ];

    for (const [name, home, copy, linked] of cases) {
      const move = InstallFolderMoveTests.create({ program: InstallFolderMoveTests.FOLDER_PROGRAM, home, existing: [InstallFolderMoveTests.TARGET, elsewhere],
        bundles: new Map([[copy, ["com.example.sample", "1.2.3"]], [InstallFolderMoveTests.TARGET, ["com.example.sample", "1.2.3"]]]) });
      if (!Object.isNull(linked))
        move.files.links.set(copy, linked);

      Assert.isFalse(await move.runAsync(), name);
      Assert.areEqual(0, move.programs.runs.length + move.shell.trashed.length + move.app.calls.length, name);
      Assert.areEqual(`${copy} stays where it is, since it is not a copy of its own beside ${InstallFolderMoveTests.TARGET}: it resolves to ${linked ?? copy}.`,
        move.log.lines.join(), name);
    }
  }

  @TestMethod
  public async readsNothingWhenTheHomeFolderHoldsNoCopy(): Promise<void> {
    const move = InstallFolderMoveTests.create({ program: InstallFolderMoveTests.FOLDER_PROGRAM, home: "/Users/sample" });

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(0, move.programs.runs.length + move.shell.trashed.length + move.log.lines.length);
  }

  @TestMethod
  public async logsTheHomeFoldersCopyWhenItCantGoToTheTrash(): Promise<void> {
    const move = InstallFolderMoveTests.create({ program: InstallFolderMoveTests.FOLDER_PROGRAM, home: "/Users/sample", existing: [InstallFolderMoveTests.HOME_COPY, InstallFolderMoveTests.TARGET],
      bundles: new Map([[InstallFolderMoveTests.HOME_COPY, ["com.example.sample", "1.2.3"]], [InstallFolderMoveTests.TARGET, ["com.example.sample", "1.2.3"]]]) });
    move.shell.trashFailure = new Error("The Trash is unavailable");

    Assert.isFalse(await move.runAsync());
    Assert.areEqual(`${InstallFolderMoveTests.TARGET} holds the app, but the copy in the home folder's Applications, ${InstallFolderMoveTests.HOME_COPY}, could not be moved to the Trash: `
      + "Error: The Trash is unavailable", move.log.lines.join());
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

  private static create(options: Partial<{ platform: string, program: string, isPackaged: boolean, installFolder: string | null, existing: readonly string[], home: string,
    failures: ReadonlyMap<string, Error>, bundles: ReadonlyMap<string, readonly [string, string]>, processes: ReadonlyMap<number, Error | null> }> = {}): {
    runAsync: () => Promise<boolean>, app: FakeApplicationHost, shell: FakeShellHost, programs: ScriptedPrograms, files: ExistingFiles, log: FakeMainProcessLog,
    probed: readonly number[] } {
    const app = new FakeApplicationHost(true, true);
    void app.becomeReadyAsync();
    const shell = new FakeShellHost();
    const programs = new ScriptedPrograms(options.failures ?? new Map(), options.bundles ?? new Map());
    const files = new ExistingFiles(options.existing ?? []);
    const log = new FakeMainProcessLog();
    const program = options.program ?? InstallFolderMoveTests.PROGRAM;
    const probed: number[] = [];
    const processes = options.processes ?? new Map();
    const move = new InstallFolderMove(app, shell, {
      platform: options.platform ?? "darwin",
      execPath: program,
      argv: [program, "--hidden"],
      env: Object.isUndefined(options.home) ? {} : { HOME: options.home },
      processId: 4321,
      programs,
      files,
      probeProcess: processId => {
        probed.push(processId);
        const failure = processes.get(processId);
        if (Object.isUndefined(failure))
          throw ExistingFiles.systemError("ESRCH", "kill ESRCH");
        if (!Object.isNull(failure))
          throw failure;
      }
    }, log);
    const installFolder = Object.isUndefined(options.installFolder) ? "Sample Makers" : options.installFolder;
    return { runAsync: () => move.runAsync(options.isPackaged ?? true, "Sample", installFolder), app, shell, programs, files, log, probed };
  }
}
