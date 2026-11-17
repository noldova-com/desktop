/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { Resources } from "../resources.ts";
import { NpmFakeFixture } from "./fixtures/npm-fake.fixture.ts";
import { NpmLogsFixture } from "./fixtures/npm-logs.fixture.ts";
import { WorkflowStepFixture } from "./fixtures/workflow-step.fixture.ts";

const ARGUMENTS = ["ci", "--no-audit", "--no-fund"];
const HEADER = Resources.npmCiStalledRead([]).trimEnd();

async function runAsync(plan: readonly (readonly [number, readonly string[]])[], ending: string = "\n", packages: Readonly<Record<string, unknown>> | null = {},
  installed: readonly string[] = []): Promise<{ status: number | null, calls: readonly string[], packs: readonly string[], output: string, archives: string }> {
  await using npm = await NpmFakeFixture.createAsync(plan, ending);
  const app = path.join(npm.folder, "app");
  await mkdir(app);
  if (packages !== null)
    await writeFile(path.join(app, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
  for (const location of installed)
    await mkdir(path.join(app, location), { recursive: true });
  const result = await WorkflowStepFixture.runAsync(WorkflowStepFixture.readRun("package-app.yml", "Install the dependencies"), npm.folder, npm.bin, { APP_FOLDER: app });
  const archives = `${npm.folder.split(path.sep).join("/")}/company-archives`;
  return { status: result.status, calls: await npm.readCallsAsync(), packs: await npm.readPacksAsync(), output: result.output, archives: existsSync(archives) ? archives : "" };
}

describe("package-app.yml's install step", () => {
  it("runs npm ci once more after a read that timed out and prints the last requests before it", async () => {
    const result = await runAsync([[196, NpmLogsFixture.STALLED], [0, NpmLogsFixture.REQUESTS]]);

    assert.equal(result.status, 0);
    assert.deepEqual(result.calls, [JSON.stringify(ARGUMENTS), JSON.stringify(ARGUMENTS)]);
    assert.equal(result.output, Resources.npmCiStalledRead(NpmLogsFixture.REQUESTS.slice(-5)));
  });

  it("runs npm ci once more after a read the connection reset", async () => {
    const result = await runAsync([[196, NpmLogsFixture.RESET], [0, NpmLogsFixture.REQUESTS]]);

    assert.equal(result.status, 0);
    assert.equal(result.calls.length, 2);
  });

  it("recognizes the stalled read in a log whose lines end in CRLF", async () => {
    const result = await runAsync([[196, NpmLogsFixture.STALLED], [0, NpmLogsFixture.REQUESTS]], "\r\n");

    assert.equal(result.status, 0);
    assert.equal(result.calls.length, 2);
  });

  it("fails with the second run's status when the second run stalls too, and runs no third", async () => {
    const result = await runAsync([[196, NpmLogsFixture.STALLED], [196, NpmLogsFixture.STALLED], [0, NpmLogsFixture.REQUESTS]]);

    assert.equal(result.status, 196);
    assert.equal(result.calls.length, 2);
  });

  it("fails at once on a timeout while connecting, as npm already retries those", async () => {
    const result = await runAsync([[196, NpmLogsFixture.CONNECTING], [0, NpmLogsFixture.REQUESTS]]);

    assert.equal(result.status, 196);
    assert.equal(result.calls.length, 1);
    assert.ok(!result.output.includes(HEADER));
  });

  it("fails at once on any other error", async () => {
    const result = await runAsync([[1, NpmLogsFixture.OTHER], [0, NpmLogsFixture.REQUESTS]]);

    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 1);
    assert.ok(!result.output.includes(HEADER));
  });

  it("runs npm ci once when it succeeds", async () => {
    const result = await runAsync([[0, NpmLogsFixture.REQUESTS]]);

    assert.equal(result.status, 0);
    assert.equal(result.calls.length, 1);
    assert.equal(result.output, "");
    assert.deepEqual([result.packs, result.archives], [[], ""]);
  });

  it("packs each company package npm ci left out for another processor or system into the runner's company archives", async () => {
    const registry = "https://npm.pkg.github.com/download";
    const result = await runAsync([[0, NpmLogsFixture.REQUESTS]], "\n", {
      "": { name: "app" },
      "node_modules/@noldova/sample.linux-arm64": { version: "0.0.3", resolved: `${registry}/sample.linux-arm64-0.0.3.tgz`, optional: true },
      "node_modules/@noldova/sample.linux-x64": { version: "0.0.3", resolved: `${registry}/sample.linux-x64-0.0.3.tgz`, optional: true },
      "node_modules/host/node_modules/@noldova-com/nested.win32-arm64": { version: "1.0.0", resolved: `${registry}/nested.win32-arm64-1.0.0.tgz`, optional: true },
      "node_modules/@noldova/own": { version: "1.0.0", resolved: "file:_packages/noldova-own-1.0.0.tgz" },
      "node_modules/@esbuild/linux-arm64": { version: "0.27.0", resolved: "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.27.0.tgz", optional: true }
    }, ["node_modules/@noldova/sample.linux-x64"]);

    assert.equal(result.status, 0);
    assert.deepEqual(result.packs, [JSON.stringify(["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", result.archives, "@noldova/sample.linux-arm64@0.0.3",
      "@noldova-com/nested.win32-arm64@1.0.0"])]);
    assert.equal(result.output, `npm ci leaves out these company packages for this runner's processor or system, so the package step takes them from ${result.archives}: `
      + "@noldova/sample.linux-arm64@0.0.3 @noldova-com/nested.win32-arm64@1.0.0\n");
  });

  it("fails when the app's lockfile can't be read, and packs nothing", async () => {
    const result = await runAsync([[0, NpmLogsFixture.REQUESTS]], "\n", null);

    assert.notEqual(result.status, 0);
    assert.deepEqual(result.packs, []);
  });
});
