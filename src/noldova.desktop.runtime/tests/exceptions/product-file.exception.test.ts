/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProductFileException } from "@noldova/desktop.runtime";

@TestClass
export class ProductFileExceptionTests {
  @TestMethod
  public namesTheFileAndKeepsTheCause(): void {
    const cause = new SyntaxError("Unexpected end of JSON input");

    const exception = new ProductFileException("/opt/noldova-desktop/product.json", cause);

    Assert.areEqual("The build's product file /opt/noldova-desktop/product.json is not valid: SyntaxError: Unexpected end of JSON input", exception.message);
    Assert.areEqual("/opt/noldova-desktop/product.json", exception.file);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("ProductFileException", exception.name);
  }
}
