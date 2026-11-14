/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { StopPolicy, StopRequest } from "@noldova/desktop.protocol";

@TestClass
export class StopRequestTests {
  @TestMethod
  @TestData(StopPolicy.IfIdle, "{\"policy\":\"IfIdle\"}")
  @TestData(StopPolicy.StopWork, "{\"policy\":\"StopWork\"}")
  public pinsItsWireForm(policy: StopPolicy, text: string): void {
    Assert.areEqual(text, JSON.stringify(new StopRequest(policy).toJson()));
    Assert.areEqual(policy, StopRequest.fromJson(JsonReader.parse(text).toJson()).policy);
  }

  @TestMethod
  public writesKeepingWhileSharedOnlyWhenAskedAndReadsItAsFalseWhenAbsent(): void {
    const text = "{\"policy\":\"IfIdle\",\"keepsWhileShared\":true}";

    Assert.areEqual(text, JSON.stringify(new StopRequest(StopPolicy.IfIdle, true).toJson()));
    Assert.areEqual("{\"policy\":\"StopWork\"}", JSON.stringify(new StopRequest(StopPolicy.StopWork, false).toJson()));
    Assert.isTrue(StopRequest.fromJson(JsonReader.parse(text).toJson()).keepsWhileShared);
    Assert.isFalse(StopRequest.fromJson({ policy: "IfIdle", keepsWhileShared: false }).keepsWhileShared);
    Assert.isFalse(StopRequest.fromJson({ policy: "StopWork" }).keepsWhileShared);
    Assert.areEqual("$.keepsWhileShared", Assert.throws(() => StopRequest.fromJson({ policy: "IfIdle", keepsWhileShared: "yes" }), JsonException).path);
  }

  @TestMethod
  public rejectsAnUnknownPolicy(): void {
    Assert.areEqual("$.policy", Assert.throws(() => StopRequest.fromJson({ policy: "Never" }), JsonException).path);
  }

  @TestMethod
  public rejectsUnknownFields(): void {
    Assert.areEqual("$.force", Assert.throws(() => StopRequest.fromJson({ policy: "IfIdle", force: true }), JsonException).path);
  }
}
