/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { SystemErrorCode } from "../../src/models/system-error-code.js";

@TestClass
export class SystemErrorCodeTests {
  @TestMethod
  public readsTheCodeOfASystemError(): void {
    const error = Object.assign(new Error("ENOENT: no such file or directory, stat '/home/person/.profile'"), { code: "ENOENT" });

    Assert.areEqual("ENOENT", SystemErrorCode.of(error));
    Assert.isTrue(SystemErrorCode.is(error, "ENOENT"));
    Assert.isFalse(SystemErrorCode.is(error, "EACCES"));
    Assert.isTrue(SystemErrorCode.isAny(error, ["EACCES", "ENOENT"]));
    Assert.isFalse(SystemErrorCode.isAny(error, ["EACCES", "EPERM"]));
  }

  @TestMethod
  public passesAnErrorWithTheExpectedCodeAndRethrowsAnyOther(): void {
    const expected = Object.assign(new Error("database disk image is malformed"), { code: "ERR_SQLITE_ERROR" });
    const other = new RangeError("The file cannot be probed.");

    SystemErrorCode.expect(expected, "ERR_SQLITE_ERROR");
    const thrown = Assert.throws(() => SystemErrorCode.expect(other, "ERR_SQLITE_ERROR"), RangeError);

    Assert.areEqual(other, thrown);
  }

  @TestMethod
  public findsNoCodeOnAnErrorWithoutATextCodeOrOnAnythingElse(): void {
    const failures: unknown[] = [
      new Error("The reader broke."),
      Object.assign(new Error("The reader broke."), { code: 2 }),
      { code: "ENOENT" },
      "ENOENT",
      null
    ];

    Assert.areEqual(JSON.stringify([null, null, null, null, null]), JSON.stringify(failures.map(t => SystemErrorCode.of(t))));
    Assert.isFalse(failures.some(t => SystemErrorCode.is(t, "ENOENT")));
    Assert.isFalse(failures.some(t => SystemErrorCode.isAny(t, ["ENOENT"])));
  }
}
