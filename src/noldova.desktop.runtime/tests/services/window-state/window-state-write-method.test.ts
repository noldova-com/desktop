/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Request, ShellMethods, WindowStateKey, WindowStateWrite } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class WindowStateWriteMethodTests {
  @TestMethod
  public keepsTheLatestBoundsApartFromTheLayoutAndRefusesAWriteWithoutAValue(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const main = new WindowStateKey("device-1", "main");

      connection.sendMessages(
        new Request("main:1", ShellMethods.writeWindowBounds, new WindowStateWrite(main, { width: 1000, height: 700 }).toJson()),
        new Request("main:2", ShellMethods.writeWindowLayout, new WindowStateWrite(main, { version: 1 }).toJson()),
        new Request("main:3", ShellMethods.writeWindowBounds, new WindowStateWrite(main, { width: 1100, height: 700 }).toJson()),
        new Request("main:4", ShellMethods.readWindowBounds, main.toJson()),
        new Request("main:5", ShellMethods.readWindowLayout, main.toJson()),
        new Request("main:6", ShellMethods.writeWindowLayout, { device: "device-1", window: "main" }));
      const responses = await RuntimeHostFixture.readResponsesAsync(connection, 6);

      Assert.areEqual("{\"value\":{\"width\":1100,\"height\":700}}", JSON.stringify(responses.get("main:4")?.payload));
      Assert.areEqual("{\"value\":{\"version\":1}}", JSON.stringify(responses.get("main:5")?.payload));
      Assert.areEqual("InvalidParams", responses.get("main:6")?.failure?.code);
      Assert.isFalse(["main:1", "main:2", "main:3"].some(t => responses.get(t)?.hasFailed === true));
    });
  }
}
