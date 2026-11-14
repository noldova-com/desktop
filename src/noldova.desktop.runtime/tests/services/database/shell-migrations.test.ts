/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectory, OwnershipLock, ShellDatabase, ShellMigrations } from "@noldova/desktop.runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ShellMigrationsTests {
  @TestMethod
  public async carriesEachQuietDeviceIntoItsDoNotDisturbSettingAndKeepsTheirTableUntilTheyMove(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const settings = ShellMigrationsTests.indexOf("settings");
    const before = await ShellDatabase.openAsync(lock, ShellMigrations.all.slice(0, settings));
    before.run("INSERT INTO quiet_devices (device) VALUES (?), (?)", "d1", "d2");
    before.close();

    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all.slice(0, settings + 1));
    const copied = database.readAll("SELECT name, scope_name, scope_id, device, value FROM setting_values ORDER BY device");
    const kept = database.readAll("SELECT device FROM quiet_devices ORDER BY device");
    database.close();

    Assert.areEqual(JSON.stringify([
      { name: "desktop.doNotDisturb", scope_name: String.empty, scope_id: String.empty, device: "d1", value: "true" },
      { name: "desktop.doNotDisturb", scope_name: String.empty, scope_id: String.empty, device: "d2", value: "true" }
    ]), JSON.stringify(copied));
    Assert.areEqual("d1,d2", kept.map(t => t["device"]).join(","));
  }

  @TestMethod
  public async movesTheQuietDevicesKeptSinceIntoTheSettingAndDropsTheirTableLeavingOtherSettings(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const moved = ShellMigrationsTests.indexOf("quiet-devices-moved");
    const before = await ShellDatabase.openAsync(lock, ShellMigrations.all.slice(0, moved));
    before.run("INSERT INTO quiet_devices (device) VALUES (?), (?)", "d1", "d3");
    before.run("INSERT INTO setting_values (name, scope_name, scope_id, device, value) VALUES (?, '', '', ?, 'true'), (?, '', '', ?, 'true'), (?, '', '', ?, '14')",
      "desktop.doNotDisturb", "d1", "desktop.doNotDisturb", "d2", "desktop.panelSize", "d2");
    before.close();

    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const values = database.readAll("SELECT name, device, value FROM setting_values ORDER BY name, device");
    const tables = database.readAll("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'quiet_devices'");
    database.close();

    Assert.areEqual("owned-processes", ShellMigrations.all[moved + 1]?.id);
    Assert.areEqual(JSON.stringify([
      { name: "desktop.doNotDisturb", device: "d1", value: "true" },
      { name: "desktop.doNotDisturb", device: "d3", value: "true" },
      { name: "desktop.panelSize", device: "d2", value: "14" }
    ]), JSON.stringify(values));
    Assert.areEqual(0, tables.length);
  }

  private static indexOf(id: string): number {
    return ShellMigrations.all.findIndex(t => t.id === id);
  }
}
