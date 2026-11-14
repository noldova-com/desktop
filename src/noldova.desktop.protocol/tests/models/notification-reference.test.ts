/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NotificationReference } from "@noldova/desktop.protocol";

@TestClass
export class NotificationReferenceTests {
  @TestMethod
  public pinsItsWireForm(): void {
    Assert.areEqual("n4", NotificationReference.fromJson({ id: "n4" }).id);
    Assert.areEqual("{\"id\":\"n4\"}", JSON.stringify(new NotificationReference("n4").toJson()));
  }

  @TestMethod
  public refusesAnInvalidIdAndUnknownFields(): void {
    Assert.areEqual("id", Assert.throws(() => new NotificationReference(" "), ArgumentException).parameterName);
    Assert.areEqual("$.id", Assert.throws(() => NotificationReference.fromJson({ id: 4 }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationReference.fromJson({ id: "n4", extra: 1 }), JsonException).path);
  }
}
