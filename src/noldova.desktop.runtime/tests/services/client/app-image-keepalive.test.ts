/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { closeSync, constants, fstatSync, openSync, realpathSync } from "node:fs";
import { devNull } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { AppImageKeepalive, PosixProcessApi } from "@noldova/desktop.runtime";

import { DescriptorFolderPatchFixture } from "../../fixtures/descriptor-folder-patch.fixture.js";
import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class AppImageKeepaliveTests {
  private static readonly FOLDER: string = "/proc/4321/fd";
  private static readonly LISTING: string = "/home/person/.local/share/noldova/logs/copy-1.log.mount";

  @TestMethod
  public opensTheOnlyPipeTheProcessHoldsForReadingWithoutWaiting(): void {
    using fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER,
      new Map([["0", "/dev/null"], ["1", "/home/person/.local/share/noldova/logs/copy-1.log.mount"], ["3", "pipe:[81234]"], ["4", null], ["1023", "/tmp/.mount_AbCdEf"]]));

    const descriptor = AppImageKeepalive.open(4321);

    Assert.areEqual(DescriptorFolderPatchFixture.OPENED, descriptor);
    Assert.areEqual(`${AppImageKeepaliveTests.FOLDER}/3 ${constants.O_RDONLY | constants.O_NONBLOCK}`, fileSystem.opened.join(","));
    Assert.areEqual(0, fileSystem.closed.length);
  }

  @TestMethod
  @TestData(new Map([["0", "/dev/null"], ["1", "socket:[1]"]]))
  @TestData(new Map([["3", "pipe:[1]"], ["5", "pipe:[2]"]]))
  @TestData(new Map<string, string>())
  public opensNothingUnlessTheProcessHoldsExactlyOnePipe(links: ReadonlyMap<string, string>): void {
    using fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER, links);

    Assert.isNull(AppImageKeepalive.open(4321));
    Assert.areEqual(0, fileSystem.opened.length);
  }

  @TestMethod
  public opensNothingWhenThePipeClosesBetweenTheListingAndTheOpen(): void {
    using fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER, new Map([["0", "/dev/null"], ["63", "pipe:[81234]"]]));
    fileSystem.openFailure = "ENOENT";

    Assert.isNull(AppImageKeepalive.open(4321));
    Assert.areEqual(`${AppImageKeepaliveTests.FOLDER}/63 ${constants.O_RDONLY | constants.O_NONBLOCK}`, fileSystem.opened.join(","));
  }

  @TestMethod
  @TestData(false, 81234)
  @TestData(true, 90001)
  public closesAndOpensNothingWhenTheListedNumberNamesAnotherFileByTheOpen(fifo: boolean, inode: number): void {
    using fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER, new Map([["0", "/dev/null"], ["4", "pipe:[81234]"]]));
    fileSystem.openedFifo = fifo;
    fileSystem.openedInode = inode;

    Assert.isNull(AppImageKeepalive.open(4321));
    Assert.areEqual(`${AppImageKeepaliveTests.FOLDER}/4 ${constants.O_RDONLY | constants.O_NONBLOCK}`, fileSystem.opened.join(","));
    Assert.areEqual(String(DescriptorFolderPatchFixture.OPENED), fileSystem.closed.join(","));
  }

  @TestMethod
  public closesTheDescriptorAndThrowsWhenTheOpenedPipeCannotBeChecked(): void {
    using fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER, new Map([["0", "/dev/null"], ["4", "pipe:[81234]"]]));
    fileSystem.statFailure = "EIO";

    const error = Assert.throws(() => AppImageKeepalive.open(4321), Error);

    Assert.areEqual(`EIO: cannot stat descriptor ${DescriptorFolderPatchFixture.OPENED}`, error.message);
    Assert.areEqual(String(DescriptorFolderPatchFixture.OPENED), fileSystem.closed.join(","));
  }

  @TestMethod
  public opensNothingForAProcessThatHasEnded(): void {
    using fileSystem = new DescriptorFolderPatchFixture("/proc/1234/fd", new Map([["3", "pipe:[81234]"]]));

    Assert.isNull(AppImageKeepalive.open(4321));
    Assert.areEqual(0, fileSystem.opened.length);
  }

  @TestMethod
  public throwsWhenThePipeCannotBeOpenedForAnotherReason(): void {
    using fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER, new Map([["3", "pipe:[81234]"]]));
    fileSystem.openFailure = "EACCES";

    const error = Assert.throws(() => AppImageKeepalive.open(4321), Error);

    Assert.areEqual("EACCES", ErrorCodeFixture.of(error));
  }

  @TestMethod
  public throwsWhenADescriptorsLinkCannotBeReadForAnotherReason(): void {
    using fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER, new Map([["3", "pipe:[81234]"]]));
    fileSystem.linkFailure = "EIO";

    const error = Assert.throws(() => AppImageKeepalive.open(4321), Error);

    Assert.areEqual(`EIO: cannot read link '${AppImageKeepaliveTests.FOLDER}/3'`, error.message);
    Assert.areEqual(0, fileSystem.opened.length);
  }

  @TestMethod
  public findsTheProcessesWhoseStandardOutputIsTheFile(): void {
    using _fileSystem = new DescriptorFolderPatchFixture("/proc", new Map([
      ["4120/fd/1", AppImageKeepaliveTests.LISTING], ["4121/fd/1", "/dev/null"], ["4122/fd/1", null], ["4123/fd/1", AppImageKeepaliveTests.LISTING],
      ["4124/fd/1", `${AppImageKeepaliveTests.LISTING}.other`], ["self/fd/1", AppImageKeepaliveTests.LISTING], ["01/fd/1", AppImageKeepaliveTests.LISTING]
    ]), ["4120", "4121", "4122", "self", "4123", "4124", "01", "cpuinfo"]);

    Assert.areEqual("4120,4123", AppImageKeepalive.findWriters(AppImageKeepaliveTests.LISTING).join(","));
  }

  @TestMethod
  public throwsWhereTheProcessFolderCannotBeListed(): void {
    using _fileSystem = new DescriptorFolderPatchFixture(AppImageKeepaliveTests.FOLDER, new Map([["1", AppImageKeepaliveTests.LISTING]]));

    const error = Assert.throws(() => AppImageKeepalive.findWriters(AppImageKeepaliveTests.LISTING), Error);

    Assert.isTrue(error.message.startsWith("ENOENT: no such file or directory, scandir '/proc'"), error.message);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async findsAProcessWhoseStandardOutputIsTheFile(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "copy.log.mount");
    const output = openSync(file, "a");
    const child = spawn("/bin/sleep", ["30"], { stdio: ["ignore", output, "ignore"] });
    closeSync(output);
    try {
      await once(child, "spawn");

      Assert.areEqual(String(child.pid), AppImageKeepalive.findWriters(realpathSync(file)).join(","));
    }
    finally {
      child.kill();
    }
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async opensTheReadEndOfAPipeAnotherProcessHolds(): Promise<void> {
    const errors = openSync(devNull, "w");
    const processId = PosixProcessApi.create().startDetached("/bin/bash", ["-c", "exec 3< <(exec /bin/sleep 30); exec /bin/sleep 30"], [], errors);
    closeSync(errors);
    let descriptor: number | null = null;
    try {
      Assert.isTrue(await WaitFixture.untilAsync(() => !Object.isNull(descriptor = AppImageKeepalive.open(processId)), 9_000), "No pipe showed within 9 s.");

      Assert.isTrue(fstatSync(Number(descriptor)).isFIFO());
    }
    finally {
      if (!Object.isNull(descriptor))
        closeSync(descriptor);
      process.kill(-processId, "SIGKILL");
    }
  }
}
