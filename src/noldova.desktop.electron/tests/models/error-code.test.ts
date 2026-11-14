/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ErrorCode } from "../../src/models/error-code.js";
import { CodedError } from "../fixtures/coded-error.fixture.js";

@TestClass
export class ErrorCodeTests {
  @TestMethod
  public readsTheCodeOfAnErrorThatHasOne(): void {
    Assert.areEqual("ENOENT", ErrorCode.of(new CodedError("ENOENT", "missing")));
  }

  @TestMethod
  public hasNoCodeForAnErrorWithoutOneOrWithAnotherKindOfCodeOrForAValueThatIsNoError(): void {
    const missing = new CodedError("ENOENT", "missing");
    const values: readonly unknown[] = [new Error("plain"), { code: "ENOENT" }, "ENOENT", null, undefined, new CodedError(2, "numbered")];

    Assert.areEqual("undefined,undefined,undefined,undefined,undefined,undefined", values.map(t => String(ErrorCode.of(t))).join(","));
    Assert.isTrue(ErrorCode.isOneOf(missing, ["EEXIST", "ENOENT"]));
    Assert.isFalse(ErrorCode.isOneOf(missing, ["EEXIST"]));
    Assert.isFalse(ErrorCode.isOneOf(new Error("plain"), ["ENOENT"]));
  }
}
