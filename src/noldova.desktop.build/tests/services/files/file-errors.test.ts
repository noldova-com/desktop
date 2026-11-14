/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FileErrors } from "../../../src/services/files/file-errors.js";

@TestClass
export class FileErrorsTests {
  @TestMethod
  public takesAMissingFileOrFolderAsMissing(): void {
    Assert.areEqual("true,true,false,false", ["ENOENT", "ENOTDIR", "EACCES", "EISDIR"].map(t => FileErrors.isMissing(FileErrorsTests.create(t))).join(","));
  }

  @TestMethod
  public takesAMissingFileOrOneItMayNotOpenAsUnreachable(): void {
    Assert.areEqual("true,true,true,true,false", ["ENOENT", "ENOTDIR", "EACCES", "EPERM", "EISDIR"].map(t => FileErrors.isUnreachable(FileErrorsTests.create(t))).join(","));
  }

  @TestMethod
  public takesNoOtherValueForAFileError(): void {
    for (const error of [new Error("no code"), Object.assign(new Error("number"), { code: 2 }), { code: "ENOENT" }, "ENOENT", null, undefined]) {
      Assert.isFalse(FileErrors.isMissing(error));
      Assert.isFalse(FileErrors.isUnreachable(error));
    }
  }

  private static create(code: string): Error {
    return Object.assign(new Error(code), { code });
  }
}
