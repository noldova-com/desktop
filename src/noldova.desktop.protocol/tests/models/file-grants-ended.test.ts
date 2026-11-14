/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { FileGrantsEnded } from "@noldova/desktop.protocol";

@TestClass
export class FileGrantsEndedTests {
  @TestMethod
  public pinsItsWireForm(): void {
    Assert.areEqual("{\"window\":3,\"page\":2}", JSON.stringify(new FileGrantsEnded(3, 2).toJson()));
    Assert.areEqual("3,2", Object.values(FileGrantsEnded.fromJson({ window: 3, page: 2 })).join(","));
  }

  @TestMethod
  @TestData(0, 2, "window")
  @TestData(1.5, 2, "window")
  @TestData(3, 0, "page")
  @TestData(3, -1, "page")
  public refusesAWindowOrPageThatIsNotAPositiveInteger(window: number, page: number, field: string): void {
    Assert.throws(() => new FileGrantsEnded(window, page), ArgumentOutOfRangeException);
    Assert.areEqual(`$.${field}`, Assert.throws(() => FileGrantsEnded.fromJson({ window, page }), JsonException).path);
  }

  @TestMethod
  public refusesAMissingPageAndUnknownFields(): void {
    Assert.areEqual("$.page", Assert.throws(() => FileGrantsEnded.fromJson({ window: 3 }), JsonException).path);
    Assert.areEqual("$.grants", Assert.throws(() => FileGrantsEnded.fromJson({ window: 3, page: 2, grants: [] }), JsonException).path);
  }
}
