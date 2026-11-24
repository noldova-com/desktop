/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { FolderCreation } from "../../../src/services/files/folder-creation.js";

@TestClass
export class FolderCreationTests {
  @TestMethod
  public async createsAFolderAndTheMissingFoldersAboveItAndKeepsOneThatExists(): Promise<void> {
    await FolderCreationTests.withFolderAsync(async folder => {
      const nested = path.join(folder, "package", "app");

      const created = await FolderCreation.createAsync(nested);
      const kept = await FolderCreation.createAsync(nested);

      Assert.areEqual(path.join(folder, "package"), created);
      Assert.isUndefined(kept);
      Assert.isTrue(existsSync(nested));
    });
  }

  @TestMethod
  public async keepsAFolderThatExistsWhenWindowsAnswersEpermForIt(): Promise<void> {
    await FolderCreationTests.withFolderAsync(async folder => {
      const created = await FolderCreation.createAsync(folder, 0o700, FolderCreationTests.deny("EPERM", folder));

      Assert.isUndefined(created);
    });
  }

  @TestMethod
  @TestData("missing")
  @TestData("file")
  public async passesOnEpermWhenNoFolderIsThere(name: string): Promise<void> {
    await FolderCreationTests.withFolderAsync(async folder => {
      const target = path.join(folder, name);
      await writeFile(path.join(folder, "file"), "");

      const error = await Assert.throwsAsync(() => FolderCreation.createAsync(target, 0o700, FolderCreationTests.deny("EPERM", target)), Error);

      Assert.areEqual(`EPERM: operation not permitted, mkdir '${target}'`, error.message);
    });
  }

  @TestMethod
  public async passesOnAnyOtherFailureEvenForAFolderThatExists(): Promise<void> {
    await FolderCreationTests.withFolderAsync(async folder => {
      const error = await Assert.throwsAsync(() => FolderCreation.createAsync(folder, 0o700, FolderCreationTests.deny("EACCES", folder)), Error);

      Assert.areEqual(`EACCES: operation not permitted, mkdir '${folder}'`, error.message);
    });
  }

  @TestMethod
  public async createsEveryFolderWithTheModeItIsGiven(): Promise<void> {
    await FolderCreationTests.withFolderAsync(async folder => {
      const asked: string[] = [];

      await FolderCreation.createAsync(path.join(folder, "signing"), 0o700, async (target, options) => {
        asked.push(`${String(target)} ${JSON.stringify(options)}`);
        await mkdir(target, options);
        return undefined;
      });

      Assert.areEqual(`${path.join(folder, "signing")} {"recursive":true,"mode":448}`, asked.join());
    });
  }

  private static deny(code: string, folder: string): () => Promise<never> {
    return async () => {
      throw FolderCreationTests.fail(code, folder);
    };
  }

  private static fail(code: string, folder: string): Error {
    return Object.assign(new Error(`${code}: operation not permitted, mkdir '${folder}'`), { code });
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-folder-creation-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
