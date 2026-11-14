/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { RuntimeEntry } from "@noldova/desktop.runtime";

export class RuntimeCopyFixture implements AsyncDisposable {
  private readonly folder: string;

  public readonly packageUrl: string;
  public readonly productFile: string;

  private constructor(folder: string, packageUrl: string) {
    this.folder = folder;
    this.packageUrl = packageUrl;
    this.productFile = path.join(folder, "_build", "product.json");
  }

  public static async createAsync(): Promise<RuntimeCopyFixture> {
    const installed = path.resolve(path.dirname(RuntimeEntry.entryPath), "..");
    const folder = path.resolve(installed, "..", "..", "..", "_build", "runtime-copies", `${process.pid}-${Date.now()}`);
    const copy = path.join(folder, "node_modules", "@noldova", "desktop.runtime");
    await cp(installed, copy, { recursive: true });
    return new RuntimeCopyFixture(folder, pathToFileURL(path.join(copy, "api", "index.js")).href);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
