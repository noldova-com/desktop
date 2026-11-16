/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { StampedFile } from "../../src/models/stamped-file.js";

@TestClass
export class StampedFileTests {
  @TestMethod
  public keepsThePathTheDeviceTheInodeAndTheSize(): void {
    const file = new StampedFile("/opt/Fixture Studio/fixture-studio", 2049n, 131n, 228826440n);

    Assert.areEqual("/opt/Fixture Studio/fixture-studio", file.path);
    Assert.areEqual("2049:131:228826440", [file.device, file.inode, file.size].join(":"));
  }

  @TestMethod
  public isTheSameFileOnlyWithTheSameDeviceAndInode(): void {
    const file = new StampedFile("/opt/Fixture Studio/fixture-studio", 2049n, 131n, 228826440n);

    Assert.areEqual("[true,false,false]", JSON.stringify([file.isSameFile(2049n, 131n), file.isSameFile(2050n, 131n), file.isSameFile(2049n, 132n)]));
  }
}
