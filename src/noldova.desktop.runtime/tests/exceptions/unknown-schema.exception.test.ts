/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UnknownSchemaException, UnknownSchemaFailure } from "@noldova/desktop.runtime";

@TestClass
export class UnknownSchemaExceptionTests {
  @TestMethod
  public saysTheDatabaseHasTablesButNoHistory(): void {
    const exception = new UnknownSchemaException(UnknownSchemaFailure.TablesWithoutHistory, "shell database");

    Assert.areEqual("The shell database has tables but no migration history.", exception.message);
    Assert.areEqual(UnknownSchemaFailure.TablesWithoutHistory, exception.reason);
    Assert.areEqual("shell database", exception.database);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("UnknownSchemaException", exception.name);
  }

  @TestMethod
  public saysANewerBuildWroteTheDatabase(): void {
    const exception = new UnknownSchemaException(UnknownSchemaFailure.HistoryNewer, "database of the module notes");

    Assert.areEqual("The database of the module notes was written by a newer build.", exception.message);
    Assert.areEqual(UnknownSchemaFailure.HistoryNewer, exception.reason);
    Assert.areEqual("database of the module notes", exception.database);
  }

  @TestMethod
  public saysTheHistoryIsNotRecognized(): void {
    const exception = new UnknownSchemaException(UnknownSchemaFailure.HistoryNotRecognized, "shell database");

    Assert.areEqual("The shell database's migration history is not one this build recognizes.", exception.message);
    Assert.areEqual(UnknownSchemaFailure.HistoryNotRecognized, exception.reason);
    Assert.areEqual("shell database", exception.database);
  }
}
