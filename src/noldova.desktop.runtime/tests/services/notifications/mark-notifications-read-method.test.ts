/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NotificationBroadcast, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class MarkNotificationsReadMethodTests {
  @TestMethod
  public marksEveryNotificationReadAndPublishesIt(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      connection.sendMessages(new Request("main:1", ShellMethods.markNotificationsRead, null));
      const read = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("true", NotificationBroadcast.fromJson(read[0].payload).notifications.map(t => String(t.isRead)).join(","));
      Assert.isFalse(read[1].hasFailed);
    });
  }
}
