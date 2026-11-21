/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class CommandRootFixture implements AsyncDisposable {
  public readonly path: string;

  private constructor(root: string) {
    this.path = root;
  }

  public static async createAsync(): Promise<CommandRootFixture> {
    const root = new CommandRootFixture(await mkdtemp(path.join(tmpdir(), "desktop-build-command-")));
    await writeFile(path.join(root.path, "package.json"), JSON.stringify({ version: "1.0.0" }));
    await root.writeModuleAsync("clock", {});
    await root.writeModuleAsync("notes", { clock: "1.0.0", tasks: "1.0.0" });
    return root;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }

  private async writeModuleAsync(id: string, optional: Readonly<Record<string, string>>): Promise<void> {
    const folder = path.join(this.path, "src", "modules", id);
    await mkdir(path.join(folder, "runtime"), { recursive: true });
    await writeFile(path.join(folder, "module.json"), JSON.stringify({
      id, version: "1.0.0", displayName: id, description: `The ${id} module.`, parts: ["runtime"], dependencies: {}, optionalDependencies: optional, contributes: {}
    }));
  }
}
