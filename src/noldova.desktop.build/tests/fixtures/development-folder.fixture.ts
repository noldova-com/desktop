/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpathSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { NtExecutable, NtExecutableResource, Resource } from "resedit";

export class DevelopmentFolderFixture implements AsyncDisposable {
  public static readonly PRODUCT: Readonly<Record<string, unknown>> = {
    name: "Sample App",
    publisher: "Sample",
    slug: "sample-app",
    applicationId: "com.example.sample",
    developmentApplicationId: "com.example.sample.development",
    dataFolder: ".sample/app",
    deviceFolders: { windows: "Sample/App", macos: "Sample/App", linux: "sample/app" },
    dataDirectoryVariable: "SAMPLE_APP_DATA_DIR",
    icons: "assets/icons",
    releaseRepository: "example/sample-app"
  };

  private static readonly ICON_FILES: readonly string[] = ["icon-dark.ico", "icon-dock-512.png"];
  private static readonly ENGLISH: number = 1033;
  private static readonly UNICODE: number = 1200;

  public readonly path: string;

  private constructor(folder: string) {
    this.path = folder;
  }

  public get distribution(): string {
    return path.join(this.path, "node_modules", "electron", "dist");
  }

  public get output(): string {
    return path.join(this.path, "_build", "development-app");
  }

  public static async createAsync(): Promise<DevelopmentFolderFixture> {
    const folder = new DevelopmentFolderFixture(realpathSync(await mkdtemp(path.join(tmpdir(), "desktop-development-"))));
    await folder.writeAsync(["package.json"], JSON.stringify({
      name: "sample-app", version: "1.2.3", desktop: { protocolVersion: 1, modules: [], product: DevelopmentFolderFixture.PRODUCT }
    }));
    await folder.writeAsync(["node_modules", "electron", "package.json"], JSON.stringify({ name: "electron", version: "44.9.1" }));
    await mkdir(path.join(folder.path, "assets", "icons"), { recursive: true });
    for (const file of DevelopmentFolderFixture.ICON_FILES)
      await copyFile(path.join(process.cwd(), "assets", "icons", file), path.join(folder.path, "assets", "icons", file));
    return folder;
  }

  public static createWindowsExecutable(hasVersion: boolean): Buffer {
    const executable = NtExecutable.createEmpty();
    const resource = NtExecutableResource.from(executable);
    if (hasVersion) {
      const info = Resource.VersionInfo.createEmpty();
      info.setStringValues({ lang: DevelopmentFolderFixture.ENGLISH, codepage: DevelopmentFolderFixture.UNICODE }, { ProductName: "Electron", CompanyName: "Electron" });
      info.outputToResourceEntries(resource.entries);
    }
    resource.outputResource(executable);
    return Buffer.from(executable.generate());
  }

  public static readWindowsStrings(bytes: Buffer): Readonly<Record<string, string>> {
    const [info] = Resource.VersionInfo.fromEntries(NtExecutableResource.from(NtExecutable.from(bytes, { ignoreCert: true })).entries);
    return info?.getStringValues({ lang: DevelopmentFolderFixture.ENGLISH, codepage: DevelopmentFolderFixture.UNICODE }) ?? {};
  }

  public async writeLinuxDistributionAsync(): Promise<void> {
    await this.writeAsync(["node_modules", "electron", "dist", "electron"], "electron");
  }

  public async writeWindowsDistributionAsync(hasVersion: boolean): Promise<void> {
    await this.writeAsync(["node_modules", "electron", "dist", "electron.exe"], DevelopmentFolderFixture.createWindowsExecutable(hasVersion));
  }

  public async writeMacDistributionAsync(): Promise<void> {
    const bundle = ["node_modules", "electron", "dist", "Electron.app", "Contents"];
    await this.writeAsync([...bundle, "MacOS", "Electron"], "electron");
    await this.writeAsync([...bundle, "Info.plist"], "<plist/>");
    await this.writeAsync([...bundle, "Resources", "electron.icns"], "icon");
    await this.writeAsync([...bundle, "Frameworks", "Electron Helper.app", "Contents", "MacOS", "Electron Helper"], "helper");
    await this.writeAsync([...bundle, "Frameworks", "Electron Helper (GPU).app", "Contents", "MacOS", "Electron Helper (GPU)"], "helper");
    await this.writeAsync([...bundle, "Frameworks", "Electron Framework.framework", "Electron Framework"], "framework");
  }

  public async writeAsync(segments: readonly string[], content: string | Buffer): Promise<string> {
    const file = path.join(this.path, ...segments);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    return file;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
