/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { TaskbarIdentity } from "@noldova/desktop.electron";

@TestClass
export class TaskbarIdentityTests {
  private static readonly WORK: string = path.resolve("work folder");
  private static readonly PROGRAM: string = path.resolve("Fixture Works", "Noldova Desktop Sample.exe");
  private static readonly ICON: string = path.resolve("checkout", "assets", "icons", "icon-dark.ico");

  @TestMethod
  public async relaunchesAPackagedBuildByItsProgramWithItsPathsMadeAbsoluteAndShowsTheProgramsIcon(): Promise<void> {
    const data = path.resolve("data");
    const identity = await TaskbarIdentity.createAsync(true, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, "main.js", [
      TaskbarIdentityTests.PROGRAM,
      `--data-dir=${data}`,
      "--inspect=0",
      "--user-data-dir=../noldova-desktop-look",
      "--device-dir=device"
    ], TaskbarIdentityTests.WORK);

    Assert.areEqual("com.noldova.desktop", identity.appId);
    Assert.areEqual(TaskbarIdentityTests.PROGRAM, identity.iconPath);
    Assert.areEqual([
      `"${TaskbarIdentityTests.PROGRAM}"`,
      `"--data-dir=${data}"`,
      `"--user-data-dir=${path.resolve(TaskbarIdentityTests.WORK, "..", "noldova-desktop-look")}"`,
      `"--device-dir=${path.join(TaskbarIdentityTests.WORK, "device")}"`
    ].join(" "), identity.relaunchCommand);
  }

  @TestMethod
  public async relaunchesADevelopmentBuildByItsCheckoutsDevelopmentPackageUnderItsOwnAppIdAndShowsTheIconFile(): Promise<void> {
    const identity = await TaskbarIdentity.createAsync(false, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, "main.js", [], TaskbarIdentityTests.WORK);
    const checkout = path.resolve(TaskbarIdentityTests.WORK, "..", "..", "..");
    const command = `"${TaskbarIdentityTests.PROGRAM}" "${path.join(checkout, "_build", "development-package")}"`;
    const appId = `com.noldova.desktop.development.${createHash("sha256").update(checkout).digest("hex").slice(0, 8)}`;

    Assert.areEqual(appId, identity.appId);
    Assert.areEqual(command, identity.relaunchCommand);
    Assert.areEqual(JSON.stringify({
      appId,
      appIconPath: TaskbarIdentityTests.ICON,
      appIconIndex: 0,
      relaunchCommand: command,
      relaunchDisplayName: "Noldova Desktop Sample"
    }), JSON.stringify(identity.toAppDetails()));
  }

  @TestMethod
  public async givesALinkedCheckoutTheIdOfTheFolderItLinksTo(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "desktop-taskbar-"));
    try {
      const checkout = path.join(root, "checkout");
      const linked = path.join(root, "linked");
      await mkdir(checkout);
      await symlink(checkout, linked, "junction");
      const appIdAsync = async (folder: string): Promise<string> =>
        (await TaskbarIdentity.createAsync(false, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, path.join(folder, "node_modules", "@noldova", "desktop.electron", "main.js"), [],
          TaskbarIdentityTests.WORK)).appId;

      Assert.areEqual(await appIdAsync(checkout), await appIdAsync(linked));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async givesEachCheckoutItsOwnDevelopmentAppIdAndAPackagedBuildThePlainOne(): Promise<void> {
    const appIdAsync = async (checkout: string, isPackaged: boolean = false): Promise<string> =>
      (await TaskbarIdentity.createAsync(isPackaged, TaskbarIdentityTests.PROGRAM, TaskbarIdentityTests.ICON, path.join(checkout, "node_modules", "@noldova", "desktop.electron", "main.js"), [],
        TaskbarIdentityTests.WORK)).appId;
    const first = path.resolve("lanes", "first");

    Assert.isTrue(/^com\.noldova\.desktop\.development\.[0-9a-f]{8}$/.test(await appIdAsync(first)));
    Assert.areEqual(await appIdAsync(first), await appIdAsync(path.join(first, "..", "first")));
    Assert.areNotEqual(await appIdAsync(first), await appIdAsync(path.resolve("lanes", "second")));
    Assert.areEqual("com.noldova.desktop", await appIdAsync(first, true));
    Assert.areEqual("com.noldova.desktop", await appIdAsync(path.resolve("lanes", "second"), true));
  }

  @TestMethod
  @TestData(" ", "icon.exe", "\"icon.exe\"")
  @TestData("com.noldova.desktop", String.empty, "\"icon.exe\"")
  @TestData("com.noldova.desktop", "icon.exe", " ")
  public refusesABlankPart(appId: string, iconPath: string, relaunchCommand: string): void {
    Assert.throws(() => new TaskbarIdentity(appId, iconPath, relaunchCommand), ArgumentException);
  }
}
