/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readlinkSync } from "node:fs";
import path from "node:path";

import { DataDirectory, DiscoveryReader, RuntimeBuild } from "@noldova/desktop.runtime";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { ProcessListFixture } from "./fixtures/process-list.fixture.ts";

test.describe("the development app", () => {
  const programs: Readonly<Record<string, string>> = { win32: "Noldova Desktop Sample.exe", darwin: "Noldova Desktop Sample", linux: "noldova-desktop" };
  const processNames: Readonly<Record<string, RegExp>> = { win32: /^Noldova Desktop Sample\.exe$/, darwin: /^Noldova Desktop Sample(?: Helper(?: \([A-Za-z]+\))?)?$/, linux: /^noldova-desktop$/ };

  test("Noldova Desktop Sample, its helpers and its runtime run from the development app as Noldova Desktop Sample, never as Electron", async ({ mainProcess }) => {
    await expect.poll(() => mainProcess.isVisibleAsync()).toBe(true);

    const program = await mainProcess.application.evaluate(() => process.execPath);
    const discovery = await DiscoveryReader.readAsync(new DataDirectory(mainProcess.dataDirectory));
    const runtime = discovery?.processId ?? 0;
    const processIds = [...new Set([...await mainProcess.application.evaluate(({ app }) => app.getAppMetrics().map(t => t.pid)), runtime])];
    const names = ProcessListFixture.readNames(processIds);

    expect(path.basename(program)).toBe(programs[process.platform]);
    expect(program).toContain(path.join("_build", "development-app"));
    expect(discovery?.executablePath).toBe(program);
    expect(await mainProcess.application.evaluate(({ app }) => [app.isPackaged, process.defaultApp === true])).toEqual([true, true]);
    expect(await mainProcess.application.evaluate(({ app }) => app.getVersion()), "The development app carries the product's version, which the updater compares with the feed's.")
      .toBe(RuntimeBuild.identity.productVersion);
    expect([...names.keys()].sort((a, b) => a - b)).toEqual([...processIds].sort((a, b) => a - b));
    for (const name of names.values()) {
      expect(name.toLowerCase()).not.toContain("electron");
      expect(path.basename(name)).toMatch(processNames[process.platform] ?? /^$/);
    }
    if (process.platform === "linux")
      for (const processId of [mainProcess.application.process().pid ?? 0, runtime])
        expect(readlinkSync(`/proc/${processId}/exe`)).toBe(program);
    await mainProcess.checkpointAsync("development-app");
  });
});
