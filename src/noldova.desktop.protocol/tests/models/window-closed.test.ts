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
import { WindowClosed } from "@noldova/desktop.protocol";

@TestClass
export class WindowClosedTests {
  @TestMethod
  public pinsItsWireForm(): void {
    Assert.areEqual("{\"window\":3}", JSON.stringify(new WindowClosed(3).toJson()));
    Assert.areEqual(3, WindowClosed.fromJson({ window: 3 }).window);
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(1.5)
  public rejectsAWindowThatIsNotAPositiveInteger(window: number): void {
    Assert.throws(() => new WindowClosed(window), ArgumentOutOfRangeException);
    Assert.areEqual("$.window", Assert.throws(() => WindowClosed.fromJson({ window }), JsonException).path);
  }

  @TestMethod
  public rejectsAMissingWindowAndUnknownFields(): void {
    Assert.areEqual("$.window", Assert.throws(() => WindowClosed.fromJson({}), JsonException).path);
    Assert.areEqual("$.window", Assert.throws(() => WindowClosed.fromJson({ window: "3" }), JsonException).path);
    Assert.areEqual("$.connection", Assert.throws(() => WindowClosed.fromJson({ window: 3, connection: 1 }), JsonException).path);
  }
}
