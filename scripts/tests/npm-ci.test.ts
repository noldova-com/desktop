/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { NpmCi } from "../npm-ci.ts";
import { Resources } from "../resources.ts";

const ARGUMENTS = ["ci", "--ignore-scripts"];
const REQUESTS = Array.from({ length: 7 }, (_, t) => `${t + 1} http fetch GET 200 https://registry.npmjs.org/package-${t}/-/package-${t}-1.0.0.tgz 12ms (cache miss)`);
const STALLED = [...REQUESTS, "8 error code ETIMEDOUT", "9 error syscall read", "10 error errno -60"];
const RESET = [...REQUESTS, "8 error code ECONNRESET", "9 error syscall read", "10 error errno -54"];
const CONNECTING = [...REQUESTS, "8 error code ETIMEDOUT", "9 error syscall connect", "10 error errno -60"];
const OTHER = [...REQUESTS, "8 error code EINTEGRITY", "9 error syscall read"];

const FAKE_NPM = [
  "import { appendFileSync, readFileSync, writeFileSync } from \"node:fs\";",
  "import path from \"node:path\";",
  "const folder = import.meta.dirname;",
  "appendFileSync(path.join(folder, \"calls.txt\"), JSON.stringify(process.argv.slice(2)) + \"\\n\");",
  "const calls = readFileSync(path.join(folder, \"calls.txt\"), \"utf8\").trim().split(\"\\n\").length;",
  "const [status, lines, ending] = JSON.parse(readFileSync(path.join(folder, \"plan.json\"), \"utf8\"))[calls - 1];",
  "writeFileSync(path.join(process.env.npm_config_logs_dir, \"run-debug-0.log\"), lines.map(t => t + ending).join(\"\"));",
  "process.exitCode = status;"
].join("\n");

async function runAsync(plan: readonly (readonly [number, readonly string[]])[], ending: string = "\n"): Promise<{ status: number, calls: readonly string[], reports: readonly string[] }> {
  const folder = await mkdtemp(path.join(tmpdir(), "npm-ci-test-"));
  try {
    const npm = path.join(folder, "npm.mjs");
    await writeFile(npm, FAKE_NPM);
    await writeFile(path.join(folder, "calls.txt"), "");
    await writeFile(path.join(folder, "plan.json"), JSON.stringify(plan.map(([status, lines]) => [status, lines, ending])));
    const reports: string[] = [];
    const status = NpmCi.run(npm, ARGUMENTS, folder, t => reports.push(t));
    const calls = (await readFile(path.join(folder, "calls.txt"), "utf8")).split("\n").filter(t => t.length > 0);
    return { status, calls, reports };
  }
  finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe("NpmCi", () => {
  it("runs npm ci once more after a read that timed out and reports the last requests before it", async () => {
    const result = await runAsync([[196, STALLED], [0, REQUESTS]]);

    assert.equal(result.status, 0);
    assert.deepEqual(result.calls, [JSON.stringify(ARGUMENTS), JSON.stringify(ARGUMENTS)]);
    assert.deepEqual(result.reports, [Resources.npmCiStalledRead(REQUESTS.slice(-5))]);
  });

  it("runs npm ci once more after a read the connection reset", async () => {
    const result = await runAsync([[196, RESET], [0, REQUESTS]]);

    assert.equal(result.status, 0);
    assert.equal(result.calls.length, 2);
  });

  it("recognizes the stalled read in a log whose lines end in CRLF", async () => {
    const result = await runAsync([[196, STALLED], [0, REQUESTS]], "\r\n");

    assert.equal(result.status, 0);
    assert.equal(result.calls.length, 2);
  });

  it("fails with the second run's status when the second run stalls too, and runs no third", async () => {
    const result = await runAsync([[196, STALLED], [196, STALLED], [0, REQUESTS]]);

    assert.equal(result.status, 196);
    assert.equal(result.calls.length, 2);
  });

  it("fails at once on a timeout while connecting, as npm already retries those", async () => {
    const result = await runAsync([[196, CONNECTING], [0, REQUESTS]]);

    assert.equal(result.status, 196);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.reports, []);
  });

  it("fails at once on any other error", async () => {
    const result = await runAsync([[1, OTHER], [0, REQUESTS]]);

    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.reports, []);
  });

  it("runs npm ci once when it succeeds", async () => {
    const result = await runAsync([[0, REQUESTS]]);

    assert.equal(result.status, 0);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.reports, []);
  });
});
