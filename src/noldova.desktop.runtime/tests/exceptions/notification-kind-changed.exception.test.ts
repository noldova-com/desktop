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
import { NotificationKindChangedException, RegistrationException } from "@noldova/desktop.runtime";

@TestClass
export class NotificationKindChangedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new NotificationKindChangedException("n-1", "notes.saved", new ExceptionOptions(cause));

    Assert.areEqual("Notification n-1 is of the kind notes.saved, which an update keeps.", exception.message);
    Assert.areEqual("n-1", exception.notificationId);
    Assert.areEqual("notes.saved", exception.kind);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("NotificationKindChangedException", exception.name);
  }
}
