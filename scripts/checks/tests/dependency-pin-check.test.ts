/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { ProcessRunner } from "../../../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { Git } from "../../../src/noldova.desktop.build/src/services/repository/git.ts";
import { RepositoryFiles } from "../../structure/repository-files.ts";
import { DependencyPinCheck } from "../dependency-pin-check.ts";
import { DependencyPinCheckResources } from "../dependency-pin-check.resources.ts";

const WINDOW_FILE = "src/noldova.desktop.window/package.json";
const FIXTURE_FILE = "src/noldova.desktop.electron/tests/e2e/fixtures/modules/packages/beacon.window/package.json";
const PROTOCOL = "@noldova/desktop.protocol";
const WINDOW = "@noldova/desktop.window";
const RANGE = ">=__VERSION__ <__NEXT_MINOR__";

async function checkAsync(windowPeer: string, fixturePeer: string): Promise<{ passed: boolean; output: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "dependency-pin-check-"));
  try {
    const manifests: readonly (readonly [string, string, string, string])[] = [
      [WINDOW_FILE, WINDOW, PROTOCOL, windowPeer],
      [FIXTURE_FILE, "@noldova/desktop.fixture.packages.beacon.window", WINDOW, fixturePeer]
    ];
    for (const [file, name, peer, version] of manifests) {
      await mkdir(path.join(root, path.dirname(file)), { recursive: true });
      await writeFile(path.join(root, file), JSON.stringify({ name, version: "__VERSION__", peerDependencies: { [peer]: version } }));
    }
    const git = new Git(root, new ProcessRunner());
    await git.readOutputAsync(["init", "--quiet"]);
    const chunks: string[] = [];
    const output = new PassThrough();
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const passed = await new DependencyPinCheck(root, new RepositoryFiles(root, git)).runAsync(output);
    return { passed, output: chunks.join("") };
  }
  finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("DependencyPinCheck", () => {
  it("accepts a peer between two of Noldova Desktop's packages at the range the build stamps, and a fixture module's peer at the version", async () => {
    const result = await checkAsync(RANGE, "__VERSION__");

    assert.equal(result.passed, true, result.output);
  });

  for (const peer of ["__VERSION__", "0.0.21", ">=__VERSION__ <0.1.0", "^0.0.1"])
    it(`refuses a peer between two of Noldova Desktop's packages at "${peer}"`, async () => {
      const result = await checkAsync(peer, "__VERSION__");

      assert.equal(result.passed, false);
      assert.ok(result.output.includes(DependencyPinCheckResources.formatOwnPeer(WINDOW_FILE, PROTOCOL, peer, RANGE)), result.output);
    });

  it("refuses the range on a fixture module's peer on Noldova Desktop's packages", async () => {
    const result = await checkAsync(RANGE, RANGE);

    assert.equal(result.passed, false);
    assert.ok(result.output.includes(DependencyPinCheckResources.formatOwnVersion(FIXTURE_FILE, DependencyPinCheckResources.peerSection, WINDOW, RANGE)), result.output);
  });
});
