/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { FolderCreation } from "../../../src/services/files/folder-creation.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class FolderCreationTests {
  @TestMethod
  public async createsAFolderAndTheMissingFoldersAboveItAndKeepsOneThatExists(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const nested = path.join(folder.path, "logs", "runtime");

    const created = await FolderCreation.createAsync(nested);
    const kept = await FolderCreation.createAsync(nested);

    Assert.areEqual(path.toNamespacedPath(path.join(folder.path, "logs")), path.toNamespacedPath(String(created)));
    Assert.isUndefined(kept);
    Assert.isTrue(existsSync(nested));
  }

  @TestMethod
  public async keepsAFolderThatExistsWhenWindowsAnswersEpermForIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    const created = await FolderCreation.createAsync(folder.path, 0o700, FolderCreationTests.deny("EPERM", folder.path));

    Assert.isUndefined(created);
  }

  @TestMethod
  @TestData("missing")
  @TestData("file")
  public async passesOnEpermWhenNoFolderIsThere(name: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const target = path.join(folder.path, name);
    await writeFile(path.join(folder.path, "file"), "");

    const error = await Assert.throwsAsync(() => FolderCreation.createAsync(target, 0o700, FolderCreationTests.deny("EPERM", target)), Error);

    Assert.areEqual(`EPERM: operation not permitted, mkdir '${target}'`, error.message);
  }

  @TestMethod
  public async passesOnAnyOtherFailureEvenForAFolderThatExists(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    const error = await Assert.throwsAsync(() => FolderCreation.createAsync(folder.path, 0o700, FolderCreationTests.deny("EACCES", folder.path)), Error);

    Assert.areEqual(`EACCES: operation not permitted, mkdir '${folder.path}'`, error.message);
  }

  @TestMethod
  public async createsEveryFolderWithTheModeItIsGiven(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const asked: string[] = [];

    await FolderCreation.createAsync(path.join(folder.path, "private"), 0o700, async (target, options) => {
      asked.push(`${String(target)} ${JSON.stringify(options)}`);
      await mkdir(target, options);
      return undefined;
    });

    Assert.areEqual(`${path.join(folder.path, "private")} {"recursive":true,"mode":448}`, asked.join());
  }

  @TestMethod
  public async createsAFolderAndKeepsOneThatExistsWhileItWaits(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const nested = path.join(folder.path, "data", "owned");

    const created = FolderCreation.create(nested);
    const kept = FolderCreation.create(nested);

    Assert.areEqual(path.toNamespacedPath(path.join(folder.path, "data")), path.toNamespacedPath(String(created)));
    Assert.isUndefined(kept);
    Assert.isTrue(existsSync(nested));
  }

  @TestMethod
  public async keepsAFolderThatExistsWhenWindowsAnswersEpermForItWhileItWaits(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    const created = FolderCreation.create(folder.path, () => {
      throw FolderCreationTests.fail("EPERM", folder.path);
    });

    Assert.isUndefined(created);
  }

  @TestMethod
  @TestData("missing", "EPERM")
  @TestData("file", "EPERM")
  @TestData("", "EACCES")
  public async passesOnAFailureWhileItWaitsUnlessEpermMeetsAFolder(name: string, code: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const target = path.join(folder.path, name);
    await writeFile(path.join(folder.path, "file"), "");

    const error = Assert.throws(() => FolderCreation.create(target, () => {
      throw FolderCreationTests.fail(code, target);
    }), Error);

    Assert.areEqual(`${code}: operation not permitted, mkdir '${target}'`, error.message);
  }

  private static deny(code: string, folder: string): () => Promise<never> {
    return async () => {
      throw FolderCreationTests.fail(code, folder);
    };
  }

  private static fail(code: string, folder: string): Error {
    return Object.assign(new Error(`${code}: operation not permitted, mkdir '${folder}'`), { code });
  }
}
