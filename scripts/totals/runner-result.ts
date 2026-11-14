/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Resources } from "../resources.ts";
import type { ICoverageCount } from "./interfaces/i-coverage-count.ts";
import type { IRunnerSkip } from "./interfaces/i-runner-skip.ts";
import type { ITestName } from "./interfaces/i-test-name.ts";
import { JsonFields } from "./json-fields.ts";
import { RunnerResultMissingException } from "./runner-result-missing.exception.ts";
import { RunnerTotals } from "./runner-totals.ts";
import { TestIdentity } from "./test-identity.ts";

export class RunnerResult {
  public readonly discovered: number;
  public readonly selected: number;
  public readonly passed: number;
  public readonly failed: number;
  public readonly skipped: number;
  public readonly unreached: number;
  public readonly skips: readonly IRunnerSkip[];
  public readonly files: readonly string[];
  public readonly duplicates: readonly ITestName[];
  public readonly empty: readonly string[];

  public constructor(fields: JsonFields) {
    this.passed = fields.count(Resources.totalsPassedField);
    this.failed = fields.count(Resources.totalsFailedField);
    this.skipped = fields.count(Resources.totalsSkippedField);
    this.unreached = fields.count(Resources.totalsUnreachedField);
    const total = this.passed + this.failed + this.skipped + this.unreached;
    this.discovered = fields.has(Resources.totalsDiscoveredField) ? fields.count(Resources.totalsDiscoveredField) : total;
    this.selected = fields.has(Resources.totalsSelectedField) ? fields.count(Resources.totalsSelectedField) : total;
    this.skips = fields.objects(Resources.totalsSkipsField).map(t => ({ file: t.text(Resources.fileField), names: t.texts(Resources.totalsNamesField), reason: t.text(Resources.totalsReasonField) }));
    this.files = fields.texts(Resources.totalsFilesField);
    this.duplicates = fields.has(Resources.totalsDuplicatesField) ? fields.objects(Resources.totalsDuplicatesField).map(t => ({ file: t.text(Resources.fileField), names: t.texts(Resources.totalsNamesField) })) : [];
    this.empty = fields.has(Resources.totalsEmptyField) ? fields.texts(Resources.totalsEmptyField) : [];
  }

  public static parse(text: string, source: string): RunnerResult {
    return new RunnerResult(JsonFields.parse(text, source));
  }

  public static async readAsync(root: string, file: string): Promise<RunnerResult> {
    const source = path.relative(root, file).split(path.sep).join(path.posix.sep);
    if (!existsSync(file))
      throw new RunnerResultMissingException(source);
    return RunnerResult.parse(await readFile(file, Resources.encoding), source);
  }

  public toTotals(runner: string, title: string, coverage: ICoverageCount | null, expected: readonly string[], shard: string | null): RunnerTotals {
    return new RunnerTotals(
      runner,
      title,
      { discovered: this.discovered, passed: this.passed, failed: this.failed, rerunPassed: 0, skipped: this.skipped, unselected: this.discovered - this.selected, unreached: this.unreached },
      this.skips.map(t => ({ test: TestIdentity.of(t.file, t.names), reason: t.reason })),
      this.files,
      coverage,
      { duplicates: this.duplicates.map(t => TestIdentity.of(t.file, t.names)), empty: this.empty },
      { expected, shard });
  }
}
