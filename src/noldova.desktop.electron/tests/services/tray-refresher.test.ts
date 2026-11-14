/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, Response, SettingValue } from "@noldova/desktop.protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class TrayRefresherTests {
  @TestMethod
  public async readsTheNotificationsOfThisDeviceOnceTheRuntimeIsReadyAndShowsThemInTheTray(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.notifications",
      Response.success("r", { notifications: [TrayFixture.notification(1, "Alarm")], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));

    await fixture.startAsync();
    await Condition.waitAsync(() => fixture.rows.includes("Alarm"));

    Assert.areEqual(JSON.stringify({ device: FakeDeviceIdentity.ID }), JSON.stringify(fixture.connection.payloads[fixture.connection.calls.indexOf("desktop.notifications")]));
    Assert.isTrue(fixture.connection.calls.includes("desktop.work"));
  }

  @TestMethod
  public async turnsOnDoNotDisturbForThisDeviceFromTheTray(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();

    fixture.click("Turn on Do not disturb");
    await Condition.waitAsync(() => fixture.connection.calls.includes("desktop.setSetting"));

    const set = SettingValue.fromJson(fixture.connection.payloads[fixture.connection.calls.indexOf("desktop.setSetting")]);
    Assert.areEqual(`desktop.doNotDisturb ${FakeDeviceIdentity.ID} true`, `${set.key.name.text} ${set.key.device ?? String.empty} ${String(set.value)}`);
  }

  @TestMethod
  public async logsDoNotDisturbTheRuntimeRefusesAndBuildsTheMenuAgain(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.setSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    await fixture.startAsync();
    const menus = fixture.tray.menus.length;

    fixture.click("Turn on Do not disturb");
    await Condition.waitAsync(() => fixture.tray.menus.length > menus);

    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "Do not disturb could not be changed from the tray: The database is busy.").length);
    Assert.isTrue(fixture.rows.includes("Turn on Do not disturb"), fixture.rows.join(","));
  }

  @TestMethod
  public async hidesTheIconWhenThisDevicesSettingTurnsItOffAndRemembersTheChoice(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();

    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    await Condition.waitAsync(() => fixture.files.state.writes.length > 0);

    Assert.isUndefined(fixture.electron.tray.shown);
    Assert.areEqual(JSON.stringify([{ trayIcon: false }]), JSON.stringify(fixture.files.state.writes));
  }
}
