/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { OptionNeedsValueException } from "../../src/exceptions/option-needs-value.exception.js";

@TestClass
export class OptionNeedsValueExceptionTests {
  @TestMethod
  public namesTheOptionThatNeedsAValue(): void {
    const exception = new OptionNeedsValueException("--timeout");

    Assert.areEqual("The --timeout option needs a value.", exception.message);
    Assert.areEqual("--timeout", exception.option);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("OptionNeedsValueException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
