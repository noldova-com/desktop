/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";

import { FolderFixture } from "./folder.fixture.js";

export class AppFolderFixture implements AsyncDisposable {
  private static readonly BROWSER_MARKER: string = "browser-installed";
  private static readonly INSTALL_RECORD: readonly string[] = ["node_modules", ".noldova-install"];
  private static readonly SCRIPT: string = `require("node:fs").writeFileSync("${AppFolderFixture.BROWSER_MARKER}", "");\n`;
  private static readonly NPM_FILE: string = "npm.mjs";
  private static readonly LISTING_FILE: string = "npm-ls.json";
  private static readonly NPM_SCRIPT: string = [
    "import { existsSync, readFileSync } from 'node:fs';",
    "import path from 'node:path';",
    "const listing = path.join(path.dirname(process.argv[1]), 'npm-ls.json');",
    "process.stdout.write(existsSync(listing) ? readFileSync(listing, 'utf8') : '{\"name\":\"app\"}');"
  ].join("\n");

  public readonly path: string;
  public readonly windowApp: string;

  private constructor(folder: string) {
    this.path = folder;
    this.windowApp = path.join(folder, "src", "app.window.app");
  }

  public get environment(): NodeJS.ProcessEnv {
    return { npm_execpath: path.join(this.path, AppFolderFixture.NPM_FILE) };
  }

  public get hasInstalledBrowser(): boolean {
    return existsSync(path.join(this.path, AppFolderFixture.BROWSER_MARKER));
  }

  public static async createAsync(hasTestTarget: boolean, locked: readonly string[], installed: readonly string[], rootPackages: readonly string[] = []): Promise<AppFolderFixture> {
    const app = new AppFolderFixture(await mkdtemp(path.join(tmpdir(), "desktop-build-")));
    const architect = hasTestTarget ? { build: {}, test: {} } : { build: {} };
    await mkdir(app.windowApp, { recursive: true });
    await writeFile(path.join(app.windowApp, "angular.json"), JSON.stringify({ projects: { app: { architect } } }));
    await app.writeAsync(["package-lock.json"], JSON.stringify({ packages: Object.fromEntries(locked.map(t => [`node_modules/${t}`, { version: "0.0.3" }])) }));
    await writeFile(path.join(app.path, AppFolderFixture.NPM_FILE), AppFolderFixture.NPM_SCRIPT);
    await app.writeAsync(["node_modules", "@angular", "cli", "bin", "ng.js"], String.empty);
    await app.writeAsync(["node_modules", "playwright", "cli.js"], AppFolderFixture.SCRIPT);
    for (const name of installed)
      await app.writeAsync(["node_modules", ...name.split("/"), "package.json"], JSON.stringify({ name, version: "0.0.3", peerDependencies: { "@angular/core": "22.2.6" } }));
    for (const name of rootPackages)
      await app.writeAsync(["node_modules", ...name.split("/"), "package.json"], JSON.stringify({ name, version: "0.0.3" }));
    const lockfile = await readFile(path.join(app.path, "package-lock.json"));
    await app.writeAsync(AppFolderFixture.INSTALL_RECORD, `${process.platform} ${process.arch} ${createHash("sha256").update(lockfile).digest("hex")}\n`);
    return app;
  }

  public async listCopiesAsync(listing: unknown): Promise<void> {
    await writeFile(path.join(this.path, AppFolderFixture.LISTING_FILE), JSON.stringify(listing));
  }

  public async changeLockfileAsync(): Promise<void> {
    await writeFile(path.join(this.path, "package-lock.json"), JSON.stringify({ packages: {} }));
  }

  public async uninstallAsync(): Promise<void> {
    await rm(path.join(this.path, ...AppFolderFixture.INSTALL_RECORD));
    await rm(path.join(this.path, "node_modules", "@angular"), { recursive: true });
  }

  public async addWindowAppAsync(folder: string): Promise<void> {
    await mkdir(path.join(this.path, "src", folder), { recursive: true });
    await writeFile(path.join(this.path, "src", folder, "angular.json"), JSON.stringify({ projects: { app: { architect: { build: {} } } } }));
  }

  public async moveProjectToSourceAsync(): Promise<void> {
    await rename(path.join(this.windowApp, "angular.json"), path.join(this.path, "src", "angular.json"));
    await rm(this.windowApp, { recursive: true });
  }

  public isInstalled(name: string): boolean {
    return existsSync(path.join(this.path, "node_modules", ...name.split("/")));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }

  private async writeAsync(segments: readonly string[], text: string): Promise<void> {
    const file = path.join(this.path, ...segments);
    await FolderFixture.ensureAsync(path.dirname(file));
    await writeFile(file, text);
  }
}
