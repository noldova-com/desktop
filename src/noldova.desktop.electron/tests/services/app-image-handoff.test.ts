/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageHandoff, NotAnAppImageException, UpdateChangedBeforeHandoffException, UpdateReadyRecord, UpdateUnsignedAtHandoffException } from "@noldova/desktop.electron";

@TestClass
export class AppImageHandoffTests {
  private static readonly HASH: string = createHash("sha512").update("Noldova Desktop Sample 1.3.0").digest("base64");

  @TestMethod
  public async replacesTheAppImageWithTheCheckedDownloadAndGivesNoProcess(): Promise<void> {
    await AppImageHandoffTests.withDownloadAsync(async download => {
      const replaced: string[] = [];
      const handoff = new AppImageHandoff({ replaceAsync: t => {
        replaced.push(t);
        return Promise.resolve();
      } }, () => Promise.resolve(null));

      const processId = await handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, AppImageHandoffTests.HASH, true, null));

      Assert.isNull(processId);
      Assert.isNull(handoff.refusal);
      Assert.areEqual(JSON.stringify([download]), JSON.stringify(replaced));
    });
  }

  @TestMethod
  public async refusesADownloadThatChangedOrIsGoneWithoutReplacingAnything(): Promise<void> {
    await AppImageHandoffTests.withDownloadAsync(async download => {
      const replaced: string[] = [];
      const handoff = new AppImageHandoff({ replaceAsync: t => {
        replaced.push(t);
        return Promise.resolve();
      } }, () => Promise.resolve(null));

      const changed = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, "b3RoZXI=", true, null)), UpdateChangedBeforeHandoffException);
      const gone = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", `${download}.gone`, AppImageHandoffTests.HASH, true, null)), UpdateChangedBeforeHandoffException);

      Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", changed.message);
      Assert.areEqual(changed.message, gone.message);
      Assert.areEqual(0, replaced.length);
    });
  }

  @TestMethod
  public async refusesWhenTheMainProcessDoesNotRunFromAnAppImageAndLeavesNothingToClear(): Promise<void> {
    await AppImageHandoffTests.withDownloadAsync(async download => {
      const handoff = new AppImageHandoff(null, () => Promise.resolve(null));

      const failure = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, AppImageHandoffTests.HASH, true, null)), NotAnAppImageException);
      await handoff.clearAsync();

      Assert.areEqual("This copy of Noldova Desktop Sample doesn't run from an AppImage, so it can't install the update.", failure.message);
      Assert.areEqual(failure.message, handoff.refusal);
    });
  }

  @TestMethod
  public async refusesAReadyRecordWhoseSignatureFailsItsCheckAndReplacesNothing(): Promise<void> {
    await AppImageHandoffTests.withDownloadAsync(async download => {
      const replaced: string[] = [];
      const checked: UpdateReadyRecord[] = [];
      const handoff = new AppImageHandoff({ replaceAsync: t => {
        replaced.push(t);
        return Promise.resolve();
      } }, t => {
        checked.push(t);
        return Promise.resolve("its signature is not by a key this build ships");
      });
      const record = new UpdateReadyRecord("1.3.0", download, AppImageHandoffTests.HASH, true, "c2ln");

      const failure = await Assert.throwsAsync(() => handoff.handOffAsync(record), UpdateUnsignedAtHandoffException);

      Assert.areEqual(`The update ${download} carries no valid signature, so it was not installed: its signature is not by a key this build ships`, failure.message);
      Assert.areEqual(download, failure.file);
      Assert.isTrue(checked[0] === record);
      Assert.areEqual(1, checked.length);
      Assert.areEqual(0, replaced.length);
    });
  }

  private static async withDownloadAsync(run: (download: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-app-image-handoff-"));
    try {
      const download = join(folder, "Noldova Desktop Sample-linux-x64.AppImage");
      await writeFile(download, "Noldova Desktop Sample 1.3.0");
      await run(download);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
