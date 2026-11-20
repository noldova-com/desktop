/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const WORKFLOW: readonly string[] = readFileSync(path.resolve(import.meta.dirname, "..", "..", ".github", "workflows", "release-app.yml"), "utf8").split(/\r?\n/);

function readJob(job: string): readonly string[] {
  const start = WORKFLOW.indexOf(`  ${job}:`);
  assert.ok(start >= 0, `release-app.yml has no ${job} job.`);
  const end = WORKFLOW.findIndex((t, index) => index > start && /^ {2}\S/.test(t));
  return WORKFLOW.slice(start + 1, end < 0 ? WORKFLOW.length : end);
}

function readBlock(lines: readonly string[], key: string): readonly string[] {
  const start = lines.indexOf(`    ${key}:`);
  assert.ok(start >= 0, `The job has no ${key}.`);
  const end = lines.findIndex((t, index) => index > start && /^ {4}\S/.test(t));
  return lines.slice(start + 1, end).map(t => t.trim());
}

function findStep(lines: readonly string[], text: string): number {
  const index = lines.findIndex(t => t.includes(text));
  assert.ok(index >= 0, `No step has ${text}.`);
  return index;
}

describe("release-app.yml's release lock", () => {
  it("has publish take the release lock before it publishes, with no job waiting in a concurrency group", () => {
    const publish = readJob("publish");

    assert.ok(findStep(publish, "release-command-line.js\" release-lock") < findStep(publish, "release-command-line.js\" release-publish"));
    assert.deepEqual(readBlock(publish, "permissions"), ["actions: read", "contents: write"]);
    assert.deepEqual(WORKFLOW.filter(t => t.trim().startsWith("concurrency:")), []);
  });

  it("lets go of the lock after feed in a job that runs whatever happened once publish started, with contents: write alone", () => {
    const unlock = readJob("unlock").filter(t => t.trim().length > 0);
    const needs = unlock.find(t => t.startsWith("    needs: ")) ?? "";
    const condition = unlock.find(t => t.startsWith("    if: ")) ?? "";

    assert.ok(needs.includes("publish") && needs.includes("feed"), needs);
    assert.ok(condition.startsWith("    if: ${{ always() && needs.publish.result != 'skipped'"), condition);
    assert.deepEqual(readBlock(unlock, "permissions"), ["contents: write"]);
    assert.ok(unlock.at(-1)?.endsWith("release-command-line.js\" release-unlock"), unlock.at(-1) ?? "");
    assert.ok(readJob("feed").includes("    permissions: {}"));
  });
});
