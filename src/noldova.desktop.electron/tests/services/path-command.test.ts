/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PathCommand, PathCommandException, PathCommandOutcome } from "@noldova/desktop.electron";

import { PathCommandFilesFixture } from "../fixtures/path-command-files.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class PathCommandTests {
  @TestMethod
  @PlatformFixture.posixOnly()
  public linksTheBundleCommandInTheFolderItMakesAndKeepsALinkThatIsAlreadyRight(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "usr", "local", "bin", "noldova-desktop");
      const ran: (readonly string[])[] = [];
      const command = new PathCommand(target, link, new PathCommandFilesFixture(), (program, args) => {
        ran.push([program, ...args]);
        return Promise.resolve();
      });

      const outcomes = [await command.installAsync(), await command.installAsync()];

      Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.AlreadyInstalled].join(), outcomes.join());
      Assert.areEqual(target, await readlink(link));
      Assert.areEqual(link, command.linkPath);
      Assert.areEqual(0, ran.length);
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public replacesALinkToElsewhereAndLeavesAFileThatIsNotALink(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const stale = path.join(folder, "stale");
      const file = path.join(folder, "file");
      await symlink(path.join(folder, "old", "noldova-desktop"), stale);
      await writeFile(file, "someone else's noldova-desktop\n");

      const outcomes = [
        await new PathCommand(target, stale, new PathCommandFilesFixture(), () => Promise.resolve()).installAsync(),
        await new PathCommand(target, file, new PathCommandFilesFixture(), () => Promise.resolve()).installAsync()
      ];

      Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.Occupied].join(), outcomes.join());
      Assert.areEqual(target, await readlink(stale));
    });
  }

  @TestMethod
  public replacesALinkToElsewhereKeepsALinkThatIsAlreadyRightAndLeavesAFileThroughTheLinkCalls(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "bin", "noldova-desktop");
      const file = path.join(folder, "file");
      await writeFile(file, "someone else's noldova-desktop");
      const ran: (readonly string[])[] = [];
      const files = new PathCommandFilesFixture();
      files.linkStubs = new Map([[link, path.join(folder, "old", "noldova-desktop")]]);
      const command = new PathCommand(target, link, files, (program, args) => {
        ran.push([program, ...args]);
        return Promise.resolve();
      });

      const outcomes = [await command.installAsync(), await command.installAsync(), await new PathCommand(target, file, files, () => Promise.resolve()).installAsync()];

      Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.AlreadyInstalled, PathCommandOutcome.Occupied].join(), outcomes.join());
      Assert.areEqual(target, files.linkStubs.get(link));
      Assert.areEqual(0, ran.length);
    });
  }

  @TestMethod
  public reportsABuildWithoutACommandWithoutTouchingTheLink(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async folder => {
      const link = path.join(folder, "noldova-desktop");

      const outcome = await new PathCommand(path.join(folder, "missing"), link, new PathCommandFilesFixture(), () => Promise.resolve()).installAsync();

      Assert.areEqual(PathCommandOutcome.Missing, outcome);
      Assert.isFalse(await PathCommandTests.existsAsync(link));
    });
  }

  @TestMethod
  public asksForAnAdministratorWhenTheFolderCannotBeWrittenAndReportsACancelledPromptAndAFileThatIsNotALink(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "bin", "noldova-desktop");
      const ran: (readonly string[])[] = [];
      const answers = [
        ["EACCES", (): Promise<void> => Promise.resolve()],
        ["EPERM", (): Promise<void> => Promise.reject(new Error("Command failed: /usr/bin/osascript\n0:200: execution error: User canceled. (-128)"))],
        ["EACCES", (): Promise<void> => Promise.reject(new Error("Command failed: /usr/bin/osascript\n0:300: execution error: The command exited with a non-zero status. (3)"))]
      ] as const;

      const outcomes = [];
      for (const [code, answer] of answers) {
        const files = new PathCommandFilesFixture();
        files.writingRefusal = code;
        outcomes.push(await new PathCommand(target, link, files, (program, args) => {
          ran.push([program, ...args]);
          return answer();
        }).installAsync());
      }

      Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.Cancelled, PathCommandOutcome.Occupied].join(), outcomes.join());
      Assert.areEqual("/usr/bin/osascript", ran[0]?.[0]);
      Assert.areEqual([target, path.join(folder, "bin"), link].join(), ran[0]?.slice(-4, -1).join());
      Assert.areEqual(`Noldova Desktop Sample wants to link ${link} to its noldova-desktop command, so that terminals can run it.`, ran[0]?.at(-1));
      Assert.isTrue(ran[0]?.some(t => t.includes("with administrator privileges")) === true);
      Assert.isTrue(ran[0]?.some(t => t.includes("[ -e \" & commandLink & \" ] && [ ! -L \" & commandLink & \" ] && exit 3;")) === true);
    });
  }

  @TestMethod
  public asksForAnAdministratorWhenTheLinkCannotBeReadAndFailsWithTheReasonForAnotherReadingError(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "bin", "noldova-desktop");
      const outcomes: string[] = [];

      for (const code of ["EACCES", "EIO"]) {
        const files = new PathCommandFilesFixture();
        files.readingRefusal = code;
        outcomes.push(await new PathCommand(target, link, files, () => Promise.resolve()).installAsync().then(t => t, (t: unknown) => {
          Assert.isInstanceOf(t, PathCommandException);
          return t.message;
        }));
      }

      Assert.areEqual([PathCommandOutcome.Installed, `The noldova-desktop command could not be linked at ${link}: Error: EIO: refused by the test`].join("|"), outcomes.join("|"));
    });
  }

  @TestMethod
  public failsWithTheReasonWhenTheLinkCannotBeMadeOrTheAdministratorPromptFails(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "bin", "noldova-desktop");
      const messages: string[] = [];

      for (const [code, runProgramAsync] of [
        ["ENOTDIR", (): Promise<void> => Promise.resolve()],
        ["EACCES", (): Promise<void> => Promise.reject(new Error("Command failed: /usr/bin/osascript\nThe administrator user name or password was incorrect."))]
      ] as const) {
        const files = new PathCommandFilesFixture();
        files.writingRefusal = code;
        const error = await new PathCommand(target, link, files, runProgramAsync).installAsync().then(() => null, (t: unknown) => t);
        Assert.isInstanceOf(error, PathCommandException);
        messages.push(error.message);
      }

      Assert.areEqual([
        `The noldova-desktop command could not be linked at ${link}: Error: ENOTDIR: refused by the test`,
        `The noldova-desktop command could not be linked at ${link}: Error: Command failed: /usr/bin/osascript\nThe administrator user name or password was incorrect.`
      ].join("|"), messages.join("|"));
    });
  }

  @TestMethod
  public linksTheCommandInsideTheBundleTheMainProcessRunsFromInUsrLocalBin(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async folder => {
      const command = PathCommand.forBundle(path.join(folder, "Unpackaged.app", "Contents", "MacOS", "Noldova Desktop Sample"), () => Promise.resolve());

      const outcome = await command.installAsync();

      Assert.areEqual(PathCommandOutcome.Missing, outcome);
      Assert.areEqual(path.join("/usr/local/bin", "noldova-desktop"), command.linkPath);
    });
  }

  private static async existsAsync(file: string): Promise<boolean> {
    try {
      await readlink(file);
      return true;
    }
    catch {
      return false;
    }
  }

  private static async runInFolderAsync(action: (folder: string, target: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-path-command-"));
    try {
      const target = path.join(folder, "Noldova Desktop Sample.app", "Contents", "Resources", "bin", "noldova-desktop");
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "#!/bin/sh\n");
      await action(folder, target);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
