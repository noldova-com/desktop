/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Migration } from "@noldova/desktop.runtime";

@TestClass
export class MigrationTests {
  @TestMethod
  public keepsItsIdAndACopyOfItsStatements(): void {
    const statements = ["CREATE TABLE a (b TEXT) STRICT"];
    const migration = new Migration("0001-create-a", statements);
    statements.push("DROP TABLE a");

    Assert.areEqual("0001-create-a", migration.id);
    Assert.areEqual("CREATE TABLE a (b TEXT) STRICT", migration.statements.join(";"));
  }

  @TestMethod
  @TestData("Create-a")
  @TestData("create--a")
  @TestData("-create")
  @TestData(String.empty)
  public refusesAMalformedId(id: string): void {
    const exception = Assert.throws(() => new Migration(id, ["SELECT 1"]), ArgumentException);

    Assert.areEqual("id", exception.parameterName);
  }

  @TestMethod
  public refusesAMigrationWithoutStatements(): void {
    const exception = Assert.throws(() => new Migration("create-a", []), ArgumentException);

    Assert.areEqual("statements", exception.parameterName);
  }
}
