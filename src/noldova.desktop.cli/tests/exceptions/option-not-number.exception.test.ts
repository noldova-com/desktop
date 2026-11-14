/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { OptionNotNumberException } from "../../src/exceptions/option-not-number.exception.js";

@TestClass
export class OptionNotNumberExceptionTests {
  @TestMethod
  public namesTheOptionAndTheValueThatIsNotANumber(): void {
    const exception = new OptionNotNumberException("--count", "many");

    Assert.areEqual("The --count option takes a number of at most 15 digits, not \"many\".", exception.message);
    Assert.areEqual("--count", exception.option);
    Assert.areEqual("many", exception.value);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("OptionNotNumberException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
