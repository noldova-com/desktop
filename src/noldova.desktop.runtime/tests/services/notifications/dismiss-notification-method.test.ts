/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NotificationReference, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { ModuleSourceFixture } from "../../fixtures/module-source.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class DismissNotificationMethodTests {
  @TestMethod
  public dismissesAPostedNotificationAndAnswersAGoneOneWithoutAFailure(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("clock", RuntimeHostFixture.createNotificationPart())]));
      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      const { synced, posted: postedId } = await RuntimeHostFixture.listAndPostAsync(connection);
      connection.sendMessages(new Request("main:3", ShellMethods.dismissNotification, new NotificationReference(postedId).toJson()));
      const dismissed = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const again = await RuntimeHostFixture.callAsync(connection, "main:4", ShellMethods.dismissNotification, new NotificationReference(postedId).toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("synced:Synced|null|null", `${RuntimeHostFixture.formatTitles(dismissed[0].payload, synced, postedId)}|${JSON.stringify(dismissed[1].payload)}|${JSON.stringify(again.payload)}`);
    });
  }
}
