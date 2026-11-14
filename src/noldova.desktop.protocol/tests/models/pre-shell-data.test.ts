/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, PreShellData } from "@noldova/desktop.protocol";

@TestClass
export class PreShellDataTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"location\":\"/home/person/.noldova/desktop\"}";

    Assert.areEqual(text, JSON.stringify(new PreShellData("/home/person/.noldova/desktop").toJson()));
    Assert.areEqual("/home/person/.noldova/desktop", PreShellData.fromJson(JsonReader.parse(text).toJson()).location);
  }

  @TestMethod
  public travelsAsTheDetailsOfItsFailure(): void {
    const failure = new Failure(FailureCode.PreShellData, "This data folder holds data of an older Noldova Desktop Sample.", new PreShellData("D:\\data").toJson());

    Assert.areEqual(
      "{\"code\":\"PreShellData\",\"message\":\"This data folder holds data of an older Noldova Desktop Sample.\",\"details\":{\"location\":\"D:\\\\data\"}}",
      JSON.stringify(failure.toJson()));
    Assert.areEqual("D:\\data", PreShellData.fromJson(Failure.fromJson(failure.toJson()).details).location);
  }

  @TestMethod
  public rejectsABlankLocationOrUnknownFields(): void {
    Assert.throws(() => new PreShellData(" "), ArgumentException);
    Assert.areEqual("$.location", Assert.throws(() => PreShellData.fromJson({ location: String.empty }), JsonException).path);
    Assert.areEqual("$.size", Assert.throws(() => PreShellData.fromJson({ location: "x", size: 1 }), JsonException).path);
  }
}
