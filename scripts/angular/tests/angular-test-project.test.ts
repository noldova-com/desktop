/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { AngularTestProject } from "../angular-test-project.ts";

const STAND_IN = [
  "const { writeFileSync } = require(\"node:fs\");",
  "const report = process.argv[process.argv.indexOf(\"--output-file\") + 1];",
  "writeFileSync(report, JSON.stringify({ testResults: [] }));",
  "process.stderr.write(JSON.stringify([process.env.DEBUG ?? null, process.env.NOLDOVA_TEST_RETRY ?? null]));"
].join("\n");

const folders: string[] = [];

const createAsync = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "angular-test-environment-"));
  folders.push(root);
  const cli = path.join(root, "node_modules", "@angular", "cli", "bin", "ng.js");
  await mkdir(path.dirname(cli), { recursive: true });
  await mkdir(path.join(root, "src", "noldova.desktop.window"), { recursive: true });
  await writeFile(cli, STAND_IN);
  return root;
};

describe("AngularTestProject", () => {
  let before: string | undefined;

  beforeEach(() => {
    before = process.env["DEBUG"];
  });

  afterEach(async () => {
    if (Object.isUndefined(before))
      delete process.env["DEBUG"];
    else
      process.env["DEBUG"] = before;
    for (const folder of folders.splice(0))
      await rm(folder, { recursive: true, force: true });
  });

  it("logs Vite's dependency optimizer events in every run and asks for the retry only when retrying", async () => {
    const root = await createAsync();
    delete process.env["DEBUG"];
    const project = new AngularTestProject(root);
    const logged: string[] = [];

    for (const isRetrying of [false, true]) {
      await project.testAsync([], isRetrying);
      logged.push(await readFile(path.join(root, Resources.angularTestLogFile), Resources.encoding));
    }

    assert.deepEqual(logged, [JSON.stringify(["vite:deps", null]), JSON.stringify(["vite:deps", "1"])]);
  });

  it("adds Vite's dependency optimizer events to the namespaces the caller already logs, once", async () => {
    const root = await createAsync();
    const project = new AngularTestProject(root);
    const logged: string[] = [];

    for (const debug of ["express:*", "express:*, vite:deps", "vite:deps,", String.empty]) {
      process.env["DEBUG"] = debug;
      await project.testAsync([], false);
      logged.push(await readFile(path.join(root, Resources.angularTestLogFile), Resources.encoding));
    }

    assert.deepEqual(logged, ["express:*,vite:deps", "express:*,vite:deps", "vite:deps", "vite:deps"].map(t => JSON.stringify([t, null])));
  });
});
