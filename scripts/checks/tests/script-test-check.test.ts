/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";

import { Resources } from "../../resources.ts";
import { ScriptTestCheck } from "../script-test-check.ts";
import { RecordingRunner } from "./fixtures/recording-runner.ts";

const ROOT = "/repository";
const REPOSITORY = path.resolve(import.meta.dirname, "..", "..", "..");

describe("ScriptTestCheck", () => {
  it("runs every script test when it names no file", async () => {
    const runner = new RecordingRunner();

    assert.equal(await new ScriptTestCheck(ROOT, runner).runAsync(new PassThrough()), true);

    assert.deepEqual(runner.calls, [[process.execPath, ...Resources.scriptTestOptions, ...Resources.scriptTestFiles, ROOT]]);
  });

  it("runs only the files it names, with the same options", async () => {
    const runner = new RecordingRunner();

    assert.equal(await new ScriptTestCheck(REPOSITORY, runner, ["scripts/tests/ui-workflows-ci.test.ts"]).runAsync(new PassThrough()), true);

    assert.deepEqual(runner.calls, [[process.execPath, "--test", "--test-timeout=10000", "scripts/tests/ui-workflows-ci.test.ts", REPOSITORY]]);
  });

  it("refuses a named file that is missing among existing ones, naming it, before any test runs", async () => {
    const runner = new RecordingRunner();
    const chunks: string[] = [];
    const output = new PassThrough();
    output.on("data", (t: Buffer) => chunks.push(t.toString()));

    assert.equal(await new ScriptTestCheck(REPOSITORY, runner, ["scripts/tests/ui-workflows-ci.test.ts", "scripts/tests/session-bsu.test.ts"]).runAsync(output), false);

    assert.deepEqual(runner.calls, []);
    assert.equal(chunks.join(""), `scripts names scripts/tests/session-bsu.test.ts, which is not a file under the repository's root, so no script test ran.${Resources.lineEnd}`);
  });
});
