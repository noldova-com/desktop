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
  public takesOnlyEpermAsDenied(): void {
    Assert.areEqual("true,false,false,false", ["EPERM", "EACCES", "ENOENT", "EEXIST"].map(t => FileErrors.isDenied(FileErrorsTests.create(t))).join(","));
  }

  @TestMethod
  public takesOnlyEinvalFromFstatAsUnsized(): void {
    const errors = [["EINVAL", "fstat"], ["EINVAL", "open"], ["EINVAL", undefined], ["EACCES", "fstat"]].map(([code, syscall]) => Object.assign(new Error(String(code)), { code, syscall }));

    Assert.areEqual("true,false,false,false", errors.map(t => FileErrors.isUnsized(t)).join(","));
  }

  @TestMethod
  public takesNoOtherValueForAFileError(): void {
    for (const error of [new Error("no code"), Object.assign(new Error("number"), { code: 2 }), { code: "ENOENT" }, { code: "EINVAL", syscall: "fstat" }, "ENOENT", null, undefined]) {
      Assert.isFalse(FileErrors.isMissing(error));
      Assert.isFalse(FileErrors.isUnreachable(error));
      Assert.isFalse(FileErrors.isDenied(error));
      Assert.isFalse(FileErrors.isUnsized(error));
    }
  }

  private static create(code: string): Error {
    return Object.assign(new Error(code), { code });
  }
}
