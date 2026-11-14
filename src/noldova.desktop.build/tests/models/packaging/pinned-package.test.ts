/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PinnedPackage } from "../../../src/models/packaging/pinned-package.js";

@TestClass
export class PinnedPackageTests {
  @TestMethod
  public keepsTheUrlHashAndFolderOfThePackage(): void {
    const pinned = new PinnedPackage("https://example.com/module.nupkg", "hash", "Module");

    Assert.areEqual("https://example.com/module.nupkg hash Module", `${pinned.url} ${pinned.sha512} ${pinned.folder}`);
  }
}
