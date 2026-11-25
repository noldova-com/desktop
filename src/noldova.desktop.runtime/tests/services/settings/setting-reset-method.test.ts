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
export class SettingResetMethodTests {
  @TestMethod
  public resetsASettingToItsDefaultAndPublishesTheChangeButRefusesADeviceSettingWithoutItsDevice(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("desktop.mode"));

      connection.sendMessages(
        new Request("main:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("main:2", ShellMethods.resetSetting, mode.toJson()),
        new Request("main:3", ShellMethods.resetSetting, new SettingKey(QualifiedName.parse("desktop.doNotDisturb")).toJson()));
      const { responses, events } = await RuntimeHostFixture.readMessagesAsync(connection, 5);

      Assert.isTrue(["main:1", "main:2"].every(t => responses.get(t)?.hasFailed === false));
      Assert.areEqual("InvalidParams", responses.get("main:3")?.failure?.code);
      Assert.areEqual("{\"name\":\"desktop.mode\",\"value\":\"System\",\"isSet\":false}", JSON.stringify(events.at(-1)?.payload));
      Assert.areEqual("desktop.settingsChanged,desktop.settingsChanged", events.map(t => t.name.text).join(","));
    });
  }
}
