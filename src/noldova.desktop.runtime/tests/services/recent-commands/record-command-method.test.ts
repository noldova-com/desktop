/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RecentCommandUse, RecentCommandsQuery, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RecordCommandMethodTests {
  @TestMethod
  public keepsEachDevicesTwentyNewestCommandsNewestFirstAndPublishesEachUse(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const uses = [...Array.from({ length: 22 }, (_, index) => `c${index}`), "c5"];

      connection.sendMessages(
        ...uses.map((t, index) => new Request(`main:${index + 1}`, ShellMethods.recordCommand, new RecentCommandUse("d1", t).toJson())),
        new Request("main:24", ShellMethods.recordCommand, new RecentCommandUse("d2", "c0").toJson()),
        new Request("main:25", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()),
        new Request("main:26", ShellMethods.recordCommand, { device: "d1" }));
      const { responses, events } = await RuntimeHostFixture.readMessagesAsync(connection, 26 + 24);
      const expected = ["c5", "c21", "c20", "c19", "c18", "c17", "c16", "c15", "c14", "c13", "c12", "c11", "c10", "c9", "c8", "c7", "c6", "c4", "c3", "c2"];

      Assert.areEqual(JSON.stringify({ ids: expected }), JSON.stringify(responses.get("main:25")?.payload));
      Assert.areEqual("InvalidParams", responses.get("main:26")?.failure?.code);
      Assert.areEqual(24, events.filter(t => t.name.text === "desktop.recentCommandsChanged").length);
      Assert.areEqual(JSON.stringify({ ids: ["c0"], device: "d2" }), JSON.stringify(events.at(-1)?.payload));
      Assert.areEqual(JSON.stringify({ ids: expected, device: "d1" }), JSON.stringify(events.at(-2)?.payload));
    });
  }
}
