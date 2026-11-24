/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, Request, SettingKey, SettingValue, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class SettingWriteMethodTests {
  @TestMethod
  public writesASettingAndPublishesTheChangeButRefusesAnInvalidValueOrAnUndeclaredSetting(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("desktop.mode"));
      const quiet = new SettingKey(QualifiedName.parse("desktop.doNotDisturb"), null, "d1");

      connection.sendMessages(
        new Request("main:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("main:2", ShellMethods.setSetting, new SettingValue(quiet, true).toJson()),
        new Request("main:3", ShellMethods.setSetting, new SettingValue(mode, "Blue").toJson()),
        new Request("main:4", ShellMethods.setSetting, new SettingValue(new SettingKey(QualifiedName.parse("desktop.speed")), 1).toJson()));
      const { responses, events } = await RuntimeHostFixture.readMessagesAsync(connection, 7);
      const changes = events.filter(t => t.name.text === "desktop.settingsChanged");

      Assert.isTrue(["main:1", "main:2"].every(t => responses.get(t)?.hasFailed === false));
      Assert.areEqual("InvalidParams,NotFound", ["main:3", "main:4"].map(t => responses.get(t)?.failure?.code).join(","));
      Assert.areEqual(JSON.stringify([
        "{\"name\":\"desktop.mode\",\"value\":\"Dark\",\"isSet\":true}",
        "{\"name\":\"desktop.doNotDisturb\",\"device\":\"d1\",\"value\":true,\"isSet\":true}"
      ]), JSON.stringify(changes.map(t => JSON.stringify(t.payload))));
      Assert.areEqual("desktop.settingsChanged,desktop.settingsChanged,desktop.notifications", events.map(t => t.name.text).join(","));
    });
  }
}
