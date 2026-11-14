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
import { DetachedStartRequest } from "@noldova/desktop.electron";

@TestClass
export class DetachedStartRequestTests {
  @TestMethod
  public travelsAsJson(): void {
    const launchArguments = ["entry.js", "--data-dir", "C:\\data"];
    const request = new DetachedStartRequest("C:\\Noldova Desktop Sample\\Noldova Desktop Sample.exe", launchArguments, "C:\\data\\logs\\start.log", { ELECTRON_RUN_AS_NODE: "1", UNSET: undefined });
    launchArguments.push("changed");

    const copy = DetachedStartRequest.fromJson(JsonReader.parse(JSON.stringify(request.toJson())).toJson());

    Assert.areEqual("C:\\Noldova Desktop Sample\\Noldova Desktop Sample.exe", copy.executable);
    Assert.areEqual("entry.js|--data-dir|C:\\data", copy.launchArguments.join("|"));
    Assert.areEqual("C:\\data\\logs\\start.log", copy.errorFile);
    Assert.areEqual("{\"ELECTRON_RUN_AS_NODE\":\"1\"}", JSON.stringify(copy.environment));
  }

  @TestMethod
  public requiresAProgramAndAnErrorFile(): void {
    Assert.areEqual("executable", Assert.throws(() => new DetachedStartRequest(" ", [], "start.log", {}), ArgumentException).parameterName);
    Assert.areEqual("errorFile", Assert.throws(() => new DetachedStartRequest("node", [], String.empty, {}), ArgumentException).parameterName);
    Assert.throws(() => DetachedStartRequest.fromJson({ executable: "node", arguments: [1], errorFile: "start.log", environment: {} }), JsonException);
    Assert.throws(() => DetachedStartRequest.fromJson({ executable: "node", arguments: [], errorFile: "start.log" }), JsonException);
    const exception = Assert.throws(() => DetachedStartRequest.fromJson({ executable: "node", arguments: [], errorFile: "start.log", environment: { PATH: 1 } }), JsonException);
    Assert.areEqual("$.environment.PATH: An environment variable's value must be text.", exception.message);
    Assert.throws(() => DetachedStartRequest.fromJson("node"), JsonException);
  }
}
