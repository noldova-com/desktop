/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class NpmFakeFixture implements AsyncDisposable {
  private static readonly SCRIPT: string = [
    "import { appendFileSync, readFileSync, writeFileSync } from \"node:fs\";",
    "import path from \"node:path\";",
    "const folder = import.meta.dirname;",
    "if (process.argv[2] === \"ci\") {",
    "  appendFileSync(path.join(folder, \"calls.txt\"), JSON.stringify(process.argv.slice(2)) + \"\\n\");",
    "  const calls = readFileSync(path.join(folder, \"calls.txt\"), \"utf8\").trim().split(\"\\n\").length;",
    "  const [status, lines, ending] = JSON.parse(readFileSync(path.join(folder, \"plan.json\"), \"utf8\"))[calls - 1];",
    "  writeFileSync(path.join(process.env.npm_config_logs_dir, \"run-debug-0.log\"), lines.map(t => t + ending).join(\"\"));",
    "  process.exitCode = status;",
    "}",
    "if (process.argv[2] === \"pack\")",
    "  appendFileSync(path.join(folder, \"packs.txt\"), JSON.stringify(process.argv.slice(2)) + \"\\n\");"
  ].join("\n");

  public readonly folder: string;
  public readonly script: string;
  public readonly bin: string;

  private constructor(folder: string) {
    this.folder = folder;
    this.script = path.join(folder, "npm.mjs");
    this.bin = path.join(folder, "bin");
  }

  public static async createAsync(plan: readonly (readonly [number, readonly string[]])[], ending: string): Promise<NpmFakeFixture> {
    const fake = new NpmFakeFixture(await mkdtemp(path.join(tmpdir(), "npm-fake-")));
    await writeFile(fake.script, NpmFakeFixture.SCRIPT);
    await writeFile(path.join(fake.folder, "calls.txt"), "");
    await writeFile(path.join(fake.folder, "packs.txt"), "");
    await writeFile(path.join(fake.folder, "plan.json"), JSON.stringify(plan.map(([status, lines]) => [status, lines, ending])));
    await mkdir(fake.bin);
    const command = path.join(fake.bin, "npm");
    await writeFile(command, `#!/bin/sh\nexec "${NpmFakeFixture.toShell(process.execPath)}" "${NpmFakeFixture.toShell(fake.script)}" "$@"\n`);
    await chmod(command, 0o755);
    return fake;
  }

  public async readCallsAsync(): Promise<readonly string[]> {
    return (await readFile(path.join(this.folder, "calls.txt"), "utf8")).split("\n").filter(t => t.length > 0);
  }

  public async readPacksAsync(): Promise<readonly string[]> {
    return (await readFile(path.join(this.folder, "packs.txt"), "utf8")).split("\n").filter(t => t.length > 0);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }

  private static toShell(file: string): string {
    return file.split(path.sep).join("/");
  }
}
