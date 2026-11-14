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
import { UpdateProcess, UpdateReady } from "@noldova/desktop.protocol";

@TestClass
export class UpdateReadyTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"problems\":[],\"processes\":[{\"processId\":4120,\"earliest\":1500.25,\"latest\":1501.5,\"role\":\"main\"},{\"processId\":4188,\"earliest\":1600,\"latest\":1600,\"role\":\"program\"}]}";
    const processes = [new UpdateProcess(4120, 1500.25, 1501.5, "main"), new UpdateProcess(4188, 1600, 1600, "program")];
    const ready = new UpdateReady([], processes);
    processes.pop();

    Assert.areEqual(text, JSON.stringify(ready.toJson()));
    Assert.areEqual(text, JSON.stringify(UpdateReady.fromJson(JsonReader.parse(text).toJson()).toJson()));
    Assert.isTrue(ready.isReady);
  }

  @TestMethod
  public isNotReadyWithAProblem(): void {
    const ready = UpdateReady.fromJson({ problems: ["The main window did not answer."], processes: [] });

    Assert.isFalse(ready.isReady);
    Assert.areEqual("The main window did not answer.", ready.problems.join("|"));
  }

  @TestMethod
  public rejectsABlankProblemAnInvalidProcessOrAnUnknownField(): void {
    Assert.throws(() => new UpdateReady([String.empty], []), ArgumentException);
    Assert.areEqual("$.processes.0.latest", Assert.throws(() => UpdateReady.fromJson({ problems: [], processes: [{ processId: 1, earliest: 3, latest: 2, role: "cli" }] }), JsonException).path);
    Assert.areEqual("$.processes.0.name", Assert.throws(() => UpdateReady.fromJson({ problems: [], processes: [{ processId: 1, earliest: 1, latest: 2, role: "cli", name: "x" }] }), JsonException).path);
    Assert.areEqual("$.done", Assert.throws(() => UpdateReady.fromJson({ problems: [], processes: [], done: true }), JsonException).path);
  }
}
