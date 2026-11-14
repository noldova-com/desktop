/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { installedElectron } from "./fixtures/installed-electron.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.describe("the Windows taskbar", () => {
  test.skip(process.platform !== "win32", "The taskbar's relaunch command is Windows only.");
  test.use({ mainProcessArguments: ["--user-data-dir=profile"], mainProcessVariant: BuildVariantFixture.noModules });

  test("the taskbar's relaunch command, started elsewhere, reaches the running Noldova Desktop Sample with a relative profile and opens no second window", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
    const launch = await mainProcess.application.evaluate(({ app }) => {
      globalThis.desktopSecondInstance = false;
      app.once("second-instance", () => {
        globalThis.desktopSecondInstance = true;
      });
      return { isPackaged: app.isPackaged && process.defaultApp !== true, executablePath: process.execPath, argv: process.argv, workingDirectory: process.cwd(), profile: app.getPath("userData") };
    });
    const command = (await installedElectron.TaskbarIdentity.createAsync(
      launch.isPackaged,
      launch.executablePath,
      launch.executablePath,
      path.resolve("node_modules", "@noldova", "desktop.electron", "main.js"),
      launch.argv,
      launch.workingDirectory)).relaunchCommand;

    const second = spawn(command, { cwd: os.tmpdir(), shell: true, stdio: "ignore", windowsHide: true });
    const exitCode = await new Promise<number | null>(resolve => second.once("exit", resolve));

    expect(launch.profile).toBe(path.join(mainProcess.root, "profile"));
    expect(exitCode).toBe(0);
    await expect.poll(() => mainProcess.application.evaluate(() => globalThis.desktopSecondInstance)).toBe(true);
    expect(await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await mainProcess.checkpointAsync("taskbar-relaunch");
  });

  test("the program's icon, which the taskbar shows, is the outlined icon in light and in dark mode", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
    const read = (mode: "light" | "dark"): Promise<{ icon: string; isEmpty: boolean; isDark: boolean }> => mainProcess.application.evaluate(async ({ app, nativeTheme }, themeSource) => {
      nativeTheme.themeSource = themeSource;
      const icon = await app.getFileIcon(process.execPath, { size: "large" });
      return { icon: icon.toDataURL(), isEmpty: icon.isEmpty(), isDark: nativeTheme.shouldUseDarkColors };
    }, mode);

    const light = await read("light");
    const dark = await read("dark");

    expect([light.isDark, dark.isDark]).toEqual([false, true]);
    expect([light.isEmpty, dark.isEmpty]).toEqual([false, false]);
    expect(dark.icon).toBe(light.icon);
  });
});
