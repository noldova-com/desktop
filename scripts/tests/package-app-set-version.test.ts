/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { WorkflowStepFixture } from "./fixtures/workflow-step.fixture.ts";

const FAKE: string = [
  "import { appendFileSync, writeFileSync } from \"node:fs\";",
  "import path from \"node:path\";",
  "const folder = path.dirname(import.meta.dirname);",
  "appendFileSync(path.join(folder, \"calls.txt\"), JSON.stringify(process.argv.slice(2)) + \"\\n\");",
  "const status = Number(process.env.FAKE_STATUS);",
  "if (status === 0)",
  "  writeFileSync(path.join(folder, \"app\", \"package.json\"), JSON.stringify({ name: \"app\", version: process.env.FAKE_WRITES }));",
  "process.exitCode = status;"
].join("\n");

async function runAsync(version: string, writes: string, status: number = 0): Promise<{ status: number | null, output: string, calls: string, manifest: string }> {
  const folder = await mkdtemp(path.join(tmpdir(), "set-version-"));
  try {
    const bin = path.join(folder, "bin");
    await mkdir(bin);
    await mkdir(path.join(folder, "app"));
    await writeFile(path.join(folder, "app", "package.json"), JSON.stringify({ name: "app", version: "1.2.3" }));
    await writeFile(path.join(bin, "npm.mjs"), FAKE);
    const command = path.join(bin, "npm");
    await writeFile(command, `#!/bin/sh\nexec "${toShell(process.execPath)}" "${toShell(path.join(bin, "npm.mjs"))}" "$@"\n`);
    await chmod(command, 0o755);
    await writeFile(path.join(folder, "calls.txt"), "");
    const result = await WorkflowStepFixture.runAsync(WorkflowStepFixture.readRun("package-app.yml", "Set the version"), folder, bin,
      { VERSION: version, APP_FOLDER: "app", FAKE_WRITES: writes, FAKE_STATUS: String(status) });
    return { ...result, calls: await readFile(path.join(folder, "calls.txt"), "utf8"), manifest: await readFile(path.join(folder, "app", "package.json"), "utf8") };
  }
  finally {
    await rm(folder, { recursive: true, force: true });
  }
}

function toShell(file: string): string {
  return file.split(path.sep).join("/");
}

describe("package-app.yml's set-version step", () => {
  it("runs the repository's set-version script with the release's version and passes once the app's manifest holds it", async () => {
    const result = await runAsync("1.2.4", "1.2.4");

    assert.equal(result.status, 0, result.output);
    assert.equal(result.calls, `${JSON.stringify(["run", "set-version", "--", "1.2.4"])}\n`);
    assert.equal(JSON.parse(result.manifest).version, "1.2.4");
  });

  it("fails naming the version the script left in the app's manifest", async () => {
    const result = await runAsync("1.2.4", "1.2.3");

    assert.equal(result.status, 1);
    assert.equal(result.output, "::error::npm run set-version left app/package.json at 1.2.3, not 1.2.4.\n");
  });

  it("fails with the script's own status when it fails, before reading the manifest", async () => {
    const result = await runAsync("1.2.4", "1.2.4", 3);

    assert.equal(result.status, 3);
    assert.equal(result.output, "");
    assert.equal(JSON.parse(result.manifest).version, "1.2.3");
  });
});
