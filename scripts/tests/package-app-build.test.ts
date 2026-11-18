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

import { NpmFakeFixture } from "./fixtures/npm-fake.fixture.ts";
import { WorkflowStepFixture } from "./fixtures/workflow-step.fixture.ts";

const REGISTRY = "https://npm.pkg.github.com/download";
const PACKAGES: Readonly<Record<string, unknown>> = {
  "": { name: "app" },
  "node_modules/@noldova/sample": { version: "0.0.3", resolved: `${REGISTRY}/sample-0.0.3.tgz` },
  "node_modules/@noldova/sample.linux-arm64": { version: "0.0.3", resolved: `${REGISTRY}/sample.linux-arm64-0.0.3.tgz`, os: ["linux"], cpu: ["arm64"], libc: ["glibc"] },
  "node_modules/@noldova/sample.linux-arm64-musl": { version: "0.0.3", resolved: `${REGISTRY}/sample.linux-arm64-musl-0.0.3.tgz`, os: ["linux"], cpu: ["arm64"], libc: ["musl"] },
  "node_modules/@noldova/sample.linux-x64": { version: "0.0.3", resolved: `${REGISTRY}/sample.linux-x64-0.0.3.tgz`, os: ["linux"], cpu: ["x64"], libc: ["glibc"] },
  "node_modules/@noldova/sample.win32-arm64": { version: "0.0.3", resolved: `${REGISTRY}/sample.win32-arm64-0.0.3.tgz`, os: ["win32"], cpu: ["arm64"] },
  "node_modules/@noldova/sample.not-windows": { version: "0.0.3", resolved: `${REGISTRY}/sample.not-windows-0.0.3.tgz`, os: ["!win32"], cpu: "any" },
  "node_modules/host/node_modules/@noldova-com/nested": { version: "1.0.0", resolved: `${REGISTRY}/nested-1.0.0.tgz` },
  "node_modules/@noldova/own": { version: "1.0.0", resolved: "file:_packages/noldova-own-1.0.0.tgz" },
  "node_modules/@esbuild/linux-arm64": { version: "0.27.0", resolved: "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.27.0.tgz", os: ["linux"], cpu: ["arm64"] }
};
const INSTALL = "mkdir -p app/node_modules/@noldova/sample app/node_modules/host/node_modules/@noldova-com/nested";

async function runAsync(prepare: string, platform: string, architecture: string, packages: Readonly<Record<string, unknown>> | null = PACKAGES):
  Promise<{ status: number | null, packs: readonly string[], output: string, archives: string }> {
  await using npm = await NpmFakeFixture.createAsync([], "\n");
  const app = path.join(npm.folder, "app");
  await mkdir(app);
  if (packages !== null)
    await writeFile(path.join(app, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
  const result = await WorkflowStepFixture.runAsync(WorkflowStepFixture.readRun("package-app.yml", "Build the app"), npm.folder, npm.bin,
    { PREPARE: prepare, APP_FOLDER: app, TARGET_PLATFORM: platform, TARGET_ARCHITECTURE: architecture });
  const archives = `${npm.folder.split(path.sep).join("/")}/company-archives`;
  return { status: result.status, packs: await npm.readPacksAsync(), output: result.output, archives: existsSync(archives) ? archives : "" };
}

function formatPack(archives: string, specs: readonly string[]): string {
  return JSON.stringify(["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", archives, ...specs]);
}

describe("package-app.yml's build step", () => {
  it("packs the company packages that the prepare command's install left out and that fit the target, once that install ran", async () => {
    const result = await runAsync(`echo prepared; ${INSTALL}`, "linux", "arm64");

    assert.equal(result.status, 0);
    assert.deepEqual(result.packs, [formatPack(result.archives, ["@noldova/sample.linux-arm64@0.0.3", "@noldova/sample.not-windows@0.0.3"])]);
    assert.equal(result.output, "prepared\nThe app's install leaves out these company packages for this target's processor or system, so the package step takes them from "
      + `${result.archives}: @noldova/sample.linux-arm64@0.0.3 @noldova/sample.not-windows@0.0.3\n`);
  });

  it("reads Windows targets without a C library and leaves out packages a negated system excludes", async () => {
    const result = await runAsync(INSTALL, "windows", "arm64");

    assert.equal(result.status, 0);
    assert.deepEqual(result.packs, [formatPack(result.archives, ["@noldova/sample.win32-arm64@0.0.3"])]);
  });

  it("packs nothing and makes no folder when the install left out no company package for the target", async () => {
    const result = await runAsync(`${INSTALL} app/node_modules/@noldova/sample.linux-x64 app/node_modules/@noldova/sample.not-windows`, "linux", "x64");

    assert.equal(result.status, 0);
    assert.deepEqual([result.packs, result.archives, result.output], [[], "", ""]);
  });

  it("fails with the prepare command's status before it reads the lockfile", async () => {
    const result = await runAsync("exit 3", "linux", "arm64");

    assert.equal(result.status, 3);
    assert.deepEqual(result.packs, []);
  });

  it("fails when the app's lockfile can't be read, and packs nothing", async () => {
    const result = await runAsync(INSTALL, "linux", "arm64", null);

    assert.notEqual(result.status, 0);
    assert.deepEqual(result.packs, []);
  });
});
