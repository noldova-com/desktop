/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";

export class DevelopmentAppFixture implements AsyncDisposable {
  private static readonly RELABELLED_PLATFORM: string = "win32";
  private static readonly BUNDLELESS_PLATFORM: string = "linux";
  private static readonly ICON_FILES: readonly string[] = ["icon-dark.ico", "icon-dock-512.png"];
  private static readonly ENTRY_FOLDER: readonly string[] = ["node_modules", "@noldova", "desktop.cli", "services"];
  private static readonly LAUNCH_FILE: string = "launched.json";
  private static readonly ENTRY: string = `require("node:fs").writeFileSync(require("node:path").join(__dirname, "${DevelopmentAppFixture.LAUNCH_FILE}"), `
    + "JSON.stringify([Object.entries(process.env).filter(([name]) => name.endsWith(\"_CHECKOUT\")), process.argv.slice(2)]));\n";

  public readonly path: string;
  public readonly name: string;
  public readonly platform: string;

  private constructor(folder: string, name: string, platform: string) {
    this.path = folder;
    this.name = name;
    this.platform = platform;
  }

  public static async createAsync(name: string | null, slug: string | null): Promise<DevelopmentAppFixture> {
    const ownProduct = JsonReader.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")).readObject("desktop").readObject("product").toJson();
    const product = { ...ownProduct, name: name ?? ownProduct["name"], slug: slug ?? ownProduct["slug"] };
    const isRelabelled = process.platform === DevelopmentAppFixture.RELABELLED_PLATFORM;
    const folder = realpathSync(await mkdtemp(path.join(tmpdir(), "desktop-tools-")));
    const app = new DevelopmentAppFixture(folder, String(product.name), isRelabelled ? DevelopmentAppFixture.RELABELLED_PLATFORM : DevelopmentAppFixture.BUNDLELESS_PLATFORM);
    await app.writeAsync(["package.json"], JSON.stringify({ name: "development-app", version: "0.0.1", private: true, desktop: { product } }));
    const icons = path.join(app.path, String(ownProduct["icons"]));
    await mkdir(icons, { recursive: true });
    for (const file of DevelopmentAppFixture.ICON_FILES)
      await copyFile(path.join(process.cwd(), "assets", "icons", file), path.join(icons, file));
    await app.writeAsync(["node_modules", "electron", "package.json"], JSON.stringify({ name: "electron", version: "0.0.1" }));
    const distribution = path.join(app.path, "node_modules", "electron", "dist");
    await mkdir(distribution, { recursive: true });
    if (isRelabelled)
      await copyFile(process.execPath, path.join(distribution, "electron.exe"));
    else
      await symlink(process.execPath, path.join(distribution, "electron"));
    await app.writeAsync([...DevelopmentAppFixture.ENTRY_FOLDER, "cli-entry.js"], DevelopmentAppFixture.ENTRY);
    return app;
  }

  public async readLaunchAsync(): Promise<string> {
    const file = path.join(this.path, ...DevelopmentAppFixture.ENTRY_FOLDER, DevelopmentAppFixture.LAUNCH_FILE);
    return existsSync(file) ? await readFile(file, "utf8") : "not launched";
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }

  private async writeAsync(segments: readonly string[], text: string): Promise<void> {
    const file = path.join(this.path, ...segments);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
}
