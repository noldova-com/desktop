/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { chmod, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { CommandFailedException, FolderNotPrivateException, MacFolderProtector, SystemCommand } from "@noldova/desktop.runtime";

import { MacListingFixture } from "../../fixtures/mac-listing.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class MacFolderProtectorTests {
  @TestMethod
  @TestData("drwx------  2 person  staff  64 Oct 16 12:00 /Users/person/discovery\n")
  @TestData(`${MacListingFixture.HEADER}\n 0: group:everyone deny delete\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:person inherited allow list,add_file,search,delete_child\n 1: group:staff inherited deny read\n`)
  @TestData(`${MacListingFixture.ATTRIBUTES_HEADER}\n`)
  public async passesAFolderOnlyThePersonCanReach(listing: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await chmod(folder.path, 0o755);
    const command = new SystemCommandFixture([listing]);

    await new MacFolderProtector(command, "person").protectAsync(folder.path);

    Assert.areEqual(`/bin/ls -led ${folder.path}`, command.calls.map(t => t.join(" ")).join(";"));
    if (process.platform !== "win32")
      Assert.areEqual(0o700, (await stat(folder.path)).mode & 0o777);
  }

  @TestMethod
  @TestData(`${MacListingFixture.HEADER}\n 0: group:everyone inherited allow list,search\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:visitor allow read\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: group:Domain Users allow list\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:person allow list\n 1: an entry ls never writes\n`)
  @TestData("drwxrwxrwx  2 person  staff  64 Oct 16 12:00 /Volumes/Shared/discovery\n")
  @TestData(`${MacListingFixture.HEADER}\n`)
  @TestData(`${MacListingFixture.HEADER}\n entries in a form ls never writes\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:person allow list\n entries in a form ls never writes\n`)
  @TestData(`${MacListingFixture.ATTRIBUTES_HEADER}\n entries in a form ls never writes\n`)
  @TestData(`${MacListingFixture.ATTRIBUTES_HEADER}\n 0: user:visitor allow read\n`)
  public async refusesAFolderStillOpenToAnyoneElse(listing: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    const exception = await Assert.throwsAsync(
      () => new MacFolderProtector(new SystemCommandFixture([listing]), "person").protectAsync(folder.path),
      FolderNotPrivateException);

    Assert.areEqual(`The folder ${folder.path} is still open to others: ${listing.trim()}`, exception.message);
  }

  @TestMethod
  public async reportsAListingThatFails(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const failure = new CommandFailedException("ls", new Error("Operation not permitted"));

    const exception = await Assert.throwsAsync(() => new MacFolderProtector(new SystemCommandFixture([failure])).protectAsync(folder.path), CommandFailedException);

    Assert.areEqual(failure, exception);
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async refusesARealFolderWithAnInheritedEntryAndPassesAPlainOne(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const shared = path.join(folder.path, "shared");
    const plain = path.join(folder.path, "plain");
    await mkdir(shared);
    await mkdir(plain);
    execFileSync("/bin/chmod", ["+a", "group:everyone allow list,search,file_inherit,directory_inherit", shared]);
    const inheriting = path.join(shared, "discovery");
    await mkdir(inheriting);
    const before = execFileSync("/bin/ls", ["-led", inheriting], { encoding: "utf8" });

    const exception = await Assert.throwsAsync(() => new MacFolderProtector(new SystemCommand()).protectAsync(inheriting), FolderNotPrivateException);
    await new MacFolderProtector(new SystemCommand()).protectAsync(plain);

    Assert.isTrue(before.includes("group:everyone inherited allow"), before);
    Assert.isTrue(exception.message.includes("group:everyone inherited allow"), exception.message);
    Assert.areEqual(0o700, (await stat(plain)).mode & 0o777);
  }
}
