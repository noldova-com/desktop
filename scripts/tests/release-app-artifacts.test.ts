/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { WorkflowStepFixture } from "./fixtures/workflow-step.fixture.ts";

interface IKeep {
  readonly withRevision: number;
  readonly withoutRevision: number;
}

const WORKFLOWS: string = path.resolve(import.meta.dirname, "..", "..", ".github", "workflows");
const DOWNLOAD: string = "uses: actions/download-artifact@";
const UPLOAD: string = "uses: actions/upload-artifact@";
const TAKE_ALIAS: string = "- *take";
const DECIDED: Readonly<Record<string, IKeep>> = {
  "desktop.build": { withRevision: 35, withoutRevision: 35 },
  "release-*": { withRevision: 14, withoutRevision: 1 },
  "report-*": { withRevision: 14, withoutRevision: 1 }
};

function readLines(workflow: string): readonly string[] {
  return readFileSync(path.join(WORKFLOWS, workflow), "utf8").split(/\r?\n/);
}

function readJob(lines: readonly string[], job: string): readonly string[] {
  const start = lines.indexOf(`  ${job}:`);
  assert.ok(start >= 0, `release-app.yml has no ${job} job.`);
  const end = lines.findIndex((t, index) => index > start && /^ {2}\S/.test(t));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
}

function readWith(lines: readonly string[], index: number, key: string): string | null {
  for (let next = index + 1; next < lines.length && !(lines[next] ?? "").trimStart().startsWith("- "); next++) {
    const match = new RegExp(`^\\s+${key}: (.+)$`).exec(lines[next] ?? "");
    if (match !== null)
      return match[1] ?? null;
  }
  return null;
}

function listDownloads(job: string): readonly string[] {
  const lines = readJob(readLines("release-app.yml"), job);
  const downloads: string[] = [];
  lines.forEach((t, index) => {
    if (t.trim() === TAKE_ALIAS)
      downloads.push("desktop.build");
    else if (t.includes(DOWNLOAD))
      downloads.push(readWith(lines, index, "name") ?? readWith(lines, index, "pattern") ?? "");
  });
  return downloads;
}

function readKeep(value: string, anchors: ReadonlyMap<string, string>): IKeep {
  const resolved = value.startsWith("*") ? anchors.get(value.slice(1)) ?? value : value.replace(/^&\S+ /, "");
  const fixed = /^(\d+)$/.exec(resolved);
  if (fixed !== null)
    return { withRevision: Number(fixed[1]), withoutRevision: Number(fixed[1]) };
  const chosen = /^\$\{\{ inputs\.revision == '' && (\d+) \|\| (\d+) \}\}$/.exec(resolved);
  assert.ok(chosen !== null, `A retention-days value reads ${resolved}.`);
  return { withRevision: Number(chosen[2]), withoutRevision: Number(chosen[1]) };
}

function listUploads(): readonly (readonly [string, IKeep | null])[] {
  const uploads: (readonly [string, IKeep | null])[] = [];
  for (const workflow of ["release-app.yml", "package-app.yml"]) {
    const lines = readLines(workflow);
    const anchors = new Map<string, string>();
    for (const line of lines) {
      const anchor = /retention-days: &(\S+) (.+)$/.exec(line);
      if (anchor !== null)
        anchors.set(anchor[1] ?? "", anchor[2] ?? "");
    }
    lines.forEach((t, index) => {
      if (!t.includes(UPLOAD))
        return;
      const name = readWith(lines, index, "name") ?? "";
      const retention = readWith(lines, index, "retention-days");
      uploads.push([name, retention === null ? null : readKeep(retention, anchors)]);
    });
  }
  return uploads;
}

function matches(download: string, upload: string): boolean {
  return download.endsWith("*") ? upload.startsWith(download.slice(0, -1)) : upload === download;
}

async function checkKeptAsync(targets: string, kept: readonly string[]): Promise<{ status: number | null, output: string }> {
  const folder = await mkdtemp(path.join(tmpdir(), "release-kept-"));
  try {
    for (const target of kept)
      await mkdir(path.join(folder, "_build", "release-reports", `report-${target}`), { recursive: true });
    return await WorkflowStepFixture.runAsync(WorkflowStepFixture.readRun("release-app.yml", "Check that this run's release files are still kept"), folder, folder,
      { RELEASE_TARGETS: targets });
  }
  finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe("release-app.yml's artifacts", () => {
  it("keeps each artifact the publish, internal, feed and unlock jobs take for its decided days, with a revision and without", () => {
    const uploads = listUploads();
    for (const job of ["publish", "internal", "feed", "unlock"]) {
      const downloads = listDownloads(job);
      assert.ok(downloads.length > 0, `The ${job} job takes no artifact.`);
      for (const download of downloads) {
        const decided = DECIDED[download];
        assert.ok(decided !== undefined, `The ${job} job takes ${download}, which has no decided keep.`);
        const kept = uploads.filter(([name]) => matches(download, name));
        assert.ok(kept.length > 0, `Nothing uploads ${download}, which the ${job} job takes.`);
        for (const [name, keep] of kept)
          assert.deepEqual(keep, decided, `${name}, which the ${job} job takes.`);
      }
    }
  });

  it("lets publish go on when every target's release files are still kept", async () => {
    const result = await checkKeptAsync("linux-x64,windows-x64", ["linux-x64", "windows-x64"]);

    assert.equal(result.status, 0, result.output);
    assert.equal(result.output, "");
  });

  it("fails publish naming each target whose release files expired", async () => {
    const result = await checkKeptAsync("linux-x64,windows-x64,macos-arm64", ["windows-x64"]);

    assert.equal(result.status, 1);
    assert.equal(result.output, "::error::The release files expired after 14 days, so this run has none for linux-x64, macos-arm64; start a new release with a new version.\n");
  });
});
