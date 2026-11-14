/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { OptionRepeatedException } from "../../src/exceptions/option-repeated.exception.js";

@TestClass
export class OptionRepeatedExceptionTests {
  @TestMethod
  public namesTheRepeatedOption(): void {
    const exception = new OptionRepeatedException("--title");

    Assert.areEqual("The --title option was given more than once.", exception.message);
    Assert.areEqual("--title", exception.option);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("OptionRepeatedException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
