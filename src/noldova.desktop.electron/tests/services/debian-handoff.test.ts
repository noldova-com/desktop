/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  DebianHandoff, DebianInstallerMissingException, DebianPackageNotInstalledException, DebianUpdateArgumentsRefusedException, DebianUpdateInstallerMissingException,
  UpdateChangedBeforeHandoffException, UpdateReadyRecord, UpdateSignatureCheck, UpdateUnsignedAtHandoffException
} from "@noldova/desktop.electron";

import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class DebianHandoffTests {
  private static readonly HASH: string = createHash("sha512").update("Noldova Desktop Sample 1.3.0").digest("base64");
  private static readonly INSTALLER: string = "/opt/Noldova Desktop Sample/resources/linux-update-install";

  @TestMethod
  public async installsTheCheckedDownloadThroughTheUpdateInstallerUnderPkexecWithItsHashInHexAndGivesNoProcess(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const ran: string[][] = [];
      const handoff = new DebianHandoff("/usr/bin/pkexec", DebianHandoffTests.INSTALLER, (program, args) => {
        ran.push([program, ...args]);
        return Promise.resolve();
      }, () => Promise.resolve(null));

      const processId = await handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, null));
      await handoff.clearAsync();

      Assert.isNull(processId);
      Assert.isNull(handoff.refusal);
      Assert.areEqual(JSON.stringify([["/usr/bin/pkexec", DebianHandoffTests.INSTALLER, download, Buffer.from(DebianHandoffTests.HASH, "base64").toString("hex")]]), JSON.stringify(ran));
      Assert.areEqual(128, ran[0]?.[3]?.length);
    });
  }

  @TestMethod
  public async refusesADownloadThatChangedOrIsGoneWithoutInstallingAnything(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const ran: string[] = [];
      const handoff = new DebianHandoff("/usr/bin/pkexec", DebianHandoffTests.INSTALLER, program => {
        ran.push(program);
        return Promise.resolve();
      }, () => Promise.resolve(null));

      const changed = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, "b3RoZXI=", true, null)), UpdateChangedBeforeHandoffException);
      const gone = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", `${download}.gone`, DebianHandoffTests.HASH, true, null)), UpdateChangedBeforeHandoffException);

      Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", changed.message);
      Assert.areEqual(changed.message, gone.message);
      Assert.areEqual(0, ran.length);
    });
  }

  @TestMethod
  public async reportsAnInstallThatFailsWithItsCause(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const handoff = new DebianHandoff("/usr/bin/pkexec", DebianHandoffTests.INSTALLER, () => Promise.reject(new Error("Command failed: pkexec, request dismissed")), () => Promise.resolve(null));

      const failure = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, null)), DebianPackageNotInstalledException);

      Assert.areEqual(download, failure.file);
      Assert.areEqual(`The Debian package ${download} could not be installed, so the installed version was left as it was: Error: Command failed: pkexec, request dismissed`, failure.message);
    });
  }

  @TestMethod
  public async refusesWithoutPkexecAndRunsNothing(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const ran: string[] = [];
      const handoff = new DebianHandoff(null, DebianHandoffTests.INSTALLER, program => {
        ran.push(program);
        return Promise.resolve();
      }, () => Promise.resolve(null));

      const failure = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, null)), DebianInstallerMissingException);

      Assert.areEqual("This copy of Noldova Desktop Sample is a Debian package, but this system has no pkexec to ask for an administrator's permission, so it can't install the update.",
        failure.message);
      Assert.areEqual(failure.message, handoff.refusal);
      Assert.areEqual(0, ran.length);
    });
  }

  @TestMethod
  public async checksTheReadyRecordsSignatureAgainAndRunsNothingForAnUnsignedOrForgedOne(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const [shipped, other] = [generateKeyPairSync("ed25519"), generateKeyPairSync("ed25519")];
      const check = new UpdateSignatureCheck([shipped.publicKey.export({ type: "spki", format: "der" }).toString("base64")], "linux", "x64", () => undefined, () => 0);
      const message = Buffer.from(`noldova-desktop-update/1\n1.3.0\nlinux-x64\n${basename(download)}\n${DebianHandoffTests.HASH}\n`, "utf8");
      const ran: string[] = [];
      const handoff = new DebianHandoff("/usr/bin/pkexec", DebianHandoffTests.INSTALLER, program => {
        ran.push(program);
        return Promise.resolve();
      }, t => check.checkReadyAsync(t));
      const record = (signature: string | null): UpdateReadyRecord => new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, signature);

      const unsigned = await Assert.throwsAsync(() => handoff.handOffAsync(record(null)), UpdateUnsignedAtHandoffException);
      const forged = await Assert.throwsAsync(() => handoff.handOffAsync(record(sign(null, message, other.privateKey).toString("base64"))), UpdateUnsignedAtHandoffException);
      const refused = ran.length;
      await handoff.handOffAsync(record(sign(null, message, shipped.privateKey).toString("base64")));

      Assert.areEqual(download, unsigned.file);
      Assert.areEqual(`The update ${download} carries no valid signature, so it was not installed: the ready update's record carries no signature for it`, unsigned.message);
      Assert.areEqual("its signature is not by a key this build ships", forged.problem);
      Assert.areEqual(0, refused);
      Assert.areEqual(1, ran.length);
    });
  }

  @TestMethod
  public async tellsEachRefusalOfTheUpdateInstallerByItsExitCode(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const record = new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, null);
      const failWith = (code: number | string): DebianHandoff => new DebianHandoff("/usr/bin/pkexec", DebianHandoffTests.INSTALLER,
        () => Promise.reject(Object.assign(new Error(`Command failed: pkexec, exit ${code}`), { code })), () => Promise.resolve(null));

      const changed = await Assert.throwsAsync(() => failWith(65).handOffAsync(record), UpdateChangedBeforeHandoffException);
      const refused = await Assert.throwsAsync(() => failWith(64).handOffAsync(record), DebianUpdateArgumentsRefusedException);
      const failures = [
        await Assert.throwsAsync(() => failWith(66).handOffAsync(record), DebianPackageNotInstalledException),
        await Assert.throwsAsync(() => failWith(126).handOffAsync(record), DebianPackageNotInstalledException),
        await Assert.throwsAsync(() => failWith("65").handOffAsync(record), DebianPackageNotInstalledException)
      ];

      Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", changed.message);
      Assert.areEqual(download, refused.file);
      Assert.areEqual(`The update installer refused ${download}, which is not a regular file, so the installed version was left as it was.`, refused.message);
      Assert.areEqual(JSON.stringify(["66", "126", "65"].map(t => `The Debian package ${download} could not be installed, so the installed version was left as it was: Error: Command failed: pkexec, exit ${t}`)),
        JSON.stringify(failures.map(t => t.message)));
    });
  }

  @TestMethod
  public async refusesWithoutAnUpdateInstallerOnlyRootCanChangeAndRunsNothing(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const ran: string[] = [];
      const handoff = new DebianHandoff("/usr/bin/pkexec", null, program => {
        ran.push(program);
        return Promise.resolve();
      }, () => Promise.resolve(null));

      const failure = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, null)), DebianUpdateInstallerMissingException);

      Assert.areEqual("This copy of Noldova Desktop Sample is a Debian package, but its update installer is missing or can be changed by someone other than root, so it can't install the update.",
        failure.message);
      Assert.areEqual(failure.message, handoff.refusal);
      Assert.areEqual(0, ran.length);
    });
  }

  @TestMethod
  public async findsNoUpdateInstallerThatIsMissingNotAFileOrWritableByItsGroupOrOthers(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const folder = dirname(download);
      const [group, others] = [join(folder, "group-writable"), join(folder, "others-writable")];
      await writeFile(group, "#!/bin/sh\n");
      await chmod(group, 0o775);
      await writeFile(others, "#!/bin/sh\n");
      await chmod(others, 0o757);

      const found = [group, others, folder, join(folder, "missing")].map(t => DebianHandoff.findUpdateInstaller(t));

      Assert.areEqual(JSON.stringify([null, null, null, null]), JSON.stringify(found));
    });
  }

  @TestMethod
  public takesOnlyARegularFileOwnedByRootThatNeitherItsGroupNorOthersCanWrite(): void {
    const cases: readonly (readonly [boolean, number, number, boolean])[] = [
      [true, 0, 0o100755, true],
      [true, 0, 0o100700, true],
      [true, 0, 0o100775, false],
      [true, 0, 0o100757, false],
      [true, 1000, 0o100755, false],
      [false, 0, 0o040755, false]
    ];

    const taken = cases.map(([isFile, uid, mode]) => DebianHandoff.isOnlyRootsToChange({ isFile: () => isFile, uid, mode }));

    Assert.areEqual(JSON.stringify(cases.map(t => t[3])), JSON.stringify(taken));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public findsAnUpdateInstallerOwnedByRootThatOnlyRootCanWrite(): void {
    Assert.areEqual("/bin/sh", DebianHandoff.findUpdateInstaller("/bin/sh"));
  }

  private static async withDownloadAsync(run: (download: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-debian-handoff-"));
    try {
      const download = join(folder, "Noldova Desktop Sample-linux-x64.deb");
      await writeFile(download, "Noldova Desktop Sample 1.3.0");
      await run(download);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
