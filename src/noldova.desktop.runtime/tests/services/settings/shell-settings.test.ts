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
import { ProductInfo, RuntimeBuild, ShellSettings } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class ShellSettingsTests {
  @TestMethod
  public declaresTheShellsSettingsInOrderWithTheirDefaultsWhereEachIsKeptAndTheModesInOrder(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      const snapshot = SettingsSnapshot.fromJson((await RuntimeHostFixture.callAsync(connection, "main:1", ShellMethods.settings, new SettingsQuery("d1").toJson())).payload);

      Assert.areEqual("desktop.timeFormat,desktop.dateTimeFormat,desktop.theme,desktop.mode,desktop.interfaceFont,desktop.codeFont,desktop.panelSize,desktop.messageSize,desktop.codeSize,desktop.leftDockStyle,desktop.rightDockStyle,desktop.menuBar,desktop.previewTabs,desktop.recentCommandCount,desktop.spellCheck,desktop.spellCheckLanguages,desktop.doNotDisturb,desktop.mutedModules,desktop.trayIcon,desktop.keyBindings,desktop.updateChecks",
        snapshot.definitions.map(t => t.name.text).join(","));
      Assert.areEqual(
        `"h:mm a" Shared,"MMM d, yyyy, h:mm a" Shared,"desktop.default" Shared,"System" Shared,"Noldova" Device,"Noldova" Device,13 Device,13 Device,12 Device,"Tabs" Shared,"Tabs" Shared,"Inline" Shared,true Shared,5 Shared,true Shared,[] Device,false Device,[] Shared,${process.platform !== "darwin"} Device,{} Shared,"Automatic" Device`,
        snapshot.definitions.map(t => `${JSON.stringify(t.defaultValue)} ${t.locality}`).join(","));
      Assert.areEqual("Text 64 General Date and time,Text 64 General Date and time",
        snapshot.definitions.filter(t => t.name.text.endsWith("Format")).map(t => `${t.type.kind} ${String(t.type.maxLength)} ${t.page} ${t.group}`).join(","));
      Assert.areEqual("Boolean Spelling,Languages Spelling", snapshot.definitions.filter(t => t.name.text.startsWith("desktop.spellCheck")).map(t => `${t.type.kind} ${t.group}`).join(","));
      Assert.areEqual("About Updates", snapshot.definitions.filter(t => t.name.text === "desktop.updateChecks").map(t => `${t.page} ${t.group}`).join(","));
      Assert.areEqual("System,Light,Dark", snapshot.definitions.find(t => t.name.text === "desktop.mode")?.type.options.map(t => t.value).join(","));
      Assert.areEqual("Automatic Automatically,AtStart Only at start,OnRequest Only when I ask",
        snapshot.definitions.find(t => t.name.text === "desktop.updateChecks")?.type.options.map(t => `${t.value} ${t.title}`).join(","));
    });
  }

  @TestMethod
  public keepsATextSizeSetToTheOldDefaultWhileAnUnsetOneTakesTheNewDefault(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const size = (name: string, device: string = "d1"): SettingKey => new SettingKey(QualifiedName.parse(name), null, device);

      connection.sendMessages(
        new Request("main:1", ShellMethods.setSetting, new SettingValue(size("desktop.messageSize"), 14).toJson()),
        new Request("main:2", ShellMethods.readSetting, size("desktop.messageSize").toJson()),
        new Request("main:3", ShellMethods.readSetting, size("desktop.codeSize").toJson()),
        new Request("main:4", ShellMethods.readSetting, size("desktop.panelSize").toJson()),
        new Request("main:5", ShellMethods.setSetting, new SettingValue(size("desktop.codeSize", "d2"), 13).toJson()),
        new Request("main:6", ShellMethods.readSetting, size("desktop.codeSize", "d2").toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(connection, 8);

      Assert.areEqual(JSON.stringify([
        { name: "desktop.messageSize", value: 14, isSet: true },
        { name: "desktop.codeSize", value: 12, isSet: false },
        { name: "desktop.panelSize", value: 13, isSet: false },
        { name: "desktop.codeSize", value: 13, isSet: true }
      ]), JSON.stringify(["main:2", "main:3", "main:4", "main:6"].map(t => responses.get(t)?.payload)));
    });
  }

  @TestMethod
  public namesWhereEachPlatformShowsTheTrayIconAndTurnsItOnByDefaultExceptOnMacOS(): void {
    const product = ProductInfo.current.name;

    const trays = ["win32", "darwin", "linux"].map(t => ShellSettings.definitionsFor(t).find(u => u.name.text === ShellSettings.trayIcon.text));

    Assert.areEqual(
      [`Show ${product} in the notification area true`, `Show ${product} in the menu bar false`, `Show ${product} in the tray true`].join(),
      trays.map(t => `${t?.title} ${String(t?.defaultValue)}`).join());
    Assert.areEqual("Boolean Device Notifications Background", [trays[0]?.type.kind, trays[0]?.locality, trays[0]?.page, trays[0]?.group].join(" "));
    Assert.areEqual(
      `An icon that shows when work is running or notifications are unread, with a menu to open ${product}, turn on Do not disturb or quit.`,
      trays[2]?.description);
  }
}
