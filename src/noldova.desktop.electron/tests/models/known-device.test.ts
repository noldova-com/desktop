/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { KnownDevice } from "../../src/models/known-device.js";

@TestClass
export class KnownDeviceTests {
  @TestMethod
  public async knowsNoDeviceBeforeItsReadAndAnswersNoneUntilThen(): Promise<void> {
    const device = new KnownDevice();

    const identity = await device.readAsync();

    Assert.isUndefined(device.current);
    Assert.isNull(identity);
  }

  @TestMethod
  public async knowsTheDeviceOnceItsReadEnds(): Promise<void> {
    const device = new KnownDevice();
    const read = Promise.withResolvers<string>();
    const lines: string[] = [];
    device.begin(read.promise, t => lines.push(t));
    const whileReading = device.current;

    read.resolve("device-1");
    const identity = await device.readAsync();

    Assert.isUndefined(whileReading);
    Assert.areEqual("device-1", identity);
    Assert.areEqual("device-1", device.current);
    Assert.areEqual(0, lines.length);
  }

  @TestMethod
  public async logsAReadThatFailsAndStaysUnknown(): Promise<void> {
    const device = new KnownDevice();
    const lines: string[] = [];
    device.begin(Promise.reject(new Error("The identity file is not JSON.")), t => lines.push(t));

    const identity = await device.readAsync();

    Assert.isNull(identity);
    Assert.isUndefined(device.current);
    Assert.areEqual(1, lines.length);
    Assert.isTrue(lines[0]?.includes("Error: The identity file is not JSON.") === true, lines.join("\n"));
  }
}
