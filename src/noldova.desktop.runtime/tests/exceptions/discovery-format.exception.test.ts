/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  DiscoveryFieldInvalidException, DiscoveryFormatException, DiscoveryNotObjectException, DiscoveryUnreadableException, DiscoveryVersionUnsupportedException, RuntimeException
} from "@noldova/desktop.runtime";

@TestClass
export class DiscoveryFormatExceptionTests {
  @TestMethod
  public isTheCategoryOfEachUnreadableDiscovery(): void {
    const exceptions: readonly RuntimeException[] = [
      new DiscoveryUnreadableException("/data/runtime.json", new SyntaxError("Unexpected token")),
      new DiscoveryVersionUnsupportedException(2),
      new DiscoveryNotObjectException(),
      new DiscoveryFieldInvalidException("token")
    ];

    for (const exception of exceptions)
      Assert.isInstanceOf(exception, DiscoveryFormatException, exception.name);
  }
}
