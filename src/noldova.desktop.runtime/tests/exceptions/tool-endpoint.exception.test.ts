/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeException, ToolEndpointException } from "@noldova/desktop.runtime";

@TestClass
export class ToolEndpointExceptionTests {
  @TestMethod
  public saysThatTheEndpointIsClosed(): void {
    const exception = new ToolEndpointException();

    Assert.areEqual("The tool endpoint is closed.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof RuntimeException);
    Assert.areEqual("ToolEndpointException", exception.name);
  }
}
