/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { BuildCommandLine } from "@noldova/desktop.build";

import { TarballFixture } from "./tarball.fixture.js";

export class InstalledAppFixture implements AsyncDisposable {
  public static readonly ELECTRON: string = "@noldova/desktop.electron";
  public static readonly CLI: string = "@noldova/desktop.cli";
  public static readonly VERSION: string = "0.0.12";
  public static readonly UNREACHABLE_REGISTRY: string = "http://127.0.0.1:9";

  private static readonly ARCHIVES_FOLDER: string = "archives";
  private static readonly THIRD_PARTY_SEGMENTS: readonly string[] = ["_build", "package", "third-party"];
  private static readonly NOTICES_SEGMENTS: readonly string[] = ["_build", "package", "runtime-third-party.txt"];
  private static readonly CONFIGURATION_SEGMENTS: readonly string[] = ["_build", "package", "electron-builder.json"];
  private static readonly ELECTRON_VERSION: string = "41.0.0";

  public readonly path: string;
  private readonly installed: Record<string, Readonly<Record<string, unknown>>> = {};
  private readonly locked: Record<string, Readonly<Record<string, unknown>>> = { "": { name: "sample-app" } };

  private constructor(folder: string) {
    this.path = folder;
  }

  public static async createAsync(product: Readonly<Record<string, unknown>> = {}, withLicense: boolean = true, packaging: Readonly<Record<string, unknown>> | null = null):
    Promise<InstalledAppFixture> {
    const app = new InstalledAppFixture(await mkdtemp(path.join(tmpdir(), "desktop-build-")));
    await app.writeAsync(["package.json"], JSON.stringify({
      name: "sample-app",
      version: "1.2.3",
      desktop: {
        protocolVersion: 1,
        modules: [],
        product: {
          name: "Sample App",
          publisher: "Sample",
          slug: "sample-app",
          applicationId: "com.example.sample",
          developmentApplicationId: "com.example.sample.development",
          dataFolder: ".sample/app",
          deviceFolders: { windows: "Sample/App", macos: "Sample/App", linux: "sample/app" },
          dataDirectoryVariable: "SAMPLE_APP_DATA_DIR",
          icons: "assets/icons",
          releaseRepository: "example/sample-app",
          ...product
        },
        ...(Object.isNull(packaging) ? {} : { packaging })
      }
    }));
    if (withLicense)
      await app.writeAsync(["LICENSE"], "Sample license\n");
    await app.writeAsync(["assets", "icons", "icon-dark-512.png"], String.empty);
    await app.writeAsync(["assets", "dictionaries", "dictionaries.json"], "{}");
    await app.writeAsync(["node_modules", "electron", "package.json"], JSON.stringify({ name: "electron", version: InstalledAppFixture.ELECTRON_VERSION }));
    await app.writeLockfileAsync();
    await app.writeInstalledLockfileAsync();
    return app;
  }

  public async installAsync(name: string, resolved: string | null = null, dependencies: Readonly<Record<string, string>> = {},
    peerDependencies: Readonly<Record<string, string>> = {}): Promise<void> {
    const archive = `${name.slice(1).replace("/", "-")}-${InstalledAppFixture.VERSION}.tgz`;
    const peers = Object.keys(peerDependencies).length === 0 ? {} : { peerDependencies };
    const data = TarballFixture.create({ "package.json": JSON.stringify({ name, version: InstalledAppFixture.VERSION, dependencies, ...peers }) });
    await this.writeAsync([InstalledAppFixture.ARCHIVES_FOLDER, archive], data);
    await this.writeAsync(["node_modules", ...name.split("/"), "package.json"], JSON.stringify({ name, version: InstalledAppFixture.VERSION }));
    this.installed[`node_modules/${name}`] = {
      version: InstalledAppFixture.VERSION,
      resolved: resolved ?? `file:${InstalledAppFixture.ARCHIVES_FOLDER}/${archive}`,
      integrity: `sha512-${createHash("sha512").update(data).digest("base64")}`,
      dependencies,
      ...peers
    };
    await this.writeInstalledLockfileAsync();
  }

