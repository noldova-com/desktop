/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
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
