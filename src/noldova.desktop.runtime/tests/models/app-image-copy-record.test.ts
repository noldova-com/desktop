/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateProcess } from "@noldova/desktop.protocol";
import { AppImageCopyRecord } from "@noldova/desktop.runtime";

import { SystemErrorCode } from "../../src/models/system-error-code.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";

@TestClass
export class AppImageCopyRecordTests {
  private static readonly EXTRACTED: string =
    "{\"holder\":{\"processId\":4120,\"earliest\":1500,\"latest\":1501,\"role\":\"runtime launcher\"},\"extraction\":\"/tmp/desktop-runtime-AbC123\",\"mounter\":null}";
  private static readonly MOUNTED: string =
    "{\"holder\":{\"processId\":4120,\"earliest\":1500,\"latest\":1501,\"role\":\"runtime launcher\"},\"extraction\":null," +
    "\"mounter\":{\"processId\":4121,\"earliest\":1502,\"latest\":1503,\"role\":\"AppImage mount\"}}";

  @TestMethod
  public pinsItsFileForm(): void {
    const extracted = AppImageCopyRecord.fromJson(JsonReader.parse(AppImageCopyRecordTests.EXTRACTED).toJson());

    Assert.areEqual(AppImageCopyRecordTests.EXTRACTED,
      JSON.stringify(new AppImageCopyRecord(new UpdateProcess(4120, 1500, 1501, "runtime launcher"), "/tmp/desktop-runtime-AbC123").toJson()));
    Assert.areEqual(AppImageCopyRecordTests.EXTRACTED, JSON.stringify(extracted.toJson()));
    Assert.areEqual(4120, extracted.holder.processId);
    Assert.areEqual("/tmp/desktop-runtime-AbC123", extracted.extraction);
    Assert.isNull(extracted.mounter);
  }

  @TestMethod
  public pinsTheFileFormOfAMountItHandsOver(): void {
    const mounted = AppImageCopyRecord.fromJson(JsonReader.parse(AppImageCopyRecordTests.MOUNTED).toJson());

    Assert.areEqual(AppImageCopyRecordTests.MOUNTED, JSON.stringify(new AppImageCopyRecord(new UpdateProcess(4120, 1500, 1501, "runtime launcher"), null,
      new UpdateProcess(4121, 1502, 1503, "AppImage mount")).toJson()));
    Assert.areEqual(AppImageCopyRecordTests.MOUNTED, JSON.stringify(mounted.toJson()));
    Assert.isNull(mounted.extraction);
    Assert.areEqual("4121 AppImage mount", `${mounted.mounter?.processId} ${mounted.mounter?.role}`);
  }

  @TestMethod
  public rejectsAnInvalidProcessExtractionOrMounterOrAnUnknownField(): void {
    const holder = { processId: 4120, earliest: 1500, latest: 1501, role: "runtime" };

    Assert.areEqual("$.holder.latest",
      Assert.throws(() => AppImageCopyRecord.fromJson({ holder: { ...holder, latest: 1 }, extraction: "/tmp/e", mounter: null }), JsonException).path);
    Assert.areEqual("$.extraction", Assert.throws(() => AppImageCopyRecord.fromJson({ holder, extraction: 1, mounter: null }), JsonException).path);
    Assert.areEqual("$.mounter", Assert.throws(() => AppImageCopyRecord.fromJson({ holder, extraction: null, mounter: 1 }), JsonException).path);
    Assert.areEqual("$.mounter", Assert.throws(() => AppImageCopyRecord.fromJson({ holder, extraction: null }), JsonException).path);
    Assert.areEqual("$.mounter.latest",
      Assert.throws(() => AppImageCopyRecord.fromJson({ holder, extraction: null, mounter: { ...holder, latest: 1 } }), JsonException).path);
    Assert.areEqual("$.mount", Assert.throws(() => AppImageCopyRecord.fromJson({ holder, mount: null, extraction: "/tmp/e", mounter: null }), JsonException).path);
  }

  @TestMethod
  public writesItsFileThroughATemporaryFileAndReadsItBack(): Promise<void> {
    return AppImageCopyRecordTests.runAsync(async folder => {
      const file = path.join(folder, "copy.log");
      const record = AppImageCopyRecord.fromJson(JsonReader.parse(AppImageCopyRecordTests.EXTRACTED).toJson());

      await record.writeAsync(file);

      Assert.areEqual(AppImageCopyRecordTests.EXTRACTED, await readFile(file, "utf8"));
      Assert.areEqual(AppImageCopyRecordTests.EXTRACTED, JSON.stringify((await AppImageCopyRecord.readAsync(file))?.toJson()));
      Assert.areEqual("copy.log", (await readdir(folder)).join(","));
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public writesItsFileForThePersonsAccountOnly(): Promise<void> {
    return AppImageCopyRecordTests.runAsync(async folder => {
      const file = path.join(folder, "copy.log");

      await AppImageCopyRecord.fromJson(JsonReader.parse(AppImageCopyRecordTests.EXTRACTED).toJson()).writeAsync(file);

      Assert.areEqual(0o600, (await stat(file)).mode & 0o777);
    });
  }

  @TestMethod
  public readsNoRecordFromAMissingFileAndRejectsAnUnreadableOne(): Promise<void> {
    return AppImageCopyRecordTests.runAsync(async folder => {
      Assert.isNull(await AppImageCopyRecord.readAsync(path.join(folder, "copy.log")));
      Assert.areEqual("EISDIR", SystemErrorCode.of(await Assert.throwsAsync(() => AppImageCopyRecord.readAsync(folder), Error)));
    });
  }

  private static async runAsync(action: (folder: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await action(folder.path);
  }
}
