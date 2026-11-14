/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { OptionRequiredException } from "../../src/exceptions/option-required.exception.js";

@TestClass
export class OptionRequiredExceptionTests {
  @TestMethod
  public namesTheRequiredOption(): void {
    const exception = new OptionRequiredException("--title");

    Assert.areEqual("The --title option is required.", exception.message);
    Assert.areEqual("--title", exception.option);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("OptionRequiredException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
