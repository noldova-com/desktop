/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { CommandFakesFixture } from "./fixtures/command-fakes.fixture.ts";
import { WorkflowStepFixture } from "./fixtures/workflow-step.fixture.ts";

const SMOKE = WorkflowStepFixture.readRun("package-app.yml", "Install, start and quit the package");
const SKIPPED = "::notice::Skipped installing the installer package into /Applications, which needs root: this self-hosted runner has none, and CI's run on a GitHub-hosted runner covers it. The smoke below runs the app from the package's payload.";

async function runAsync(hosted: boolean, isPackageBuilt: boolean): Promise<{ status: number | null, calls: readonly string[], output: string }> {
  await using fakes = await CommandFakesFixture.createAsync({ "npm": "exit 0" });
  const output = path.join(fakes.folder, "_build", "package", "out");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "Sample App-1.2.3-macos-arm64.dmg"), "image");
  if (isPackageBuilt)
    await writeFile(path.join(output, "Sample App-1.2.3-macos-arm64.pkg"), "package");
  const result = await WorkflowStepFixture.runAsync(SMOKE, fakes.folder, fakes.bin, { RUNNER_OS: "macOS", HOSTED: String(hosted) });
  return { status: result.status, calls: await fakes.readCallsAsync(), output: result.output };
}

const MINUTE = 60_000;
const BUILDER_BUDGET = 30 * MINUTE;
const OTHER_STEPS_BUDGET = 15 * MINUTE;

async function readResourceNumberAsync(name: string): Promise<number> {
  const text = await readFile(path.resolve(import.meta.dirname, "..", "..", "src", "noldova.desktop.build", "src", "resources.ts"), "utf8");
  const value = new RegExp(`static readonly ${name}: number = ([0-9_]+);`).exec(text)?.[1];
  assert.ok(value !== undefined, name);
  return Number(value.replaceAll("_", ""));
}

async function readStepMinutesAsync(step: string): Promise<number> {
  const text = await readFile(path.resolve(import.meta.dirname, "..", "..", ".github", "workflows", "package-app.yml"), "utf8");
  const value = new RegExp(`- name: ${step}\\r?\\n\\s+timeout-minutes: ([0-9]+)`).exec(text)?.[1];
  assert.ok(value !== undefined, step);
  return Number(value);
}

async function readJobMinutesAsync(): Promise<readonly number[]> {
  const text = await readFile(path.resolve(import.meta.dirname, "..", "..", ".github", "workflows", "package-app.yml"), "utf8");
  const minutes = [...text.matchAll(/^ {4}timeout-minutes: ([0-9]+)\r?$/gm)].map(t => Number(t[1]));
  assert.equal(minutes.length, 2);
  return minutes;
}

describe("package-app.yml's macOS packaging limit", () => {
  it("leaves the builder 30 minutes after the disk image's notarization and stapling, and the job's other steps 15", async () => {
    const [notarization, staple, step, job] = [await readResourceNumberAsync("macNotarizationTimeout"), await readResourceNumberAsync("macStapleTimeout"),
      (await readStepMinutesAsync("Make the package")) * MINUTE, Math.min(...await readJobMinutesAsync()) * MINUTE];

    assert.ok(step - notarization - staple >= BUILDER_BUDGET, `${step}, ${notarization}, ${staple}`);
    assert.ok(job - step >= OTHER_STEPS_BUDGET, `${job}, ${step}`);
  });
});

describe("package-app.yml's macOS smoke", () => {
  it("installs the installer package and then smokes the app on a GitHub-hosted runner", async () => {
    const result = await runAsync(true, true);

    assert.equal(result.status, 0);
    assert.deepEqual(result.calls, ["npm run package:smoke -- --pkg", "npm run package:smoke"]);
    assert.ok(!result.output.includes(SKIPPED), result.output);
  });

  it("skips only the installer package's install on a self-hosted runner and says so", async () => {
    const result = await runAsync(false, true);

    assert.equal(result.status, 0);
    assert.deepEqual(result.calls, ["npm run package:smoke"]);
    assert.ok(result.output.includes(SKIPPED), result.output);
  });

  it("smokes only the disk image's app when the build made no installer package", async () => {
    for (const hosted of [true, false]) {
      const result = await runAsync(hosted, false);

      assert.equal(result.status, 0);
      assert.deepEqual(result.calls, ["npm run package:smoke"], String(hosted));
      assert.ok(!result.output.includes(SKIPPED), result.output);
    }
  });
});
