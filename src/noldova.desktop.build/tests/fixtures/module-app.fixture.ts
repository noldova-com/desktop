/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { BuildCommandLine } from "@noldova/desktop.build";

import { FolderFixture } from "./folder.fixture.js";
import { TarballFixture } from "./tarball.fixture.js";

export class ModuleAppFixture implements AsyncDisposable {
  public static readonly MODULE_PACKAGE: string = "@noldova/sample";
  public static readonly WINDOW_PACKAGE: string = "@noldova/sample.window";
  public static readonly RUNTIME_PACKAGE: string = "@noldova/sample-runtime";
  public static readonly PROTOCOL_PACKAGE: string = "@noldova/sample-protocol";
  public static readonly LOCKED_PACKAGE: string = "@noldova/sample-format";
  public static readonly RUNTIME: string = "@noldova/desktop.runtime";
  public static readonly WINDOW: string = "@noldova/desktop.window";
  public static readonly WINDOW_APP: readonly string[] = ["src", "app.window.app"];
  public static readonly NEEDED: string = "0.0.4";
  public static readonly BUILT_PART: string = "@noldova/desktop.clock.runtime";
  public static readonly BUILT_WINDOW_PART: string = "@noldova/desktop.clock.window";
  public static readonly SETTING: string = "sample.defaultModel";
  public static readonly BUILT_VERSION: string = "0.0.2";
  public static readonly INSTALLED_VERSION: string = "0.0.1";
  public static readonly MODULE_VERSION: string = "0.0.1";
  public static readonly THIRD_PARTY: string = "sample-dependency";
  public static readonly THIRD_PARTY_VERSION: string = "1.0.0";
  public static readonly UNREACHABLE_REGISTRY: string = "http://127.0.0.1:9";
  public static readonly LONG_FILE: string = `assets/${"nested-folder/".repeat(8)}window-part.js`;
  public static readonly ANGULAR_CORE: string = "@angular/core";
  public static readonly ANGULAR_VERSION: string = "22.2.1";

  private static readonly ELECTRON: string = "@noldova/desktop.electron";
  private static readonly CLI: string = "@noldova/desktop.cli";
  private static readonly ELECTRON_VERSION: string = "41.0.0";
  private static readonly ROOT_INPUTS: readonly string[] = ["package-lock.json", "tsconfig-base.json"];
  private static readonly NPM_FILE: string = "npm.mjs";
  private static readonly NPM_LOG_FILE: string = "npm.log";
  private static readonly NPM_PACK_LOG_FILE: string = "npm-pack.log";
  private static readonly NPM_SCRIPT: readonly string[] = [
    "import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
    "import path from 'node:path';",
    "const [command, ...rest] = process.argv.slice(2);",
    "if (process.argv[2] === 'ls') {",
    "  process.stdout.write('{}');",
    "  process.exit(0);",
    "}",
    "if (command === 'pack') {",
    "  const manifest = readFileSync(path.join(rest.at(-1), 'package.json'), 'utf8');",
    "  const { name, version } = JSON.parse(manifest);",
    "  const archive = name.replace('@', '').replace('/', '-') + '-' + version + '.tgz';",
    "  writeFileSync(path.join(rest.at(-2), archive), manifest);",
    `  appendFileSync(path.join(path.dirname(process.argv[1]), '${ModuleAppFixture.NPM_PACK_LOG_FILE}'), archive + '\\n');`,
    "}",
    "else {",
    "  const archives = rest.filter(t => t.endsWith('.tgz'));",
    "  for (const archive of archives.filter(t => readFileSync(t, 'utf8').startsWith('{'))) {",
    "    const manifest = readFileSync(archive, 'utf8');",
    "    const folder = path.join('node_modules', ...JSON.parse(manifest).name.split('/'));",
    "    mkdirSync(folder, { recursive: true });",
    "    writeFileSync(path.join(folder, 'package.json'), manifest);",
    "  }",
    "  const installedLockfile = path.join('node_modules', '.package-lock.json');",
    "  if (existsSync('package-lock.json') && !existsSync(installedLockfile)) {",
    "    const { '': root, ...packages } = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages ?? {};",
    "    mkdirSync('node_modules', { recursive: true });",
    "    writeFileSync(installedLockfile, JSON.stringify({ name: 'app', lockfileVersion: 3, packages }));",
    "  }",
    `  appendFileSync(path.join(path.dirname(process.argv[1]), '${ModuleAppFixture.NPM_LOG_FILE}'), JSON.stringify({ archives: archives.map(t => path.basename(t)) }) + '\\n');`,
    "}"
  ];

