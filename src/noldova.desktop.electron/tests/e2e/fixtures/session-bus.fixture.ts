/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

export class SessionBusFixture {
  private static readonly SEND: string = "dbus-send";
  private static readonly BUS: readonly string[] = ["--session", "--print-reply", "--dest=org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus.NameHasOwner"];
  private static readonly WATCHER: readonly string[] = ["--session", "--print-reply", "--dest=org.kde.StatusNotifierWatcher", "/StatusNotifierWatcher", "org.freedesktop.DBus.Properties.Get",
    "string:org.kde.StatusNotifierWatcher", "string:IsStatusNotifierHostRegistered"];
  private static readonly WATCHER_NAME: string = "org.kde.StatusNotifierWatcher";
  private static readonly NOTIFICATIONS_NAME: string = "org.freedesktop.Notifications";
  private static readonly TRUE: RegExp = /boolean true\s*$/;
  private static readonly WAIT: number = 10_000;

  public static async hasTrayHostAsync(): Promise<boolean> {
    if (process.platform !== "linux")
      return process.platform === "win32";
    if (!await SessionBusFixture.hasOwnerAsync(SessionBusFixture.WATCHER_NAME))
      return false;
    return SessionBusFixture.TRUE.test(await SessionBusFixture.sendAsync(SessionBusFixture.WATCHER));
  }

  public static async hasNotificationsAsync(): Promise<boolean> {
    if (process.platform !== "linux")
      return process.platform === "win32";
    return await SessionBusFixture.hasOwnerAsync(SessionBusFixture.NOTIFICATIONS_NAME);
  }

  private static async hasOwnerAsync(name: string): Promise<boolean> {
    return SessionBusFixture.TRUE.test(await SessionBusFixture.sendAsync([...SessionBusFixture.BUS, `string:${name}`]));
  }

  private static async sendAsync(commandArguments: readonly string[]): Promise<string> {
    const { stdout } = await promisify(execFile)(SessionBusFixture.SEND, commandArguments, { encoding: "utf8", timeout: SessionBusFixture.WAIT });
    return stdout;
  }
}
