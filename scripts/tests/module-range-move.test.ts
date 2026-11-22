/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ModuleRangeFolderFixture } from "./fixtures/module-range-folder.fixture.ts";

const IS_POSIX = process.platform !== "win32";
const FLAGS = ["--no-save", "--no-audit", "--no-fund", "--ignore-scripts"];
const FIELDS = { "@noldova/desktop.runtime": { dependencies: {}, peerDependencies: { "@noldova/context.core": ">=0.0.7 <0.1.0" } } };

function locked(name: string, version: string, extra: object = {}): object {
  return { version, resolved: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1) ?? name}-${version}.tgz`, dev: true, ...extra };
}

function installed(folder: string, packages: Readonly<Record<string, string>>): Readonly<Record<string, object>> {
  return Object.fromEntries(Object.entries(packages).map(([name, version]) => [`${folder}node_modules/${name}/package.json`, { name, version }]));
}

const ROOT = {
  "package.json": { name: "@example/notes", devDependencies: { "@noldova/desktop.runtime": "0.0.10", "@noldova/context.core": "0.0.10", "@noldova/context.text": "0.0.10" } },
  "package-lock.json": {
    name: "@example/notes",
    lockfileVersion: 3,
    packages: {
      "": { name: "@example/notes" },
      "node_modules/@noldova/desktop.runtime": locked("@noldova/desktop.runtime", "0.0.10"),
      "node_modules/@noldova/context.core": locked("@noldova/context.core", "0.0.10"),
      "node_modules/@noldova/context.text": locked("@noldova/context.text", "0.0.10"),
      "node_modules/@noldova/context.collections": locked("@noldova/context.collections", "0.0.10", { peer: true }),
      "node_modules/@noldova/context.text/node_modules/nested": locked("nested", "1.0.0"),
      "node_modules/string-width-cjs": locked("string-width", "4.2.3", { name: "string-width" }),
      "node_modules/from-git": { version: "1.0.0", resolved: "git+ssh://git@github.com/example/from-git.git#0123456789abcdef", dev: true },
      "node_modules/from-url": { version: "1.0.0", resolved: "https://example.com/from-url-1.0.0.tgz", dev: true },
      "node_modules/linked": { resolved: "../linked", link: true },
      "node_modules/@esbuild/darwin-arm64": locked("@esbuild/darwin-arm64", "0.20.0", { optional: true, os: ["darwin"] })
    }
  },
  ...installed("", { "@noldova/desktop.runtime": "0.0.10", "@noldova/context.core": "0.0.10", "@noldova/context.text": "0.0.10", "@noldova/context.collections": "0.0.10",
    "string-width-cjs": "4.2.3", "from-git": "1.0.0", "from-url": "1.0.0" })
};

const WORKSPACE = {
  "package.json": { name: "@example/root", private: true, workspaces: ["packages/notes"] },
  "packages/notes/package.json": { name: "@example/notes", devDependencies: { "@noldova/desktop.runtime": "0.0.10" } },
  "package-lock.json": {
    name: "@example/root",
    lockfileVersion: 3,
    packages: {
      "": { name: "@example/root", workspaces: ["packages/notes"] },
      "node_modules/@example/notes": { resolved: "packages/notes", link: true },
      "node_modules/@noldova/desktop.runtime": locked("@noldova/desktop.runtime", "0.0.10"),
      "packages/notes": { name: "@example/notes", devDependencies: { "@noldova/desktop.runtime": "0.0.10" } },
      "packages/notes/node_modules/@noldova/context.collections": locked("@noldova/context.collections", "0.0.10", { peer: true })
    }
  },
  ...installed("", { "@noldova/desktop.runtime": "0.0.10" }),
  ...installed("packages/notes/", { "@noldova/context.collections": "0.0.10" })
};

describe("module-range.yml's move step", { skip: !IS_POSIX }, () => {
  it("keeps a peer the lockfile holds at its locked version when the registry has published a newer one, and names only registry copies by their own names", async () => {
    await using folder = await ModuleRangeFolderFixture.createAsync(ROOT, { fields: FIELDS, newest: { "@noldova/context.collections": "0.0.11" }, forced: {} });

    const result = await folder.runAsync("0.0.11");

    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await folder.readInstallsAsync(), [JSON.stringify([".", ...FLAGS, "@noldova/desktop.runtime@0.0.11", "@noldova/context.collections@0.0.10",
      "@noldova/context.core@0.0.10", "@noldova/context.text@0.0.10"])]);
    assert.equal(await folder.readVersionAsync("@noldova/context.collections"), "0.0.10");
    assert.equal(await folder.readVersionAsync("@noldova/desktop.runtime"), "0.0.11");
  });

  it("keeps the packages the root lockfile holds under a workspace's own folder at their locked versions", async () => {
    await using folder = await ModuleRangeFolderFixture.createAsync(WORKSPACE, { fields: FIELDS, newest: { "@noldova/context.collections": "0.0.11" }, forced: {} });

    const result = await folder.runAsync("0.0.11");

    assert.equal(result.status, 0, result.output);
    assert.deepEqual(await folder.readInstallsAsync(), [JSON.stringify(["packages/notes", ...FLAGS, "@noldova/desktop.runtime@0.0.11",
      "@noldova/context.collections@0.0.10"])]);
    assert.equal(await folder.readVersionAsync("@noldova/context.collections", "packages/notes"), "0.0.10");
  });

  it("fails naming a locked package the install moved anyway", async () => {
    await using folder = await ModuleRangeFolderFixture.createAsync(ROOT, { fields: FIELDS, newest: {}, forced: { "@noldova/context.core": "0.0.12" } });

    const result = await folder.runAsync("0.0.11");

    assert.equal(result.status, 1);
    assert.ok(result.output.includes("::error::. holds @noldova/context.core 0.0.12 after the move, not 0.0.10, the version it asked for or its lockfile holds."),
      result.output);
  });
});
