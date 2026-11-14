/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FilePresence } from "../../../src/services/files/file-presence.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class FilePresenceTests {
  @TestMethod
  public async saysWhetherAFileOrFolderIsThere(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "runtime.json");
    const child = path.join(folder.path, "logs");
    await writeFile(file, "{}");
    await mkdir(child);

    const found = await Promise.all([file, child, path.join(folder.path, "missing.json")].map(t => FilePresence.existsAsync(t)));

    Assert.areEqual(JSON.stringify([true, true, false]), JSON.stringify(found));
  }

  @TestMethod
  public async givesTheResultOrNothingWhenTheFileIsMissing(): Promise<void> {
    const missing = Promise.reject(Object.assign(new Error("ENOENT: no such file or directory, open 'runtime.json'"), { code: "ENOENT" }));

    const read = await FilePresence.unlessMissingAsync(Promise.resolve("{}"));
    const absent = await FilePresence.unlessMissingAsync(missing);

    Assert.areEqual("{}", read);
    Assert.isNull(absent);
  }

  @TestMethod
  public async passesOnAnyOtherFailure(): Promise<void> {
    const denied = Promise.reject(Object.assign(new Error("EACCES: permission denied, open 'runtime.json'"), { code: "EACCES" }));

    const error = await Assert.throwsAsync(() => FilePresence.unlessMissingAsync(denied), Error);

    Assert.areEqual("EACCES: permission denied, open 'runtime.json'", error.message);
  }
}
