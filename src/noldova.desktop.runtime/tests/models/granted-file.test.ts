/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { open, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrantedFile } from "@noldova/desktop.runtime";

import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";

@TestClass
export class GrantedFileTests {
  @TestMethod
  public async closesItsHandleOnceAndKeepsAFileItDidNotStage(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "plans.txt");
    await writeFile(file, "plans");
    const granted = new GrantedFile("plans.txt", "text/plain", 5, await open(file, "r"));

    const first = granted.closeAsync();
    const second = granted.closeAsync();
    await first;

    Assert.areEqual(first, second);
    Assert.areEqual(-1, granted.handle.fd);
    Assert.areEqual("plans.txt|text/plain|5", `${granted.name}|${granted.mediaType}|${String(granted.size)}`);
    Assert.isTrue(existsSync(file));
  }

  @TestMethod
  public async removesTheStagedCopyWhenDisposed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const staged = path.join(folder.path, "staged-plans.txt");
    await writeFile(staged, "plans");
    const granted = new GrantedFile("plans.txt", "text/plain", 5, await open(staged, "r"), staged);
    Assert.isTrue(existsSync(staged));

    await granted[Symbol.asyncDispose]();

    Assert.areEqual(-1, granted.handle.fd);
    Assert.isFalse(existsSync(staged));
  }
}
