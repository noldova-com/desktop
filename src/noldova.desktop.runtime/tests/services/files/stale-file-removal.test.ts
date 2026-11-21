/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { mock } from "node:test";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateProcess } from "@noldova/desktop.protocol";
import { RemovalUnclaimedException, StaleFileRemoval } from "@noldova/desktop.runtime";

import { SystemErrorCode } from "../../../src/models/system-error-code.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class StaleFileRemovalTests {
  private static readonly SELF: UpdateProcess = new UpdateProcess(4120, 1500, 1501, "stale file remover");
  private static readonly GONE: UpdateProcess = new UpdateProcess(4121, 1500, 1501, "stale file remover");

  @TestMethod
  public async removesTheFileOnlyWhileItIsTheOneJudgedStale(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "lock.json");
    const removal = StaleFileRemovalTests.open(file, []);
    await writeFile(file, "stale");

    const changed = await removal.removeAsync("other");
    const kept = await readFile(file, "utf8");
    const removed = await removal.removeAsync("stale");
    const missing = await removal.removeAsync("stale");

    Assert.areEqual("false stale true true", `${changed} ${kept} ${removed} ${missing}`);
    Assert.areEqual(String.empty, (await readdir(folder.path)).join(","));
  }

  @TestMethod
  public async letsOnlyOneOfTwoRacingRemoversRemoveTheFileItJudgedStale(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "lock.json");
    await writeFile(file, "stale");
    const removeFile = fs.promises.rm;
    fs.promises.rm = async (target, options) => {
      await removeFile(target, options);
      if (target === file)
        await writeFile(file, "fresh");
    };
    syncBuiltinESMExports();
    let results: boolean[];
    try {
      results = await Promise.all([StaleFileRemovalTests.open(file, []).removeAsync("stale"), StaleFileRemovalTests.open(file, []).removeAsync("stale")]);
    }
    finally {
      fs.promises.rm = removeFile;
      syncBuiltinESMExports();
    }

    Assert.areEqual("false,true", results.map(String).sort().join(","));
    Assert.areEqual("fresh", await readFile(file, "utf8"));
    Assert.areEqual("lock.json", (await readdir(folder.path)).join(","));
  }

  @TestMethod
  public async deletesTheIntentsOfRemoversThatEndedSkipsOneThatEndedWhileListedAndLeavesOtherFilesAlone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "lock.json");
    const asked: number[] = [];
    const removal = StaleFileRemovalTests.open(file, asked);
    await writeFile(file, "stale");
    await writeFile(path.join(folder.path, "lock.json.ended.removing"), JSON.stringify(StaleFileRemovalTests.GONE.toJson()));
    await writeFile(path.join(folder.path, "lock.json.broken.removing"), "{\"processId\":");
    await writeFile(path.join(folder.path, "other.json.live.removing"), JSON.stringify(StaleFileRemovalTests.SELF.toJson()));
    await writeFile(path.join(folder.path, "lock.json.written.tmp"), "half");
    const vanishing = path.join(folder.path, "lock.json.vanishing.removing");
    await writeFile(vanishing, JSON.stringify(StaleFileRemovalTests.SELF.toJson()));
    const read = fs.promises.readFile;
    const reading = mock.method(fs.promises, "readFile", async (...values: Parameters<typeof fs.promises.readFile>): Promise<string | Buffer> => {
      if (values[0] === vanishing)
        await rm(vanishing);
      return await read(...values);
    });
    syncBuiltinESMExports();
    let removed: boolean;
    try {
      removed = await removal.removeAsync("stale");
    }
    finally {
      reading.mock.restore();
      syncBuiltinESMExports();
    }

    Assert.isTrue(removed);
    Assert.areEqual("4121", asked.join(","));
    Assert.areEqual("lock.json.written.tmp,other.json.live.removing", (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async leavesTheFileWhileAnotherRunningRemoverHoldsOrIsWritingItsIntent(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "lock.json");
    const live = path.join(folder.path, "lock.json.live.removing");
    const busy = path.join(folder.path, "lock.json.busy.removing");
    const removal = StaleFileRemovalTests.open(file, []);
    await writeFile(file, "stale");
    await writeFile(live, JSON.stringify(StaleFileRemovalTests.SELF.toJson()));

    const whileLive = await removal.removeAsync("stale");
    await rm(live);
    await writeFile(busy, JSON.stringify(StaleFileRemovalTests.GONE.toJson()));
    const read = fs.promises.readFile;
    const reading = mock.method(fs.promises, "readFile", (...values: Parameters<typeof fs.promises.readFile>): Promise<string | Buffer> => values[0] === busy
      ? Promise.reject(Object.assign(new Error("EBUSY: resource busy or locked, open"), { code: "EBUSY" }))
      : read(...values));
    syncBuiltinESMExports();
    let whileBusy: boolean;
    try {
      whileBusy = await removal.removeAsync("stale");
    }
    finally {
      reading.mock.restore();
      syncBuiltinESMExports();
    }

    Assert.areEqual("false false", `${whileLive} ${whileBusy}`);
    Assert.areEqual("stale", await readFile(file, "utf8"));
    Assert.areEqual("lock.json,lock.json.busy.removing", (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async passesOnAnIntentItCannotReadAndLeavesNoIntentOfItsOwn(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "lock.json");
    await writeFile(file, "stale");
    await mkdir(path.join(folder.path, "lock.json.folder.removing"));

    const error = await Assert.throwsAsync(() => StaleFileRemovalTests.open(file, []).removeAsync("stale"), Error);

    Assert.areEqual("EISDIR", SystemErrorCode.of(error));
    Assert.areEqual("lock.json,lock.json.folder.removing", (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async refusesToClaimTheRemovalWhenItsOwnProcessIsNotListed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "lock.json");
    await writeFile(file, "stale");
    const removal = new StaleFileRemoval(file, () => Promise.resolve(undefined), () => Promise.resolve(true));

    const error = await Assert.throwsAsync(() => removal.removeAsync("stale"), RemovalUnclaimedException);

    Assert.areEqual(file, error.file);
    Assert.areEqual(`The process removing ${file} is not in the process table, so it cannot claim the removal.`, error.message);
    Assert.areEqual("lock.json", (await readdir(folder.path)).join(","));
  }

  private static open(file: string, asked: number[]): StaleFileRemoval {
    return new StaleFileRemoval(file, () => Promise.resolve(StaleFileRemovalTests.SELF), t => {
      asked.push(t.processId);
      return Promise.resolve(t.processId === StaleFileRemovalTests.SELF.processId);
    });
  }
}
