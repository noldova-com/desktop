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
export class RecentCommandsMethodTests {
  @TestMethod
  public answersNoCommandsForADeviceThatUsedNoneAndEachDevicesOwnOtherwise(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      connection.sendMessages(
        new Request("main:1", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()),
        new Request("main:2", ShellMethods.recordCommand, new RecentCommandUse("d1", "c1").toJson()),
        new Request("main:3", ShellMethods.recordCommand, new RecentCommandUse("d2", "c0").toJson()),
        new Request("main:4", ShellMethods.recentCommands, new RecentCommandsQuery("d2").toJson()));
      const { responses } = await RuntimeHostFixture.readMessagesAsync(connection, 4 + 2);

      Assert.areEqual(JSON.stringify({ ids: [] }), JSON.stringify(responses.get("main:1")?.payload));
      Assert.areEqual(JSON.stringify({ ids: ["c0"] }), JSON.stringify(responses.get("main:4")?.payload));
    });
  }
}
