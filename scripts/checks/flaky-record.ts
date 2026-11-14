/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FlakyRecordException } from "./flaky-record.exception.ts";
import { FlakyTest } from "./flaky-test.ts";

export class FlakyRecord {
  private readonly file: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, environment: NodeJS.ProcessEnv) {
    this.file = path.join(root, ...Resources.flakyRecordSegments);
    this.environment = environment;
  }

  public static parse(text: string): readonly FlakyTest[] {
    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch (error) {
      throw new FlakyRecordException(text, error);
    }
    if (!Array.isArray(value))
      throw new FlakyRecordException(text);
    try {
      return value.map((t: unknown, i) => {
        const reader = JsonReader.fromValue(t, Resources.formatJsonArrayItemPath(i));
        return new FlakyTest(reader.readString(Resources.flakyRecordRunnerField), reader.readString(Resources.fileField), reader.readString(Resources.nameField), reader.readString(Resources.flakyRecordFailureField));
      });
    }
    catch (error) {
      throw new FlakyRecordException(text, error);
    }
  }

  public static cap(failure: string): string {
    const lines = failure.split(Resources.lineEnd).slice(0, Resources.flakyRecordMaximumFailureLines).join(Resources.lineEnd);
    return lines.length <= Resources.flakyRecordMaximumFailureLength ? lines : `${lines.slice(0, Resources.flakyRecordMaximumFailureLength - 1)}${Resources.flakyRecordEllipsis}`;
  }

  public async clearAsync(): Promise<void> {
    await rm(this.file, { force: true });
  }

  public async readAsync(): Promise<readonly FlakyTest[]> {
    return existsSync(this.file) ? FlakyRecord.parse(await readFile(this.file, Resources.encoding)) : [];
  }

  public async addAsync(tests: readonly FlakyTest[], output: Writable): Promise<void> {
    if (tests.length === 0)
      return;
    const recorded = await this.readAsync();
    const added = tests.map(t => new FlakyTest(t.runner, t.file, t.name, FlakyRecord.cap(t.failure)));
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify([...recorded, ...added], null, Resources.jsonIndent)}${Resources.lineEnd}`);
    output.write(Resources.formatFlakyRetried(added));
    const summary = this.environment[Resources.summaryVariable];
    if (!Object.isUndefined(summary))
      await appendFile(summary, Resources.formatFlakySummary(added.map(t => new FlakyTest(FlakyRecord.escape(t.runner), FlakyRecord.escape(t.file), FlakyRecord.escape(t.name), FlakyRecord.escape(t.failure.split(Resources.lineEnd, 1).join(String.empty))))));
  }

  private static escape(text: string): string {
    return [...Resources.flakyRecordSummaryEscapes].reduce((escaped, [character, entity]) => escaped.replaceAll(character, entity), text);
  }
}
