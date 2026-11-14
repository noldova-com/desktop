/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SystemCommandException, UserIdentityUnreadableException } from "@noldova/desktop.runtime";

@TestClass
export class UserIdentityUnreadableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new UserIdentityUnreadableException("USER INFORMATION");

    Assert.areEqual("The current user's security identifier could not be read from: USER INFORMATION", exception.message);
    Assert.areEqual("USER INFORMATION", exception.output);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("UserIdentityUnreadableException", exception.name);
  }
}
