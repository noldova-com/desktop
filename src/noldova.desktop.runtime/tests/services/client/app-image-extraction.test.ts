/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageCopyUnavailableException, AppImageExtraction } from "@noldova/desktop.runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class AppImageExtractionTests {
  @TestMethod
  public async givesTheFolderTheAppImageExtractsIntoOnceItEndsWell(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const image = process.platform === "win32" ? path.join(process.env["SystemRoot"] ?? String.empty, "System32", "cmd.exe") : "/usr/bin/true";
    const startLog = path.join(folder.path, "start.log");

    const extracted = await AppImageExtraction.extractAsync(image, folder.path, process.env, startLog);

    Assert.areEqual(path.join(folder.path, "squashfs-root"), extracted);
    Assert.isTrue(existsSync(startLog));
  }

  @TestMethod
  public async failsWhenTheAppImageCannotStart(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const image = path.join(folder.path, "missing.AppImage");

    const exception = await Assert.throwsAsync(() => AppImageExtraction.extractAsync(image, folder.path, process.env, path.join(folder.path, "start.log")), AppImageCopyUnavailableException);

    Assert.areEqual(`${image} could be neither mounted nor extracted, so the runtime cannot start.`, exception.message);
    Assert.isInstanceOf(exception.cause, Error);
  }

  @TestMethod
  public async failsWhenTheAppImageEndsWithAnError(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    const exception = await Assert.throwsAsync(() => AppImageExtraction.extractAsync(process.execPath, folder.path, process.env, path.join(folder.path, "start.log")),
      AppImageCopyUnavailableException);

    Assert.areEqual(`${process.execPath} could be neither mounted nor extracted, so the runtime cannot start.`, exception.message);
    Assert.isUndefined(exception.cause);
  }

  @PlatformFixture.posixOnly()
  @TestMethod
  public async failsWhenTheAppImageIsEndedBySignal(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const image = path.join(folder.path, "ended.AppImage");
    await writeFile(image, "#!/bin/sh\nkill -KILL $$\n", { mode: 0o755 });

    const exception = await Assert.throwsAsync(() => AppImageExtraction.extractAsync(image, folder.path, process.env, path.join(folder.path, "start.log")), AppImageCopyUnavailableException);

    Assert.areEqual(`${image} could be neither mounted nor extracted, so the runtime cannot start.`, exception.message);
    Assert.isUndefined(exception.cause);
  }
}
