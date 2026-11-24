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

import { ModuleSourceFixture } from "../../fixtures/module-source.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class ClearNotificationsMethodTests {
  @TestMethod
  public clearsEveryNotificationAndPublishesIt(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("clock", RuntimeHostFixture.createNotificationPart())]));
      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      connection.sendMessages(new Request("main:1", ShellMethods.clearNotifications, null));
      const cleared = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("0", String(NotificationBroadcast.fromJson(cleared[0].payload).notifications.length));
      Assert.isFalse(cleared[1].hasFailed);
    });
  }
}
