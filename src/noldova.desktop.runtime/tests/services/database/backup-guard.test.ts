/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BackupGuard } from "@noldova/desktop.runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class BackupGuardTests {
  private static readonly REFUSAL_WAIT: number = 5;

  @TestMethod
  public async createsItsFolderAndItsGuardFileWhenItHolds(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const backups = path.join(folder.path, "nested", "backups");

    using guard = await BackupGuard.holdAsync(backups);

    Assert.isTrue(guard.isHeld);
    Assert.areEqual(".backup-guard", (await readdir(backups)).join(","));
  }

  @TestMethod
  public async holdsAloneOnlyWhileNoOtherGuardHoldsTheFolder(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const shared = await BackupGuard.holdAsync(folder.path);

    const refused = await BackupGuard.holdAloneAsync(folder.path, BackupGuardTests.REFUSAL_WAIT);
    shared.release();
    using alone = await BackupGuard.holdAloneAsync(folder.path, BackupGuardTests.REFUSAL_WAIT);

    Assert.isNull(refused);
    Assert.isTrue(alone?.isHeld ?? false);
  }

  @TestMethod
  public async refusesToHoldWhileTheFolderIsHeldAloneAndHoldsOnceItIsReleased(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const alone = await BackupGuard.holdAloneAsync(folder.path);
    Assert.isTrue(alone?.isHeld ?? false);

    await Assert.throwsAsync(() => BackupGuard.holdAsync(folder.path, BackupGuardTests.REFUSAL_WAIT), Error);
    alone?.release();
    using shared = await BackupGuard.holdAsync(folder.path, BackupGuardTests.REFUSAL_WAIT);

    Assert.isTrue(shared.isHeld);
  }

  @TestMethod
  public async passesOnAFailureThatIsNotABusyFolder(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await writeFile(path.join(folder.path, ".backup-guard"), "This is plain text, not a SQLite database, and it is long enough to have a header.");

    await Assert.throwsAsync(() => BackupGuard.holdAloneAsync(folder.path, BackupGuardTests.REFUSAL_WAIT), Error);
    await Assert.throwsAsync(() => BackupGuard.holdAsync(folder.path, BackupGuardTests.REFUSAL_WAIT), Error);
  }

  @TestMethod
  public async releasesItsGuardOnceWhetherReleasedOrDisposed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const released = await BackupGuard.holdAsync(folder.path);
    released.release();
    released.release();
    {
      using disposed = await BackupGuard.holdAloneAsync(folder.path);
      Assert.isTrue(disposed?.isHeld ?? false);
    }

    using after = await BackupGuard.holdAloneAsync(folder.path);

    Assert.isFalse(released.isHeld);
    Assert.isTrue(after?.isHeld ?? false);
  }
}
