/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageLeftoverNotRemovedException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class AppImageLeftoverNotRemovedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const folder = "/opt";
    const cause = new Error("EACCES: permission denied");

    const failure = new AppImageLeftoverNotRemovedException(folder, new ExceptionOptions(cause));

    Assert.areEqual("An unfinished copy of an earlier update in /opt could not be removed, so the AppImage in it was not replaced.", failure.message);
    Assert.areEqual(folder, failure.folder);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("AppImageLeftoverNotRemovedException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