  public readonly path: string;

  private constructor(folder: string) {
    this.path = folder;
  }

  public static async createAsync(runtimeVersion: string, windowVersion: string, hasBuiltPeer: boolean = false): Promise<ModuleAppFixture> {
    const app = new ModuleAppFixture(await mkdtemp(path.join(tmpdir(), "desktop-build-modules-")));
    const optional = { optional: true };
    await app.writeJsonAsync(["package.json"], {
      name: "app",
      version: ModuleAppFixture.NEEDED,
      private: true,
      desktop: { modules: [{ id: "sample", package: ModuleAppFixture.MODULE_PACKAGE }] },
      dependencies: { [ModuleAppFixture.MODULE_PACKAGE]: ModuleAppFixture.MODULE_VERSION, [ModuleAppFixture.RUNTIME]: runtimeVersion }
    });
    for (const file of ModuleAppFixture.ROOT_INPUTS)
      await app.writeJsonAsync([file], {});
    await app.writePackageAsync([], ModuleAppFixture.RUNTIME, { version: runtimeVersion });
    await app.writePackageAsync([], ModuleAppFixture.MODULE_PACKAGE, {
      version: ModuleAppFixture.MODULE_VERSION,
      exports: { "./runtime": "./runtime.js", "./window": "./window.js" },
      dependencies: { [ModuleAppFixture.RUNTIME_PACKAGE]: ModuleAppFixture.MODULE_VERSION, [ModuleAppFixture.WINDOW_PACKAGE]: ModuleAppFixture.MODULE_VERSION },
      peerDependencies: {
        [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED,
        ...hasBuiltPeer ? { [ModuleAppFixture.BUILT_PART]: ModuleAppFixture.BUILT_VERSION } : {}
      }
    });
    await app.writeAsync(["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/"), "window.js"], `export { windowPart } from "${ModuleAppFixture.WINDOW_PACKAGE}";\n`);
    if (hasBuiltPeer)
      await app.writeBuiltModuleAsync();
    await app.writeJsonAsync(["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/"), "module.json"], {
      id: "sample",
      version: ModuleAppFixture.MODULE_VERSION,
      displayName: "Sample",
      description: "A module an app installs from a package, with a window part.",
      parts: ["runtime", "window"],
      dependencies: {},
      contributes: {}
    });
    await app.writePackageAsync([], ModuleAppFixture.RUNTIME_PACKAGE, {
      version: ModuleAppFixture.MODULE_VERSION,
      dependencies: { [ModuleAppFixture.PROTOCOL_PACKAGE]: ModuleAppFixture.MODULE_VERSION },
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED }
    });
    await app.writePackageAsync([], ModuleAppFixture.PROTOCOL_PACKAGE, {
      version: ModuleAppFixture.MODULE_VERSION,
      dependencies: { [ModuleAppFixture.LOCKED_PACKAGE]: ModuleAppFixture.MODULE_VERSION }
    });
    await app.writePackageAsync([], ModuleAppFixture.LOCKED_PACKAGE, { version: ModuleAppFixture.MODULE_VERSION });
    await app.writePackageAsync([], ModuleAppFixture.WINDOW_PACKAGE, {
      version: ModuleAppFixture.MODULE_VERSION,
      dependencies: { [ModuleAppFixture.PROTOCOL_PACKAGE]: ModuleAppFixture.MODULE_VERSION },
      peerDependencies: {
        [ModuleAppFixture.ANGULAR_CORE]: ModuleAppFixture.ANGULAR_VERSION,
        ...hasBuiltPeer ? { [ModuleAppFixture.BUILT_WINDOW_PART]: ModuleAppFixture.BUILT_VERSION } : {},
        [ModuleAppFixture.WINDOW]: ModuleAppFixture.NEEDED
      },
      peerDependenciesMeta: { [ModuleAppFixture.ANGULAR_CORE]: optional, [ModuleAppFixture.WINDOW]: optional }
    });
    await app.writeJsonAsync([...ModuleAppFixture.WINDOW_APP, "angular.json"], { projects: { app: { architect: { build: {} } } } });
    await app.writeJsonAsync([...ModuleAppFixture.WINDOW_APP, "package.json"], { name: "app-window", private: true, dependencies: { [ModuleAppFixture.WINDOW]: windowVersion } });
    await app.writeJsonAsync([...ModuleAppFixture.WINDOW_APP, "tsconfig.json"], {});
    await app.writeAsync(["node_modules", "@angular", "cli", "bin", "ng.js"], String.empty);
    await app.writePackageAsync([], ModuleAppFixture.ANGULAR_CORE, { version: ModuleAppFixture.ANGULAR_VERSION });
    await app.writePackageAsync([], ModuleAppFixture.WINDOW, { version: windowVersion });
    await app.writeLockAsync({});
    return app;
  }

  public async writeProductAsync(fields: Readonly<Record<string, unknown>> = {}): Promise<void> {
    const manifest = await this.readJsonAsync(["package.json"]);
    const product = {
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
      ...fields
    };
    await this.writeJsonAsync(["package.json"], { ...manifest.toJson(), desktop: { ...manifest.readObject("desktop").toJson(), product } });
  }

  public async writeNpmAsync(): Promise<NodeJS.ProcessEnv> {
    await this.writeAsync([ModuleAppFixture.NPM_FILE], `${ModuleAppFixture.NPM_SCRIPT.join("\n")}\n`);
    return { npm_execpath: path.join(this.path, ModuleAppFixture.NPM_FILE) };
  }

  public async readInstalledArchivesAsync(): Promise<readonly string[]> {
    return (await this.readInstallsAsync()).flat();
  }

  public async readInstallsAsync(): Promise<readonly (readonly string[])[]> {
    return (await this.readLinesAsync(ModuleAppFixture.NPM_LOG_FILE)).map(t => JsonReader.parse(t).readStringArray("archives")).filter(t => t.length > 0);
  }

  public async readPackedArchivesAsync(): Promise<readonly string[]> {
    return await this.readLinesAsync(ModuleAppFixture.NPM_PACK_LOG_FILE);
  }

  public async removeAsync(segments: readonly string[]): Promise<void> {
    await rm(path.join(this.path, ...segments), { recursive: true, force: true });
  }

  public async writeModuleFileAsync(file: string, text: string): Promise<void> {
    await this.writeAsync(["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/"), file], text);
  }

  public async addModulePackageAsync(id: string, name: string): Promise<void> {
    await this.addRootModuleAsync({ id, package: name }, { [name]: ModuleAppFixture.MODULE_VERSION });
    await this.writePackageAsync([], name, {
      version: ModuleAppFixture.MODULE_VERSION,
      exports: { "./runtime": "./runtime.js", "./window": { default: "./window.js" } },
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED }
    });
    await this.writeAsync(["node_modules", ...name.split("/"), "window.js"], "export const otherPart = 1;\n");
    await this.writeJsonAsync(["node_modules", ...name.split("/"), "module.json"], {
      id,
      version: ModuleAppFixture.MODULE_VERSION,
      displayName: "Other",
      description: "A second module an app installs from a package, with a window part.",
      parts: ["runtime", "window"],
      dependencies: {},
      contributes: {}
    });
  }

  public async removeRootInputsAsync(): Promise<void> {
    for (const file of ModuleAppFixture.ROOT_INPUTS)
      await rm(path.join(this.path, file));
    await this.writeAsync(["node_modules", ".noldova-install"], `${process.platform} ${process.arch} none\n`);
  }

  public async writeSettingAsync(type: unknown, defaultValue: unknown, locality: string = "Device", scopes: readonly string[] = []): Promise<void> {
    const folder = ["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/")];
    const declaration = (await this.readJsonAsync([...folder, "module.json"])).toJson();
    await this.writeJsonAsync([...folder, "module.json"], { ...declaration, contributes: { settings: [ModuleAppFixture.SETTING], ...scopes.length === 0 ? {} : { settingScopes: scopes } } });
    await this.writeJsonAsync([...folder, "settings.json"], {
      settings: [{
        name: ModuleAppFixture.SETTING,
        title: "Default model",
        description: "The model a new conversation starts with.",
        type,
        default: defaultValue,
        locality,
        scopes,
        page: "Sample",
        group: "Conversations"
      }]
    });
  }

  public async writeDeclarationAsync(fields: Readonly<Record<string, unknown>>, parts: readonly string[]): Promise<void> {
    const folder = ["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/")];
    const declaration = (await this.readJsonAsync([...folder, "module.json"])).toJson();
    await this.writeJsonAsync([...folder, "module.json"], { ...declaration, ...fields, parts });
    const manifest = (await this.readJsonAsync([...folder, "package.json"])).toJson();
    await this.writeJsonAsync([...folder, "package.json"], { ...manifest, exports: Object.fromEntries(parts.map(t => [`./${t}`, `./${t}.js`])) });
  }

  public async installForPackagingAsync(moduleArchive: Buffer | null = null): Promise<void> {
    const { NEEDED, MODULE_VERSION, RUNTIME, MODULE_PACKAGE, RUNTIME_PACKAGE, PROTOCOL_PACKAGE, LOCKED_PACKAGE, WINDOW_PACKAGE, THIRD_PARTY } = ModuleAppFixture;
    await this.writeAsync(["LICENSE"], "Sample license\n");
    await this.writeAsync(["assets", "icons", "icon-dark-512.png"], String.empty);
    await this.writeJsonAsync(["assets", "dictionaries", "dictionaries.json"], {});
    await this.writePackageAsync([], "electron", { version: ModuleAppFixture.ELECTRON_VERSION });
    await this.writeLockAsync({
      "": { name: "app" },
      [`node_modules/${THIRD_PARTY}`]: {
        version: ModuleAppFixture.THIRD_PARTY_VERSION,
        resolved: `${ModuleAppFixture.UNREACHABLE_REGISTRY}/${THIRD_PARTY}-${ModuleAppFixture.THIRD_PARTY_VERSION}.tgz`,
        integrity: `sha512-${createHash("sha512").update(THIRD_PARTY).digest("base64")}`
      }
    }, { name: "app", lockfileVersion: 3 });
    for (const name of [ModuleAppFixture.ELECTRON, ModuleAppFixture.CLI])
      await this.writePackageAsync([], name, { version: NEEDED });
    const installed: Record<string, unknown> = {};
    for (const [name, version, dependencies, peerDependencies] of [
      [ModuleAppFixture.ELECTRON, NEEDED, { [RUNTIME]: NEEDED }, {}],
      [ModuleAppFixture.CLI, NEEDED, {}, {}],
      [RUNTIME, NEEDED, {}, {}],
      [MODULE_PACKAGE, MODULE_VERSION, { [RUNTIME_PACKAGE]: MODULE_VERSION, [WINDOW_PACKAGE]: MODULE_VERSION }, { [RUNTIME]: NEEDED }],
      [RUNTIME_PACKAGE, MODULE_VERSION, { [PROTOCOL_PACKAGE]: MODULE_VERSION, [THIRD_PARTY]: ModuleAppFixture.THIRD_PARTY_VERSION }, { [RUNTIME]: NEEDED }],
      [PROTOCOL_PACKAGE, MODULE_VERSION, { [LOCKED_PACKAGE]: MODULE_VERSION }, {}],
      [LOCKED_PACKAGE, MODULE_VERSION, {}, {}],
      [WINDOW_PACKAGE, MODULE_VERSION, { [PROTOCOL_PACKAGE]: MODULE_VERSION }, { [ModuleAppFixture.ANGULAR_CORE]: ModuleAppFixture.ANGULAR_VERSION }]
    ] as const) {
      const archive = ModuleAppFixture.nameArchive(name, version);
      const { FOLDER } = TarballFixture;
      const data = name !== MODULE_PACKAGE ? Buffer.from(`${name} archive`) : moduleArchive ?? TarballFixture.createEntries([
        { name: FOLDER, type: "5" },
        { name: `${FOLDER}package.json`, text: JSON.stringify({ name, version, dependencies, peerDependencies }) },
        { name: `${FOLDER}assets/`, type: "5" },
        { name: `${FOLDER}${ModuleAppFixture.LONG_FILE}`, text: ModuleAppFixture.LONG_FILE }
      ]);
      await this.writeAsync(["archives", archive], data);
      installed[`node_modules/${name}`] = {
        version,
        resolved: `file:archives/${archive}`,
        integrity: `sha512-${createHash("sha512").update(data).digest("base64")}`,
        dependencies,
        peerDependencies
      };
    }
    await this.writeJsonAsync(["node_modules", ".package-lock.json"], { name: "app", lockfileVersion: 3, packages: installed });
  }

  public async packageAsync(environment: NodeJS.ProcessEnv): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    const exitCode = await new BuildCommandLine(this.path, environment, "linux", "x64", output, new PassThrough()).runAsync(["package"]);
    return `${exitCode} ${chunks.join(String.empty)}`;
  }

  public async editInstalledManifestAsync(name: string, fields: Readonly<Record<string, unknown>>): Promise<void> {
    const file = ["node_modules", ...name.split("/"), "package.json"];
    const manifest = JsonReader.parse(await readFile(path.join(this.path, ...file), "utf8")).toJson();
    await this.writeJsonAsync(file, { ...manifest, ...fields });
  }

  public async writeFileAsync(segments: readonly string[], text: string): Promise<void> {
    await this.writeAsync(segments, text);
  }

  public async installPackageAsync(folder: readonly string[], installedAs: string, name: string): Promise<void> {
    await this.writePackageAsync(folder, installedAs, { name, version: ModuleAppFixture.MODULE_VERSION });
  }

  public async linkPackageAsync(folder: readonly string[], installedAs: string, name: string): Promise<void> {
    const target = path.join(this.path, "linked", ...name.split("/"));
    await this.writeJsonAsync(["linked", ...name.split("/"), "package.json"], { name, version: ModuleAppFixture.MODULE_VERSION });
    const link = path.join(this.path, ...folder, "node_modules", ...installedAs.split("/"));
    await FolderFixture.ensureAsync(path.dirname(link));
    await symlink(target, link, "junction");
  }

  public async readPackedSourceAsync(name: string, file: string): Promise<string> {
    return await readFile(path.join(this.path, "_build", "package", "company", "sources", ...name.split("/"), ...file.split("/")), "utf8");
  }

  public async readPackedManifestAsync(name: string, version: string): Promise<Readonly<Record<string, unknown>>> {
    return JsonReader.parse(await readFile(path.join(this.path, "_build", "package", "company", ModuleAppFixture.nameArchive(name, version)), "utf8")).toJson();
  }

  public async writeContributionsAsync(contributes: Readonly<Record<string, readonly string[]>>): Promise<void> {
    const folder = ["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/")];
    const declaration = (await this.readJsonAsync([...folder, "module.json"])).toJson();
    await this.writeJsonAsync([...folder, "module.json"], { ...declaration, contributes });
  }

  public async writeModuleJsonAsync(id: string | null, file: string, value: unknown): Promise<void> {
    await this.writeJsonAsync([...Object.isNull(id) ? ["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/")] : ["src", "modules", id], file], value);
  }

  public async writeTreeModuleAsync(
    id: string, parts: readonly string[], contributes: Readonly<Record<string, readonly string[]>>, dependencies: Readonly<Record<string, string>> = {}): Promise<void> {
    await this.addRootModuleAsync(id, {});
    await this.writeJsonAsync(["src", "modules", id, "module.json"], {
      id,
      version: ModuleAppFixture.MODULE_VERSION,
      displayName: "Tree",
      description: "A module the app builds from its own tree.",
      parts,
      dependencies,
      contributes
    });
    for (const part of parts)
      await this.writeAsync(["src", "modules", id, part, `${part}-part.ts`], String.empty);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }

  private static nameArchive(name: string, version: string): string {
    return `${name.replace("@", String.empty).replace("/", "-")}-${version}.tgz`;
  }

  private async addRootModuleAsync(module: JsonValue, dependencies: Readonly<Record<string, string>>): Promise<void> {
    const manifest = await this.readJsonAsync(["package.json"]);
    const desktop = manifest.readObject("desktop");
    const modules = desktop.readValue("modules");
    await this.writeJsonAsync(["package.json"], {
      ...manifest.toJson(),
      desktop: { ...desktop.toJson(), modules: [...Array.isArray(modules) ? modules : [], module] },
      dependencies: { ...manifest.readObject("dependencies").toJson(), ...dependencies }
    });
  }

  private async writeBuiltModuleAsync(): Promise<void> {
    await this.writeJsonAsync(["src", "modules", "clock", "module.json"], {
      id: "clock",
      version: ModuleAppFixture.BUILT_VERSION,
      displayName: "Clock",
      description: "A module the app builds itself, whose parts are also installed at another version.",
      parts: ["runtime", "window"],
      dependencies: {},
      contributes: {}
    });
    for (const part of ["runtime", "window"])
      await this.writeAsync(["src", "modules", "clock", part, `${part}-part.ts`], String.empty);
    await this.writePackageAsync([], ModuleAppFixture.BUILT_PART, { version: ModuleAppFixture.INSTALLED_VERSION });
    await this.writePackageAsync([], ModuleAppFixture.BUILT_WINDOW_PART, { version: ModuleAppFixture.INSTALLED_VERSION });
  }

  private async writeLockAsync(packages: Readonly<Record<string, unknown>>, fields: Readonly<Record<string, unknown>> = { lockfileVersion: 3 }): Promise<void> {
    await this.writeJsonAsync(["package-lock.json"], { ...fields, packages });
    const lockfile = await readFile(path.join(this.path, "package-lock.json"));
    await this.writeAsync(["node_modules", ".noldova-install"], `${process.platform} ${process.arch} ${createHash("sha256").update(lockfile).digest("hex")}\n`);
  }

  private async writePackageAsync(folder: readonly string[], name: string, fields: Readonly<Record<string, unknown>>): Promise<void> {
    await this.writeJsonAsync([...folder, "node_modules", ...name.split("/"), "package.json"], { name, ...fields });
  }

  private async readJsonAsync(segments: readonly string[]): Promise<JsonReader> {
    return JsonReader.parse(await readFile(path.join(this.path, ...segments), "utf8"));
  }

  private async readLinesAsync(name: string): Promise<readonly string[]> {
    const file = path.join(this.path, name);
    return existsSync(file) ? (await readFile(file, "utf8")).split("\n").filter(t => t.length > 0) : [];
  }

  private async writeJsonAsync(segments: readonly string[], value: unknown): Promise<void> {
    await this.writeAsync(segments, JSON.stringify(value));
  }

  private async writeAsync(segments: readonly string[], text: string | Buffer): Promise<void> {
    const file = path.join(this.path, ...segments);
    await FolderFixture.ensureAsync(path.dirname(file));
    await writeFile(file, text);
  }
}
