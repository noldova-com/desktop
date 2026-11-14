/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DeviceIdentityException } from "@noldova/desktop.electron";

@TestClass
export class DeviceIdentityExceptionTests {
  @TestMethod
  public namesTheFileAndKeepsTheCause(): void {
    const cause = new Error("Unexpected end of JSON input");

    const failure = new DeviceIdentityException("/home/person/.config/noldova-desktop/device.json", new ExceptionOptions(cause));

    Assert.areEqual("The device identity in /home/person/.config/noldova-desktop/device.json is not valid; remove the file to give this device a new identity.", failure.message);
    Assert.areEqual("/home/person/.config/noldova-desktop/device.json", failure.file);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("DeviceIdentityException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
