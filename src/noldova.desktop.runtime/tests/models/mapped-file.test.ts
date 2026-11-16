/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { MappedFile } from "../../src/models/mapped-file.js";

@TestClass
export class MappedFileTests {
  @TestMethod
  public keepsThePathTheDeviceTheInodeAndWhetherItWasDeleted(): void {
    const file = new MappedFile("/opt/Fixture Studio/resources/app.asar", 56n, 4016n, true);

    Assert.areEqual("/opt/Fixture Studio/resources/app.asar", file.path);
    Assert.areEqual("56:4016:true", [file.device, file.inode, file.isDeleted].join(":"));
  }

  @TestMethod
  public isTheSameFileOnlyWithTheSameDeviceAndInode(): void {
    const file = new MappedFile("/opt/Fixture Studio/resources/app.asar", 56n, 4016n, false);

    Assert.areEqual("[true,false,false]", JSON.stringify([file.isSameFile(56n, 4016n), file.isSameFile(57n, 4016n), file.isSameFile(56n, 4017n)]));
  }
}
