/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppWindow, AppWindowList } from "@noldova/desktop.protocol";

@TestClass
export class AppWindowTests {
  @TestMethod
  public carriesTheWindowsHandleOrNoneAndItsProcessThroughTheWire(): void {
    const list = new AppWindowList([new AppWindow(132_406, 4210), new AppWindow(null, 4210)]);

    const copy = AppWindowList.fromJson(JsonReader.parse(JSON.stringify(list.toJson())).toJson());

    Assert.areEqual(JSON.stringify({ windows: [{ handle: 132_406, processId: 4210 }, { handle: null, processId: 4210 }] }), JSON.stringify(list.toJson()));
    Assert.areEqual("132406 4210 null 4210", copy.windows.flatMap(t => [String(t.handle), String(t.processId)]).join(" "));
  }

  @TestMethod
  public refusesAHandleOrProcessIdBelowOneOrNotWhole(): void {
    for (const handle of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      Assert.areEqual("handle", Assert.throws(() => new AppWindow(handle, 1), ArgumentException).parameterName);
    for (const processId of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      Assert.areEqual("processId", Assert.throws(() => new AppWindow(1, processId), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheFieldThatIsMissingInvalidOrUnknown(): void {
    Assert.areEqual("$.windows.0.handle", Assert.throws(() => AppWindowList.fromJson({ windows: [{ handle: "7", processId: 1 }] }), JsonException).path);
    Assert.areEqual("$.windows.0.handle", Assert.throws(() => AppWindowList.fromJson({ windows: [{ handle: 0, processId: 1 }] }), JsonException).path);
    Assert.areEqual("$.windows.0.processId", Assert.throws(() => AppWindowList.fromJson({ windows: [{ handle: null }] }), JsonException).path);
    Assert.areEqual("$.windows.0.title", Assert.throws(() => AppWindowList.fromJson({ windows: [{ handle: null, processId: 1, title: "Notes" }] }), JsonException).path);
  }
}
