/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, Request, SettingKey, SettingValue, SettingsQuery, SettingsSnapshot, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class SettingsReadMethodTests {
  @TestMethod
  public answersTheValuesADeviceSees(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("desktop.mode"));
      const quiet = new SettingKey(QualifiedName.parse("desktop.doNotDisturb"), null, "d1");

      connection.sendMessages(
        new Request("main:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("main:2", ShellMethods.setSetting, new SettingValue(quiet, true).toJson()),
        new Request("main:3", ShellMethods.settings, new SettingsQuery("d1").toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(connection, 6);
      const snapshot = SettingsSnapshot.fromJson(responses.get("main:3")?.payload);
      const entry = (name: string): string => JSON.stringify(snapshot.entries.find(t => t.name.text === name)?.toJson());

      Assert.areEqual("{\"name\":\"desktop.mode\",\"value\":\"Dark\",\"isSet\":true}", entry("desktop.mode"));
      Assert.areEqual("{\"name\":\"desktop.doNotDisturb\",\"value\":true,\"isSet\":true}", entry("desktop.doNotDisturb"));
    });
  }
}
