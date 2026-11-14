/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { SentenceBreaker } from "./documents/sentence-breaker.ts";
import { ProcessRunner } from "../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { Git } from "../src/noldova.desktop.build/src/services/repository/git.ts";
import { Resources } from "./resources.ts";
import { RepositoryFiles } from "./structure/repository-files.ts";

export class FormatDocuments {
  private readonly root: string;
  private readonly files: RepositoryFiles;
  private readonly output: Writable;

  public constructor(root: string, files: RepositoryFiles, output: Writable) {
    this.root = root;
    this.files = files;
    this.output = output;
  }

  public async runAsync(args: readonly string[]): Promise<number> {
    if (args.length > 0) {
      this.output.write(Resources.formatDocumentsUsage);
      return Resources.usageExitCode;
    }

    const breaker = new SentenceBreaker();
    const documents = (await this.files.listAsync()).filter(t => t.endsWith(Resources.markdownExtension));
    const changed: string[] = [];
    for (const document of documents) {
      const file = path.join(this.root, document);
      const text = await readFile(file, Resources.encoding);
      const formatted = breaker.format(text);
      if (formatted !== text) {
        await writeFile(file, formatted);
        changed.push(document);
      }
    }
    for (const document of changed)
      this.output.write(`${document}${Resources.lineEnd}`);
    this.output.write(Resources.formatDocumentsChanged(changed.length, documents.length));
    return Resources.successExitCode;
  }
}

if (import.meta.main) {
  const root = process.cwd();
  process.exitCode = await new FormatDocuments(root, new RepositoryFiles(root, new Git(root, new ProcessRunner())), process.stdout).runAsync(process.argv.slice(2));
}
