/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Resources } from "../resources.ts";
import { NpmFakeFixture } from "./fixtures/npm-fake.fixture.ts";
import { NpmLogsFixture } from "./fixtures/npm-logs.fixture.ts";
import { WorkflowStepFixture } from "./fixtures/workflow-step.fixture.ts";

const ARGUMENTS = ["ci", "--no-audit", "--no-fund"];
const HEADER = Resources.npmCiStalledRead([]).trimEnd();

async function runAsync(plan: readonly (readonly [number, readonly string[]])[], ending: string = "\n"): Promise<{ status: number | null, calls: readonly string[], output: string }> {
  await using npm = await NpmFakeFixture.createAsync(plan, ending);
  const result = await WorkflowStepFixture.runAsync(WorkflowStepFixture.readRun("package-app.yml", "Install the dependencies"), npm.folder, npm.bin, {});
  return { status: result.status, calls: await npm.readCallsAsync(), output: result.output };
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
