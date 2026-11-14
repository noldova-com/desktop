/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RecentCommandsQuery } from "@noldova/desktop.protocol";

@TestClass
export class RecentCommandsQueryTests {
  @TestMethod
  public pinsItsWireForm(): void {
    Assert.areEqual("laptop", RecentCommandsQuery.fromJson({ device: "laptop" }).device);
    Assert.areEqual(JSON.stringify({ device: "laptop" }), JSON.stringify(new RecentCommandsQuery("laptop").toJson()));
  }

  @TestMethod
  public refusesABlankDeviceAndUnknownFields(): void {
    Assert.areEqual("device", Assert.throws(() => new RecentCommandsQuery(String.empty), ArgumentException).parameterName);
    Assert.areEqual("$.extra", Assert.throws(() => RecentCommandsQuery.fromJson({ device: "laptop", extra: 1 }), JsonException).path);
  }
}
