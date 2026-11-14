/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Resources } from "../../../src/resources.js";
import { GalleryFile } from "../../../src/services/angular/gallery-file.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class GalleryFileTests {
  @TestMethod
  public async writesTheGalleryForADevelopmentBuildAndNoneForAPackagedOne(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    const file = new GalleryFile(tree.path);

    await file.writeAsync(false);
    const development = await readFile(file.file, "utf8");
    const isDevelopmentPackaged = await file.isPackagedAsync();
    await file.writeAsync(true);

    Assert.areEqual(path.join(tree.path, ...Resources.galleryFileSegments), file.file);
    Assert.areEqual(Resources.formatGalleryFileContent(Resources.galleryComponentImport + Resources.galleryTypeImport, false), development);
    Assert.isFalse(isDevelopmentPackaged);
    Assert.areEqual(Resources.formatGalleryFileContent(Resources.galleryTypeImport, true), await readFile(file.file, "utf8"));
    Assert.isTrue(await file.isPackagedAsync());
  }
}
