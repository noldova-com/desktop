/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

test.describe("show in folder", () => {
  test("the window's page shows a file and a folder, each selected in its parent folder, through the main process, which refuses a missing path and a relative path without showing them", async ({ mainProcess }, testInfo) => {
    await mkdir(testInfo.outputPath("shown"), { recursive: true });
    const folder = await realpath(testInfo.outputPath("shown"));
    const file = path.join(folder, "report.pdf");
    await writeFile(file, "report");
    const shown = await mainProcess.application.evaluateHandle(({ shell }) => {
      const files: string[] = [];
      shell.showItemInFolder = (fullPath: string): void => {
        files.push(fullPath);
      };
      return files;
    });

    const answers = await PageBridgeFixture.evaluateAsync(mainProcess.window, async (bridge, paths) => {
      const results: unknown[] = [];
      for (const shown of paths)
        results.push(await bridge.showInFolder(shown));
      return results;
    }, [file, folder, path.join(folder, "missing.pdf"), "report.pdf"]);

    expect(answers).toEqual([
      null,
      null,
      "no file can be read at the path.",
      "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path."
    ]);
    expect(await shown.jsonValue()).toEqual([file, folder]);
    await expect.poll(() => mainProcess.failures.filter(t => t.includes("A file was not shown in its folder")).length).toBe(2);
    expect(mainProcess.acceptFailures(/A file was not shown in its folder/).some(t => t.includes(folder))).toBe(false);
    await mainProcess.checkpointAsync("file-shown-in-folder");
  });
});
