/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RecentCommandUse, RecentCommands, RecentCommandsQuery, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RecentCommandsStoreTests {
  @TestMethod
  public keepsRecentCommandsAcrossRuntimes(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const first = await fixture.startAsync();
      const [writer] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      writer.sendMessages(
        new Request("main:1", ShellMethods.recordCommand, new RecentCommandUse("d1", "notes.newNote").toJson()),
        new Request("main:2", ShellMethods.recordCommand, new RecentCommandUse("d1", "desktop.openSettings").toJson()));
      await RuntimeHostFixture.readMessagesAsync(writer, 4);
      first.requestStop("test");
      await first.waitForStopAsync();

      await fixture.startAsync();
      const [reader] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      reader.sendMessages(new Request("main:3", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()));

      Assert.areEqual("desktop.openSettings,notes.newNote", RecentCommands.fromJson((await reader.readResponseAsync()).payload).ids.join(","));
    });
  }
}
