/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DatabasesNotBackedUpException, UpdateStopException } from "@noldova/desktop.electron";

@TestClass
export class DatabasesNotBackedUpExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const dataDirectory = "/data";
    const cause = new Error("ENOSPC: no space left on device");

    const failure = new DatabasesNotBackedUpException(dataDirectory, cause);

    Assert.areEqual("Noldova Desktop Sample couldn't back up the databases of /data, so the update didn't start: ENOSPC: no space left on device", failure.message);
    Assert.areEqual(dataDirectory, failure.dataDirectory);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("DatabasesNotBackedUpException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }

  @TestMethod
  public endsWithACauseThatIsNoError(): void {
    const failure = new DatabasesNotBackedUpException("/data", "the disk is full");

    Assert.areEqual("Noldova Desktop Sample couldn't back up the databases of /data, so the update didn't start: the disk is full", failure.message);
  }
}
