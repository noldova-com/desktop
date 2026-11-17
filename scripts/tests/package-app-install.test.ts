/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { Resources } from "../resources.ts";
import { NpmFakeFixture } from "./fixtures/npm-fake.fixture.ts";
import { NpmLogsFixture } from "./fixtures/npm-logs.fixture.ts";

const WORKFLOW = path.resolve(import.meta.dirname, "..", "..", ".github", "workflows", "package-app.yml");
const STEP = "      - name: Install the dependencies";
const RUN = "        run: |";
const INDENT = " ".repeat(10);
const BASH = process.platform === "win32" ? path.join(process.env["ProgramFiles"] ?? "C:\\Program Files", "Git", "bin", "bash.exe") : "bash";
const ARGUMENTS = ["ci", "--no-audit", "--no-fund"];
const HEADER = Resources.npmCiStalledRead([]).trimEnd();

function readStep(): string {
  const lines = readFileSync(WORKFLOW, "utf8").split(/\r?\n/);
  const start = lines.indexOf(RUN, lines.indexOf(STEP)) + 1;
  const end = lines.findIndex((t, index) => index >= start && t.length > 0 && !t.startsWith(INDENT));
  return lines.slice(start, end).map(t => t.slice(INDENT.length)).join("\n");
}

async function runAsync(plan: readonly (readonly [number, readonly string[]])[], ending: string = "\n"): Promise<{ status: number | null, calls: readonly string[], output: string }> {
  await using npm = await NpmFakeFixture.createAsync(plan, ending);
  const step = path.join(npm.folder, "step.sh");
  await writeFile(step, readStep());
  const pathKey = Object.keys(process.env).find(t => t.toUpperCase() === "PATH") ?? "PATH";
  const result = spawnSync(BASH, ["--noprofile", "--norc", "-eo", "pipefail", step], { cwd: npm.folder, encoding: "utf8",
    env: { ...process.env, [pathKey]: `${npm.bin}${path.delimiter}${process.env[pathKey] ?? ""}`, RUNNER_TEMP: npm.folder } });
  return { status: result.status, calls: await npm.readCallsAsync(), output: result.stdout };
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
  });
});
