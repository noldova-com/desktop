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

test.describe("open file", () => {
  test("the window's page opens a document in its default app through the main process, which refuses a program, a folder, a missing path and a relative path without opening them", async ({ mainProcess }, testInfo) => {
    await mkdir(testInfo.outputPath("opened", "inner.md"), { recursive: true });
    const folder = await realpath(testInfo.outputPath("opened"));
    const file = path.join(folder, "notes.md");
    const program = path.join(folder, "run.exe");
    await writeFile(file, "notes");
    await writeFile(program, "program");
    const opened = await mainProcess.application.evaluateHandle(({ shell }) => {
      const files: string[] = [];
      shell.openPath = (openedPath: string): Promise<string> => {
        files.push(openedPath);
        return Promise.resolve("");
      };
      return files;
    });

    const answers = await PageBridgeFixture.evaluateAsync(mainProcess.window, async (bridge, paths) => {
      const results: unknown[] = [];
      for (const opened of paths)
        results.push(await bridge.openFile(opened));
      return results;
    }, [file, program, path.join(folder, "inner.md"), path.join(folder, "missing.pdf"), "notes.md"]);

    expect(answers).toEqual([
      null,
      "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.",
      "the path isn't a regular file; a folder, or a link to one, isn't opened.",
      "no file can be read at the path.",
      "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path."
    ]);
    expect(await opened.jsonValue()).toEqual([file]);
    await expect.poll(() => mainProcess.failures.filter(t => t.includes("A file was not opened")).length).toBe(4);
    expect(mainProcess.acceptFailures(/A file was not opened/).some(t => t.includes(folder))).toBe(false);
    await mainProcess.checkpointAsync("file-opened");
  });
});
