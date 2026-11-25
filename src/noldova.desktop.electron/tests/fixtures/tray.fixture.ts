/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import type { MenuItemConstructorOptions } from "electron";

import type { JsonObject } from "@noldova/context.json";
import { Assert } from "@noldova/context.testing";
import { Event, ShellEvents } from "@noldova/desktop.protocol";
import type { ProductTrayItem } from "@noldova/desktop.runtime";

import { Condition } from "./condition.fixture.js";
import { MainProcessStartFixture } from "./main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "./fake-main-process-environment.fixture.js";
import { FakeDeviceFiles } from "./fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "./fake-device-identity.fixture.js";
import { FakeElectron } from "./fake-electron.fixture.js";
import { FakeRuntimeConnection } from "./fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "./fake-runtime-launcher.fixture.js";
import type { FakeTray } from "./fake-tray.fixture.js";

export class TrayFixture {
  public readonly connection: FakeRuntimeConnection = new FakeRuntimeConnection();
  public readonly launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(this.connection);
  public readonly electron: FakeElectron = new FakeElectron();
  public readonly files: FakeDeviceFiles = new FakeDeviceFiles();
  public readonly process: FakeMainProcessEnvironment;

  public constructor(platform: string) {
    this.process = new FakeMainProcessEnvironment(platform);
  }

  public get tray(): FakeTray {
    const tray = this.electron.tray.shown;
    Assert.isDefined(tray, "No tray icon shows.");
    return tray;
  }

  public get menu(): MenuItemConstructorOptions[] {
    const menu = this.tray.menus.at(-1);
    const template = this.electron.menu.templates.find(t => t === menu);
    Assert.isDefined(template, "The tray icon has no menu.");
    return template;
  }

  public get rows(): string[] {
    return this.menu.map(t => t.type === "separator" ? "-" : `${t.label ?? String.empty}${t.enabled === false ? " (disabled)" : String.empty}${t.type === "checkbox" || t.type === "radio" ? ` [${t.checked === true ? "x" : " "}]` : String.empty}`);
  }

  public static notification(id: number, title: string, owner: string = "clock", isRead: boolean = false): JsonObject {
    return { id: String(id), sequence: id, post: { kind: `${owner}.alarm`, title, severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead };
  }

  public async startAsync(moduleUrl: string = MainProcessStartFixture.MODULE_URL, tray: readonly ProductTrayItem[] | null = null): Promise<void> {
    await MainProcessStartFixture.startReadyAsync(this.process.platform, this.launcher, this.electron, new FakeDeviceIdentity(), this.process, this.files, moduleUrl, tray);
    await Condition.waitAsync(() => this.connection.calls.includes("desktop.readSetting") && this.connection.calls.includes("desktop.agentControl"));
    await setImmediate();
  }

  public send(name: string, payload: JsonObject): void {
    const event = name === "work" ? ShellEvents.work : name === "notifications" ? ShellEvents.notifications : name === "agentControl" ? ShellEvents.agentControlChanged : ShellEvents.settingsChanged;
    this.launcher.listener?.onEvent(new Event(event, payload));
  }

  public click(label: string): void {
    MainProcessStartFixture.click(this.menu.find(t => t.label === label));
  }
}
