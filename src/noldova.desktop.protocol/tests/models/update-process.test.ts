/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateProcess } from "@noldova/desktop.protocol";

@TestClass
export class UpdateProcessTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"processId\":4120,\"earliest\":1500.25,\"latest\":1501.5,\"role\":\"main\"}";

    const process = UpdateProcess.fromJson(JsonReader.parse(text).toJson());

    Assert.areEqual(text, JSON.stringify(new UpdateProcess(4120, 1500.25, 1501.5, "main").toJson()));
    Assert.areEqual(text, JSON.stringify(process.toJson()));
    Assert.areEqual("4120 1500.25 1501.5 main", `${process.processId} ${process.earliest} ${process.latest} ${process.role}`);
  }

  @TestMethod
  public rejectsAnInvalidIdStartRangeOrRole(): void {
    Assert.areEqual("processId", Assert.throws(() => new UpdateProcess(0, 1, 1, "cli"), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("latest", Assert.throws(() => new UpdateProcess(1, 2, 1, "cli"), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("latest", Assert.throws(() => new UpdateProcess(1, Number.NaN, 1, "cli"), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("latest", Assert.throws(() => new UpdateProcess(1, 1, Number.POSITIVE_INFINITY, "cli"), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("role", Assert.throws(() => new UpdateProcess(1, 1, 1, " "), ArgumentException).parameterName);
    Assert.areEqual("$.started", Assert.throws(() => UpdateProcess.fromJson({ processId: 1, earliest: 1, latest: 2, role: "cli", started: 1 }), JsonException).path);
  }
}
