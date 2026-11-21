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
import { AppImageHandoff, NotAnAppImageException, UpdateChangedBeforeHandoffException, UpdateReadyRecord } from "@noldova/desktop.electron";

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
      } });

      const processId = await handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, AppImageHandoffTests.HASH, true));

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
      } });

      const changed = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, "b3RoZXI=", true)), UpdateChangedBeforeHandoffException);
      const gone = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", `${download}.gone`, AppImageHandoffTests.HASH, true)), UpdateChangedBeforeHandoffException);

      Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", changed.message);
      Assert.areEqual(changed.message, gone.message);
      Assert.areEqual(0, replaced.length);
    });
  }

  @TestMethod
  public async refusesWhenTheMainProcessDoesNotRunFromAnAppImageAndLeavesNothingToClear(): Promise<void> {
    await AppImageHandoffTests.withDownloadAsync(async download => {
      const handoff = new AppImageHandoff(null);

      const failure = await Assert.throwsAsync(() => handoff.handOffAsync(new UpdateReadyRecord("1.3.0", download, AppImageHandoffTests.HASH, true)), NotAnAppImageException);
      await handoff.clearAsync();

      Assert.areEqual("This copy of Noldova Desktop Sample doesn't run from an AppImage, so it can't install the update.", failure.message);
      Assert.areEqual(failure.message, handoff.refusal);
    });
  }

  @TestMethod
  public refusesWithTheFolderRefusalItWasGivenOnlyForAnAppImage(): void {
    const replacement = { replaceAsync: () => Promise.resolve() };

    const refusals = [new AppImageHandoff(replacement, "The folder /opt/apps cannot be written."), new AppImageHandoff(replacement), new AppImageHandoff(null, "unused")]
      .map(t => t.refusal);

    Assert.areEqual(JSON.stringify(["The folder /opt/apps cannot be written.", null,
      "This copy of Noldova Desktop Sample doesn't run from an AppImage, so it can't install the update."]), JSON.stringify(refusals));
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
