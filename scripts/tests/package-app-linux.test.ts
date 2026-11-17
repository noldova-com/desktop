/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { CommandFakesFixture } from "./fixtures/command-fakes.fixture.ts";
import { WorkflowStepFixture } from "./fixtures/workflow-step.fixture.ts";

const WORKFLOW = "package-app.yml";
const SMOKE = WorkflowStepFixture.readRun(WORKFLOW, "Install, start and quit the package");
const LIBFUSE = WorkflowStepFixture.readRun(WORKFLOW, "Remove libfuse2, which a stock Ubuntu does not install");
const SCREEN = "xvfb-run --auto-servernum --server-args=-screen 0 1920x1080x24 npm run package:smoke";
const SKIPPED = "::notice::Skipped the Debian package's install smoke, which needs root: this self-hosted runner has none, and CI's run on a GitHub-hosted runner covers it.";
const SMOKE_FAKES = {
  "xvfb-run": "case \"$*\" in *--no-sandbox*) /bin/mkdir -p \"$RUNNER_TEMP/appimage_extracted_1\" ;; esac",
  "sysctl": "echo 0"
};

function libfuseFakes(installed: boolean): Readonly<Record<string, string>> {
  return {
    "dpkg-query": installed ? "case \"$*\" in *libfuse2t64*) exit 1 ;; *) echo 'install ok installed' ;; esac" : "exit 1",
    "sudo": "exit 0",
    "ldconfig": "exit 0"
  };
}

async function runAsync(text: string, commands: Readonly<Record<string, string>>, hosted: boolean, isPathKept: boolean = true): Promise<{ status: number | null, calls: readonly string[], output: string }> {
  await using fakes = await CommandFakesFixture.createAsync(commands);
  const result = await WorkflowStepFixture.runAsync(text, fakes.folder, fakes.bin, { RUNNER_OS: "Linux", HOSTED: String(hosted), RUNNER_TEMP: fakes.folder.split(path.sep).join("/") }, isPathKept);
  return { status: result.status, calls: await fakes.readCallsAsync(), output: result.output };
}

describe("package-app.yml's Linux steps", () => {
  it("smokes the Debian package and then the AppImage on a GitHub-hosted runner", async () => {
    const result = await runAsync(SMOKE, SMOKE_FAKES, true, false);

    assert.equal(result.status, 0);
    assert.deepEqual(result.calls.filter(t => t.startsWith("xvfb-run")), [`${SCREEN} -- --deb --require-sandbox`, SCREEN, `${SCREEN} -- --no-sandbox`]);
    assert.ok(!result.output.includes(SKIPPED));
  });

  it("skips only the Debian package's smoke on a self-hosted runner and says so", async () => {
    const result = await runAsync(SMOKE, SMOKE_FAKES, false, false);

    assert.equal(result.status, 0);
    assert.deepEqual(result.calls.filter(t => t.startsWith("xvfb-run")), [SCREEN, `${SCREEN} -- --no-sandbox`]);
    assert.ok(result.output.includes(SKIPPED), result.output);
  });

  it("fails naming xvfb when the runner has no xvfb-run", async () => {
    const result = await runAsync(SMOKE, { "sysctl": "echo 0" }, false, false);

    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
    assert.ok(result.output.includes("::error::xvfb-run is missing on this runner; install the xvfb package on it."), result.output);
  });

  it("fails naming an installed libfuse2 on a self-hosted runner without running sudo", async () => {
    const result = await runAsync(LIBFUSE, libfuseFakes(true), false);

    assert.equal(result.status, 1);
    assert.ok(!result.calls.some(t => t.startsWith("sudo")), result.calls.join("\n"));
    assert.ok(result.output.includes("::error::libfuse2 is installed on this self-hosted runner, which has no root to remove it; remove it from the runner's image."), result.output);
  });

  it("removes an installed libfuse2 with sudo on a GitHub-hosted runner", async () => {
    const result = await runAsync(LIBFUSE, libfuseFakes(true), true);

    assert.equal(result.status, 0);
    assert.deepEqual(result.calls.filter(t => t.startsWith("sudo")), ["sudo apt-get remove -y libfuse2"]);
  });

  it("passes without sudo on a self-hosted runner without libfuse2", async () => {
    const result = await runAsync(LIBFUSE, libfuseFakes(false), false);

    assert.equal(result.status, 0);
    assert.ok(!result.calls.some(t => t.startsWith("sudo")), result.calls.join("\n"));
    assert.ok(result.output.includes("libfuse2 is not installed."), result.output);
  });
});
