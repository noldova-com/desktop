/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { StepRun } from "./step-run.ts";
import { WorkflowStepFixture } from "./workflow-step.fixture.ts";

export class ModuleRangeFolderFixture implements AsyncDisposable {
  public static readonly STEP: string = "Move to Noldova Desktop ${{ steps.choose.outputs.version }}";

  private static readonly MANIFEST: string = "package.json";
  private static readonly SCRIPT: string = [
    "import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from \"node:fs\";",
    "import path from \"node:path\";",
    "const folder = import.meta.dirname;",
    "const registry = JSON.parse(readFileSync(path.join(folder, \"registry.json\"), \"utf8\"));",
    "const [command, ...rest] = process.argv.slice(2);",
    "const write = (name, version) => {",
    "  mkdirSync(path.join(\"node_modules\", name), { recursive: true });",
    "  writeFileSync(path.join(\"node_modules\", name, \"package.json\"), JSON.stringify({ name, version }));",
    "};",
    "if (command === \"view\") {",
    "  const [spec, field] = rest;",
    "  const value = registry.fields[spec.slice(0, spec.lastIndexOf(\"@\"))]?.[field];",
    "  process.stdout.write(value === undefined ? \"\" : JSON.stringify(value));",
    "}",
    "if (command === \"install\") {",
    "  const at = path.relative(realpathSync(path.dirname(folder)), realpathSync(process.cwd())).split(path.sep).join(\"/\") || \".\";",
    "  appendFileSync(path.join(folder, \"installs.txt\"), JSON.stringify([at, ...rest]) + \"\\n\");",
    "  const named = rest.filter(t => !t.startsWith(\"--\"));",
    "  for (const spec of named)",
    "    write(spec.slice(0, spec.lastIndexOf(\"@\")), spec.slice(spec.lastIndexOf(\"@\") + 1));",
    "  for (const [name, version] of Object.entries(registry.newest))",
    "    if (!named.some(t => t.slice(0, t.lastIndexOf(\"@\")) === name) && existsSync(path.join(\"node_modules\", name)))",
    "      write(name, version);",
    "  for (const [name, version] of Object.entries(registry.forced))",
    "    write(name, version);",
    "}"
  ].join("\n");

  public readonly folder: string;
  private readonly fake: string;

  private constructor(folder: string) {
    this.folder = folder;
    this.fake = path.join(folder, "fake-npm");
  }

  public static async createAsync(files: Readonly<Record<string, object>>, registry: object): Promise<ModuleRangeFolderFixture> {
    const fixture = new ModuleRangeFolderFixture(await mkdtemp(path.join(tmpdir(), "module-range-")));
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(fixture.folder, file)), { recursive: true });
      await writeFile(path.join(fixture.folder, file), JSON.stringify(content));
    }
    spawnSync("git", ["init", "--quiet"], { cwd: fixture.folder });
    const manifests = Object.keys(files).filter(t => path.basename(t) === ModuleRangeFolderFixture.MANIFEST && !t.split("/").includes("node_modules"));
    spawnSync("git", ["add", ...manifests], { cwd: fixture.folder });
    await mkdir(path.join(fixture.fake, "bin"), { recursive: true });
    await writeFile(path.join(fixture.fake, "npm.mjs"), ModuleRangeFolderFixture.SCRIPT);
    await writeFile(path.join(fixture.fake, "registry.json"), JSON.stringify(registry));
    await writeFile(path.join(fixture.fake, "installs.txt"), "");
    const command = path.join(fixture.fake, "bin", "npm");
    await writeFile(command, `#!/bin/sh\nexec "${process.execPath}" "${path.join(fixture.fake, "npm.mjs")}" "$@"\n`);
    await chmod(command, 0o755);
    return fixture;
  }

  public async runAsync(version: string): Promise<StepRun> {
    const result = await WorkflowStepFixture.runAsync(WorkflowStepFixture.readRun("module-range.yml", ModuleRangeFolderFixture.STEP), this.folder,
      path.join(this.fake, "bin"), { VERSION: version });
    return new StepRun(result.status, result.output);
  }

  public async readInstallsAsync(): Promise<readonly string[]> {
    return (await readFile(path.join(this.fake, "installs.txt"), "utf8")).split("\n").filter(t => t.length > 0);
  }

  public async readVersionAsync(name: string, folder: string = "."): Promise<string> {
    const manifest: unknown = JSON.parse(await readFile(path.join(this.folder, folder, "node_modules", name, ModuleRangeFolderFixture.MANIFEST), "utf8"));
    return String(Reflect.get(Object(manifest), "version"));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
