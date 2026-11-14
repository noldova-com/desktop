/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { CoverageAnalyzer, CoverageProject, CoverageReportWriter, CoverageResult } from "@noldova/context.testing";

import { Resources } from "../resources.ts";
import type { ICoverageCount } from "../totals/interfaces/i-coverage-count.ts";
import type { IPackageCoverage } from "./interfaces/i-package-coverage.ts";

export class PackageCoverage {
  public static readExclusions(text: string): readonly string[] {
    const entries: unknown = JSON.parse(text);
    return Array.isArray(entries)
      ? entries.flatMap((t: unknown) => Object.isPlainObject(t) ? PackageCoverage.readFile(JsonReader.fromValue(t)) : [])
      : [];
  }

  public static exclude(result: CoverageResult, packages: readonly IPackageCoverage[]): CoverageResult {
    const exclusions = new Map<string, readonly string[]>(packages.map(t => [t.name, PackageCoverage.readExclusions(t.exclusions)]));
    return new CoverageResult(result.fileCoverages.filter(t => !(exclusions.get(t.projectName) ?? []).includes(t.relativePath.split(path.sep).join(path.posix.sep))));
  }

  public static count(result: CoverageResult): ICoverageCount {
    return { unit: Resources.packageCoverageUnit, covered: result.executableFileCoverages.filter(t => t.isFullyCovered).length, total: result.executableFileCoverages.length };
  }

  public async measureAsync(coverageDirectory: string, packages: readonly IPackageCoverage[], output: Writable): Promise<CoverageResult> {
    const measured = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, packages.map(t => new CoverageProject(t.name, t.productionDirectory, t.sourceDirectory)));
    const result = PackageCoverage.exclude(measured, packages);
    for (const line of new CoverageReportWriter().formatLines(result, true))
      output.write(`${line}${Resources.lineEnd}`);
    if (!result.isComplete)
      output.write(Resources.packageCoverageIncomplete);
    return result;
  }

  private static readFile(entry: JsonReader): readonly string[] {
    return entry.hasField(Resources.fileField) ? [String(entry.readValue(Resources.fileField))] : [];
  }
}
