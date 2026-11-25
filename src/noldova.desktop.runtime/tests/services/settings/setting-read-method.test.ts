/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, Request, SettingKey, SettingScope, SettingValue, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class SettingReadMethodTests {
  @TestMethod
  public answersTheEntryForAKeyAndRefusesAnUndeclaredSettingAnUnlistedScopeOrADeviceSettingWithoutADevice(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("desktop.mode"));
      const quiet = (device: string | null): SettingKey => new SettingKey(QualifiedName.parse("desktop.doNotDisturb"), null, device);

      connection.sendMessages(
        new Request("main:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("main:2", ShellMethods.readSetting, mode.toJson()),
        new Request("main:3", ShellMethods.readSetting, quiet("d1").toJson()),
        new Request("main:4", ShellMethods.readSetting, new SettingKey(QualifiedName.parse("desktop.speed")).toJson()),
        new Request("main:5", ShellMethods.readSetting, new SettingKey(mode.name, new SettingScope(QualifiedName.parse("notes.folder"), "f1")).toJson()),
        new Request("main:6", ShellMethods.readSetting, quiet(null).toJson()));
      const { responses } = await RuntimeHostFixture.readMessagesAsync(connection, 7);

      Assert.areEqual(JSON.stringify([
        { name: "desktop.mode", value: "Dark", isSet: true },
        { name: "desktop.doNotDisturb", value: false, isSet: false }
      ]), JSON.stringify(["main:2", "main:3"].map(t => responses.get(t)?.payload)));
      Assert.areEqual("NotFound,InvalidParams,InvalidParams", ["main:4", "main:5", "main:6"].map(t => responses.get(t)?.failure?.code).join(","));
    });
  }
}
