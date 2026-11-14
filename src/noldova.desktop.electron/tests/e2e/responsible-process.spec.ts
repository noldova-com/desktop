/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { PosixResponsibilityApi } from "@noldova/desktop.runtime";

import { CliFixture } from "./fixtures/cli.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { ProcessProgramFixture } from "./fixtures/process-program.fixture.ts";

test.describe("the programs modules start on macOS", () => {
  test.skip(process.platform !== "darwin", "Only macOS asks for privacy permissions in the name of a responsible process.");

  test("have the app's own executable as their responsible process, not whatever started the app", async ({ mainProcess }) => {
    const responsibility = PosixResponsibilityApi.create();
    if (Object.isNull(responsibility))
      throw new Error("There is no responsibility API on macOS.");
    const executable = await realpath(await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8"));
    const started = JsonReader.parse(await CliFixture.runAsync("run", "clock.startProgram", "--json", "--data-dir", mainProcess.dataDirectory));

    const responsible = [started.readInteger("processId"), started.readInteger("childProcessId")].map(t => responsibility.findResponsible(t));
    const owner = responsible[0] ?? 0;

    expect(responsible).toEqual([owner, owner]);
    expect(owner).toBeGreaterThan(0);
    expect(ProcessProgramFixture.read(owner)).toBe(executable);
    expect(owner).not.toBe(responsibility.findResponsible(process.pid));
    expect(responsibility.findResponsible(owner)).toBe(owner);
  });
});
