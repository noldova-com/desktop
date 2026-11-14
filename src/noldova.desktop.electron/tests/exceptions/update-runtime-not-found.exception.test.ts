/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateRuntimeNotFoundException, UpdateStopException } from "@noldova/desktop.electron";

@TestClass
export class UpdateRuntimeNotFoundExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const dataDirectory = "/data";

    const failure = new UpdateRuntimeNotFoundException(dataDirectory);

    Assert.areEqual("The runtime of /data could not be identified, so it can't be verified to stop for the update.", failure.message);
    Assert.areEqual(dataDirectory, failure.dataDirectory);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateRuntimeNotFoundException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
