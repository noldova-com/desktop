/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  CommandFailedException,
  FolderNotPrivateException,
  SystemCommand,
  SystemRootMissingException,
  UserIdentityUnreadableException,
  WindowsFolderProtector
} from "@noldova/desktop.runtime";

import { AccessControlFixture } from "../../fixtures/access-control.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class WindowsFolderProtectorTests {
  private static readonly FOLDER: string = "C:\\Users\\person\\.noldova\\desktop\\discovery";
  private static readonly USER: string = "S-1-5-21-1004336348-1177238915-682003330-1001";
  private static readonly IDENTITY: string = `"main process\\person","${WindowsFolderProtectorTests.USER}"\r\n`;
  private static readonly OWNED: string = `D:PAI(A;OICI;FA;;;${WindowsFolderProtectorTests.USER})`;
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = { SystemRoot: "C:\\Windows" };

  @TestMethod
  public async grantsTheCurrentUserAloneFullControlWithSystemTools(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const command = new SystemCommandFixture([
      WindowsFolderProtectorTests.IDENTITY,
      String.empty,
      String.empty,
      WindowsFolderProtectorTests.save(WindowsFolderProtectorTests.OWNED)
    ]);

    await new WindowsFolderProtector(command, WindowsFolderProtectorTests.ENVIRONMENT).protectAsync(folder.path);

    Assert.areEqual(4, command.calls.length);
    Assert.areEqual("C:\\Windows\\System32\\whoami.exe /user /fo csv /nh", command.calls[0]?.join(" "));
    Assert.areEqual(`C:\\Windows\\System32\\icacls.exe ${folder.path} /reset`, command.calls[1]?.join(" "));
    Assert.areEqual(
      `C:\\Windows\\System32\\icacls.exe ${folder.path} /inheritance:r /grant:r *${WindowsFolderProtectorTests.USER}:(OI)(CI)F`,
      command.calls[2]?.join(" "));
    Assert.areEqual(`C:\\Windows\\System32\\icacls.exe ${folder.path} /save`, command.calls[3]?.slice(0, 3).join(" "));
    Assert.areEqual(folder.path, path.dirname(command.calls[3]?.[3] ?? String.empty));
    Assert.areEqual(0, (await readdir(folder.path)).length);
  }

  @TestMethod
  public async keepsTheBuiltInAdministratorUnderItsAlias(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const command = new SystemCommandFixture([
      "\"main process\\administrator\",\"S-1-5-21-1004336348-1177238915-682003330-500\"\r\n",
      String.empty,
      String.empty,
      WindowsFolderProtectorTests.save("D:PAI(A;OICI;FA;;;LA)")
    ]);

    await new WindowsFolderProtector(command, WindowsFolderProtectorTests.ENVIRONMENT).protectAsync(folder.path);

    Assert.areEqual(4, command.calls.length);
  }

  @TestMethod
  @TestData("D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;S-1-5-21-1004336348-1177238915-682003330-1001)")
  @TestData("D:PAI(A;OICIID;FA;;;S-1-5-21-9-1002)(A;OICI;FA;;;S-1-5-21-1004336348-1177238915-682003330-1001)")
  @TestData("D:P(D;OICI;WD;;;WD)(A;OICIID;FA;;;BA)(A;OICI;FA;;;S-1-5-21-1004336348-1177238915-682003330-1001)(A;OICI;0x1301bf;;;AU)")
  @TestData("D:AI(A;OICI;FA;;;S-1-5-21-1004336348-1177238915-682003330-1001)")
  @TestData("D:P")
  @TestData(String.empty)
  public async refusesAFolderThatStaysOpenToOthers(access: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const command = new SystemCommandFixture([WindowsFolderProtectorTests.IDENTITY, String.empty, String.empty, WindowsFolderProtectorTests.save(access)]);

    const exception = await Assert.throwsAsync(
      () => new WindowsFolderProtector(command, WindowsFolderProtectorTests.ENVIRONMENT).protectAsync(folder.path),
      FolderNotPrivateException);

    Assert.areEqual(`The folder ${folder.path} is still open to others: ${`discovery\r\n${access}`.trim()}`, exception.message);
    Assert.areEqual(0, (await readdir(folder.path)).length);
  }

  @TestMethod
  @TestData(String.empty)
  @TestData("   ")
  public async refusesWithoutSystemRoot(systemRoot: string): Promise<void> {
    const command = new SystemCommandFixture([]);

    const exception = await Assert.throwsAsync(
      () => new WindowsFolderProtector(command, { SystemRoot: systemRoot }).protectAsync(WindowsFolderProtectorTests.FOLDER),
      SystemRootMissingException);
    await Assert.throwsAsync(() => new WindowsFolderProtector(command, {}).protectAsync(WindowsFolderProtectorTests.FOLDER), SystemRootMissingException);

    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", exception.message);
    Assert.areEqual(0, command.calls.length);
  }

  @TestMethod
  public async refusesAnUnreadableIdentity(): Promise<void> {
    const command = new SystemCommandFixture(["\"main process\\person\",\"unknown\"\r\n"]);

    const exception = await Assert.throwsAsync(
      () => new WindowsFolderProtector(command, WindowsFolderProtectorTests.ENVIRONMENT).protectAsync(WindowsFolderProtectorTests.FOLDER),
      UserIdentityUnreadableException);

    Assert.areEqual("The current user's security identifier could not be read from: \"main process\\person\",\"unknown\"\r\n", exception.message);
    Assert.areEqual(1, command.calls.length);
  }

  @TestMethod
  public async passesOnAToolFailure(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const failure = new CommandFailedException("icacls.exe", new Error("Access is denied."));
    const resetFailing = new SystemCommandFixture([WindowsFolderProtectorTests.IDENTITY, failure]);
    const saveFailing = new SystemCommandFixture([WindowsFolderProtectorTests.IDENTITY, String.empty, String.empty, failure]);

    const resetException = await Assert.throwsAsync(
      () => new WindowsFolderProtector(resetFailing, WindowsFolderProtectorTests.ENVIRONMENT).protectAsync(folder.path),
      CommandFailedException);
    const saveException = await Assert.throwsAsync(
      () => new WindowsFolderProtector(saveFailing, WindowsFolderProtectorTests.ENVIRONMENT).protectAsync(folder.path),
      CommandFailedException);

    Assert.areEqual(failure, resetException);
    Assert.areEqual(failure, saveException);
    Assert.areEqual(0, (await readdir(folder.path)).length);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async leavesARealFolderWithCopiedEntriesToTheCurrentUserAlone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const target = path.join(folder.path, "discovery");
    await mkdir(target);
    AccessControlFixture.runAccessCommand([target, "/inheritance:d"]);
    const before = AccessControlFixture.readSddl(target);
    const identity = execFileSync(path.join(process.env["SystemRoot"] ?? String.empty, "System32", "whoami.exe"), ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" });
    const user = /"(S-1-[0-9-]+)"\s*$/.exec(identity)?.[1] ?? String.empty;

    await new WindowsFolderProtector(new SystemCommand(), process.env).protectAsync(target);

    const after = AccessControlFixture.readSddl(target);
    const trustees = [...after.matchAll(/\((?:[^;()]*;){5}([^;()]+)[^()]*\)/g)].map(t => t[1] ?? String.empty);
    const owners = user.endsWith("-500") ? [user, "LA"] : [user];
    Assert.areEqual(1, trustees.length, `before: ${before}; after: ${after}`);
    Assert.isTrue(owners.includes(trustees[0] ?? String.empty), `before: ${before}; after: ${after}`);
    Assert.areEqual(0, (await readdir(target)).length);
  }

  private static save(access: string): (commandArguments: readonly string[]) => Promise<string> {
    return async t => {
      await writeFile(t.at(-1) ?? String.empty, `discovery\r\n${access}\r\n`, "utf16le");
      return String.empty;
    };
  }
}
