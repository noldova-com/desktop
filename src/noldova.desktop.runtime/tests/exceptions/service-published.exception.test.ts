/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RegistrationException, ServicePublishedException } from "@noldova/desktop.runtime";

@TestClass
export class ServicePublishedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new ServicePublishedException("notes.store", new ExceptionOptions(cause));

    Assert.areEqual("The service notes.store is already published.", exception.message);
    Assert.areEqual("notes.store", exception.service);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("ServicePublishedException", exception.name);
  }
}
