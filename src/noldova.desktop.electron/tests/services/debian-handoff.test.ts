/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DebianHandoff, DebianInstallerMissingException, DebianPackageNotInstalledException, UpdateChangedBeforeHandoffException, UpdateReadyRecord, UpdateSignatureCheck,
  UpdateUnsignedAtHandoffException } from "@noldova/desktop.electron";

@TestClass
export class DebianHandoffTests {
  private static readonly HASH: string = createHash("sha512").update("Noldova Desktop Sample 1.3.0").digest("base64");

  @TestMethod
  public async installsTheCheckedDownloadThroughPkexecAndGivesNoProcess(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const ran: string[][] = [];
      const handoff = new DebianHandoff("/usr/bin/pkexec", (program, args) => {
        ran.push([program, ...args]);
        return Promise.resolve();
      }, () => Promise.resolve(null));

      const processId = await handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, null));
      await handoff.clearAsync();

      Assert.isNull(processId);
      Assert.isNull(handoff.refusal);
      Assert.areEqual(JSON.stringify([["/usr/bin/pkexec", "/usr/bin/dpkg", "--install", download]]), JSON.stringify(ran));
    });
  }

  @TestMethod
  public async refusesADownloadThatChangedOrIsGoneWithoutInstallingAnything(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const ran: string[] = [];
      const handoff = new DebianHandoff("/usr/bin/pkexec", program => {
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
      const handoff = new DebianHandoff("/usr/bin/pkexec", () => Promise.reject(new Error("Command failed: pkexec, request dismissed")), () => Promise.resolve(null));

      const failure = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, DebianHandoffTests.HASH, true, null)), DebianPackageNotInstalledException);

      Assert.areEqual(download, failure.file);
      Assert.areEqual(`The Debian package ${download} could not be installed, so the installed version was left as it was: Error: Command failed: pkexec, request dismissed`, failure.message);
    });
  }

  @TestMethod
  public async refusesWithoutPkexecAndRunsNothing(): Promise<void> {
    await DebianHandoffTests.withDownloadAsync(async download => {
      const ran: string[] = [];
      const handoff = new DebianHandoff(null, program => {
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
      const handoff = new DebianHandoff("/usr/bin/pkexec", program => {
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
