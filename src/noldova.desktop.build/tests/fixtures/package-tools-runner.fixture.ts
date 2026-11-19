/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { ProcessResult } from "../../src/models/processes/process-result.js";
import { ArchiveReader } from "../../src/services/packages/archive.reader.js";
import { BuildLayout } from "../../src/services/packages/build-layout.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";
import { TarballFixture } from "./tarball.fixture.js";

export interface IPackageToolsAnswers {
  readonly failing?: string;
  readonly inputs?: string;
  readonly scriptFiles?: Readonly<Record<string, string>>;
  readonly status?: string;
  readonly commit?: string;
  readonly installedLockfile?: string;
}

export class PackageToolsRunnerFixture extends ProcessRunner {
  public static readonly FAILURE: string = "broken";

  private static readonly NPM_FILE: string = "npm-cli.js";
  private static readonly ARCHIVE_FOLDER: string = "package/";

  private readonly layout: BuildLayout;
  private readonly answers: IPackageToolsAnswers;

  public readonly calls: string[] = [];
  public readonly installs: (readonly string[])[] = [];
  public readonly installed: (readonly string[])[] = [];

  public constructor(root: string, answers: IPackageToolsAnswers = {}) {
    super();
    this.layout = new BuildLayout(root);
    this.answers = answers;
  }

  public get environment(): NodeJS.ProcessEnv {
    return { npm_execpath: this.npm };
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string): Promise<ProcessResult> {
    const call = this.describe(command, commandArguments, directory);
    this.calls.push(call);
    if (!Object.isUndefined(this.answers.failing) && call.startsWith(this.answers.failing))
      return new ProcessResult(1, String.empty, PackageToolsRunnerFixture.FAILURE);
    return new ProcessResult(0, await this.performAsync(call, commandArguments, directory), String.empty);
  }

  private get npm(): string {
    return path.join(this.layout.root, PackageToolsRunnerFixture.NPM_FILE);
  }

  private describe(command: string, commandArguments: readonly string[], directory: string): string {
    const [first = String.empty, second = String.empty] = commandArguments;
    if (path.basename(command, path.extname(command)) === "git")
      return ["git", ...commandArguments].join(" ");
    if (first === this.npm)
      return second === "pack" ? `pack ${path.basename(directory)}` : second;
    if (path.basename(first) === "tsc")
      return `${commandArguments.includes("--noEmit") ? "type-check" : "compile"} ${this.show(PackageToolsRunnerFixture.option(commandArguments, "--project"))}`;
    return `${second === "--inputs" ? "inputs" : "build"} ${this.show(first)}`;
  }

  private async performAsync(call: string, commandArguments: readonly string[], directory: string): Promise<string> {
    if (call === "git status --porcelain")
      return this.answers.status ?? String.empty;
    if (call.startsWith("git "))
      return this.answers.commit ?? String.empty;
    if (call.startsWith("pack "))
      await this.packAsync(directory);
    else if (call === "install")
      await this.installAsync(commandArguments.filter(t => t.endsWith(".tgz")), commandArguments.slice(2).filter(t => !t.startsWith("-")));
    else if (call.startsWith("compile "))
      await PackageToolsRunnerFixture.compileAsync(PackageToolsRunnerFixture.option(commandArguments, "--rootDir"), PackageToolsRunnerFixture.option(commandArguments, "--outDir"));
    else if (call.startsWith("inputs "))
      return this.answers.inputs ?? String.empty;
    else if (call.startsWith("build "))
      await this.runBuildScriptAsync(commandArguments[1] ?? String.empty);
    return String.empty;
  }

  private async packAsync(folder: string): Promise<void> {
    const manifest = JsonReader.parse(await readFile(path.join(folder, "package.json"), "utf8"));
    const archive = path.join(this.layout.archivesFolder, BuildLayout.nameArchive(manifest.readString("name"), manifest.readString("version")));
    await writeFile(archive, TarballFixture.create(await PackageToolsRunnerFixture.readTreeAsync(folder)));
  }

  private async installAsync(archives: readonly string[], packages: readonly string[]): Promise<void> {
    this.installs.push(archives.map(t => path.basename(t)).sort());
    this.installed.push(packages.map(t => t.endsWith(".tgz") ? path.basename(t) : t));
    if (!Object.isUndefined(this.answers.installedLockfile))
      await PackageToolsRunnerFixture.writeAsync(path.join(this.layout.root, "node_modules", ".package-lock.json"), this.answers.installedLockfile);
    for (const archive of archives) {
      const entries = await new ArchiveReader().readAsync(archive);
      const manifest = entries.get(`${PackageToolsRunnerFixture.ARCHIVE_FOLDER}package.json`);
      if (Object.isUndefined(manifest))
        continue;
      const folder = this.layout.locateInstalledPackage(JsonReader.parse(manifest.toString("utf8")).readString("name"));
      await rm(folder, { recursive: true, force: true });
      for (const [entry, content] of entries)
        await PackageToolsRunnerFixture.writeAsync(path.join(folder, ...entry.slice(PackageToolsRunnerFixture.ARCHIVE_FOLDER.length).split("/")), content);
    }
  }

  private async runBuildScriptAsync(output: string): Promise<void> {
    await mkdir(output, { recursive: true });
    if (!Object.isUndefined(this.answers.scriptFiles)) {
      for (const [name, text] of Object.entries(this.answers.scriptFiles))
        await PackageToolsRunnerFixture.writeAsync(path.join(output, ...name.split("/")), text);
      return;
    }
    await writeFile(path.join(output, "index.js"), "built\n");
    for (const input of (this.answers.inputs ?? String.empty).split("\n").filter(t => t.length > 0))
      await cp(path.join(this.layout.root, ...input.split("/")), path.join(output, path.posix.basename(input)), { recursive: true });
  }

  private static async compileAsync(rootDirectory: string, output: string): Promise<void> {
    await mkdir(output, { recursive: true });
    for (const [name, text] of Object.entries(await PackageToolsRunnerFixture.readTreeAsync(rootDirectory)))
      if (name.endsWith(".ts") && !name.endsWith(".d.ts"))
        await PackageToolsRunnerFixture.writeAsync(path.join(output, ...`${name.slice(0, -".ts".length)}.js`.split("/")), text);
  }

  private static async readTreeAsync(folder: string): Promise<Readonly<Record<string, string>>> {
    const files: Record<string, string> = {};
    for (const entry of (await readdir(folder, { recursive: true, withFileTypes: true })).filter(t => t.isFile())) {
      const name = path.relative(folder, path.join(entry.parentPath, entry.name)).split(path.sep).join("/");
      if (!name.split("/").includes("node_modules"))
        files[name] = await readFile(path.join(entry.parentPath, entry.name), "utf8");
    }
    return files;
  }

  private static option(commandArguments: readonly string[], name: string): string {
    return commandArguments[commandArguments.indexOf(name) + 1] ?? String.empty;
  }

  private static async writeAsync(file: string, content: string | Buffer): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }

  private show(item: string): string {
    return path.relative(this.layout.root, item).split(path.sep).join("/");
  }
}
