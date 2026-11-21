/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FolderFixture } from "./folder.fixture.js";

@TestClass
export class FolderFixtureTests {
  @TestMethod
  public async createsAMissingFolderWithItsMissingParents(): Promise<void> {
    await FolderFixtureTests.withFolderAsync(async folder => {
      const nested = path.join(folder, "node_modules", "@scope", "package");

      await FolderFixture.ensureAsync(nested);

      Assert.isTrue(statSync(nested).isDirectory());
    });
  }

  @TestMethod
  public async keepsAFolderThatExistsWithoutAskingForItAgain(): Promise<void> {
    await FolderFixtureTests.withFolderAsync(async folder => {
      const made: string[] = [];
      const refuseExisting = (target: string): Promise<unknown> => {
        made.push(target);
        return existsSync(target)
          ? Promise.reject(Object.assign(new Error(`EPERM: operation not permitted, mkdir '${target}'`), { code: "EPERM" }))
          : mkdir(target, { recursive: true });
      };
      const missing = path.join(folder, "missing");

      await FolderFixture.ensureAsync(folder, refuseExisting);
      await FolderFixture.ensureAsync(missing, refuseExisting);
      await FolderFixture.ensureAsync(missing, refuseExisting);

      Assert.areEqual(JSON.stringify([missing]), JSON.stringify(made));
      Assert.isTrue(statSync(missing).isDirectory());
    });
  }

  private static async withFolderAsync(body: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-build-folder-"));
    try {
      await body(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
