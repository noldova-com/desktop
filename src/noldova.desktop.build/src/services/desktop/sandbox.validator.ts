/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, type Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { UserNamespaces } from "./user-namespaces.ts";
import { Resources } from "../../resources.ts";

export class SandboxValidator {
  private readonly platform: string;
  private readonly readTextAsync: (file: string) => Promise<string | null>;
  private readonly statAsync: (file: string) => Promise<Pick<Stats, "uid" | "mode"> | null>;

  public constructor(
    platform: string,
    readTextAsync: (file: string) => Promise<string | null>,
    statAsync: (file: string) => Promise<Pick<Stats, "uid" | "mode"> | null>) {
    this.platform = platform;
    this.readTextAsync = readTextAsync;
    this.statAsync = statAsync;
  }

  public static async readOptionalTextAsync(file: string): Promise<string | null> {
    return existsSync(file) ? readFile(file, Resources.textEncoding) : null;
  }

  public static async statOptionalAsync(file: string): Promise<Stats | null> {
    return existsSync(file) ? stat(file) : null;
  }

  public async findProblemAsync(executable: string): Promise<string | null> {
    if (this.platform !== Resources.linuxPlatform || Object.isNull(await UserNamespaces.findRefusalAsync(this.readTextAsync)))
      return null;
    const helper = path.join(path.dirname(executable), Resources.chromeSandboxFile);
    const status = await this.statAsync(helper);
    if (Object.isNull(status) || status.uid === Resources.rootUserId && (status.mode & Resources.chromeSandboxMode) === Resources.chromeSandboxMode)
      return null;
    return Resources.formatSandboxProblem(helper);
  }
}
