/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { OptionTakesNoValueException } from "../../src/exceptions/option-takes-no-value.exception.js";

@TestClass
export class OptionTakesNoValueExceptionTests {
  @TestMethod
  public namesTheOptionThatTakesNoValue(): void {
    const exception = new OptionTakesNoValueException("--force");

    Assert.areEqual("The --force option takes no value.", exception.message);
    Assert.areEqual("--force", exception.option);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("OptionTakesNoValueException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
