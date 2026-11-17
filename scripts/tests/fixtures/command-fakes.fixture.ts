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

export class CommandFakesFixture implements AsyncDisposable {
  public readonly folder: string;
  public readonly bin: string;
  private readonly calls: string;

  private constructor(folder: string) {
    this.folder = folder;
    this.bin = path.join(folder, "bin");
    this.calls = path.join(folder, "calls.txt");
  }

  public static async createAsync(commands: Readonly<Record<string, string>>): Promise<CommandFakesFixture> {
    const fakes = new CommandFakesFixture(await mkdtemp(path.join(tmpdir(), "command-fakes-")));
    await mkdir(fakes.bin);
    await writeFile(fakes.calls, "");
    for (const [name, body] of Object.entries(commands)) {
      const file = path.join(fakes.bin, name);
      await writeFile(file, `#!/bin/sh\nprintf '%s\\n' "${name} $*" >> "${fakes.calls.split(path.sep).join("/")}"\n${body}\n`);
      await chmod(file, 0o755);
    }
    return fakes;
  }

  public async readCallsAsync(): Promise<readonly string[]> {
    return (await readFile(this.calls, "utf8")).split("\n").filter(t => t.length > 0);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