  public async lockAsync(name: string, peerDependencies: Readonly<Record<string, string>>): Promise<void> {
    this.locked[`node_modules/${name}`] = {
      version: "1.0.0",
      resolved: `${InstalledAppFixture.UNREACHABLE_REGISTRY}/${name}-1.0.0.tgz`,
      integrity: `sha512-${createHash("sha512").update(name).digest("base64")}`,
      peerDependencies
    };
    await this.writeLockfileAsync();
  }

  public async addThirdPartyAsync(name: string, license: string, files: Readonly<Record<string, string>>, dependencies: Readonly<Record<string, unknown>> = {},
    version: string = "1.0.0"): Promise<void> {
    await this.addThirdPartyTarballAsync(name, TarballFixture.create({ "package.json": JSON.stringify({ name, version, license, ...dependencies }), ...files }), dependencies, version);
  }

  public async addThirdPartyTarballAsync(name: string, tarball: Buffer, dependencies: Readonly<Record<string, unknown>> = {}, version: string = "1.0.0"): Promise<void> {
    const file = `${name.replace("/", "+")}-${version}.tgz`;
    await this.writeAsync([...InstalledAppFixture.THIRD_PARTY_SEGMENTS, file], tarball);
    this.locked[`node_modules/${name}`] = {
      version,
      resolved: `${InstalledAppFixture.UNREACHABLE_REGISTRY}/${file}`,
      integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
      ...dependencies
    };
    await this.writeLockfileAsync();
  }

  public async readThirdPartyNoticesAsync(): Promise<string | null> {
    const file = path.join(this.path, ...InstalledAppFixture.NOTICES_SEGMENTS);
    return existsSync(file) ? await readFile(file, "utf8") : null;
  }

  public async readConfigurationAsync(): Promise<JsonReader> {
    return JsonReader.parse(await readFile(path.join(this.path, ...InstalledAppFixture.CONFIGURATION_SEGMENTS), "utf8"));
  }

  public async writeAppFileAsync(file: string, text: string): Promise<string> {
    await this.writeAsync(file.split("/"), text);
    return path.join(this.path, ...file.split("/"));
  }

  public async removeArchiveAsync(name: string): Promise<void> {
    await rm(path.join(this.path, InstalledAppFixture.ARCHIVES_FOLDER, `${name.slice(1).replace("/", "-")}-${InstalledAppFixture.VERSION}.tgz`));
  }

  public async changeArchiveAsync(name: string): Promise<void> {
    await this.writeAsync([InstalledAppFixture.ARCHIVES_FOLDER, `${name.slice(1).replace("/", "-")}-${InstalledAppFixture.VERSION}.tgz`], "rebuilt archive");
  }

  public packageAsync(platform: string, packageArguments: readonly string[] = [], environment: NodeJS.ProcessEnv = {}): Promise<string> {
    return this.runAsync(platform, ["package", ...packageArguments], environment);
  }

  public async runAsync(platform: string, commandArguments: readonly string[], environment: NodeJS.ProcessEnv = {}): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    const exitCode = await new BuildCommandLine(this.path, environment, platform, "x64", output, new PassThrough()).runAsync(commandArguments);
    return `${exitCode} ${chunks.join(String.empty)}`;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }

  private async writeLockfileAsync(): Promise<void> {
    await this.writeAsync(["package-lock.json"], JSON.stringify({ name: "sample-app", lockfileVersion: 3, packages: this.locked }));
  }

  private async writeInstalledLockfileAsync(): Promise<void> {
    await this.writeAsync(["node_modules", ".package-lock.json"], JSON.stringify({ name: "sample-app", lockfileVersion: 3, packages: this.installed }));
  }

  private async writeAsync(segments: readonly string[], content: string | Buffer): Promise<void> {
    const file = path.join(this.path, ...segments);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
}
