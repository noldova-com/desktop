/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateRuntimeStillStartingException, UpdateStopException } from "@noldova/desktop.electron";

@TestClass
export class UpdateRuntimeStillStartingExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const dataDirectory = "/data";

    const failure = new UpdateRuntimeStillStartingException(dataDirectory);

    Assert.areEqual("The runtime of /data was still starting, so it couldn't be stopped for the update.", failure.message);
    Assert.areEqual(dataDirectory, failure.dataDirectory);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateRuntimeStillStartingException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
