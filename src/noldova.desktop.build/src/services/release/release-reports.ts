/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";
import { CodePointComparer } from "@noldova/context.text";

import { PackageReport } from "../../models/packaging/package-report.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import type { SourceArchive } from "../../models/packaging/source-archive.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { IVerifiedReports } from "../../interfaces/i-verified-reports.ts";
import { Resources } from "../../resources.ts";

export class ReleaseReports {
  private readonly signedPlatforms: readonly string[];
  private readonly targets: readonly PackageTarget[];

  public constructor(signedPlatforms: readonly string[], targets: readonly PackageTarget[]) {
    this.signedPlatforms = signedPlatforms;
    this.targets = targets;
  }

  public async verifyAsync(folder: string): Promise<IVerifiedReports> {
    let entries: Dirent[];
    try {
      entries = await readdir(folder, { withFileTypes: true });
    }
    catch (error) {
      throw new BuildException(Resources.formatReportsUnreadable(folder), new ExceptionOptions(error));
    }
    const problems: string[] = [];
    const reports: PackageReport[] = [];
    for (const entry of entries.sort((left, right) => CodePointComparer.compare(left.name, right.name))) {
      const report = await ReleaseReports.readAsync(folder, entry);
      if (Object.isString(report))
        problems.push(report);
      else
        reports.push(report);
    }
    for (const report of reports.filter(t => !this.targets.some(u => u.id === t.target)))
      problems.push(Resources.formatReportForeignTarget(report.target));
    for (const target of this.targets) {
      const matching = reports.filter(t => t.target === target.id);
      const isSigned = this.signedPlatforms.includes(target.platform);
      const [report] = matching;
      if (Object.isUndefined(report))
        problems.push(Resources.formatReportMissing(target.id));
      else if (matching.length > 1)
        problems.push(Resources.formatReportsDuplicated(matching.length, target.id));
      else if (report.isSigned !== isSigned || report.isChecked !== isSigned)
        problems.push(Resources.formatReportSigningMismatch(target.id, ReleaseReports.describe(report), isSigned, target.platform));
    }
    const sources = new Map<string, SourceArchive>();
    for (const source of reports.flatMap(t => t.sources)) {
      const known = sources.get(source.url);
      if (Object.isUndefined(known))
        sources.set(source.url, source);
      else if (!known.isSame(source) && !problems.includes(Resources.formatReportSourceArchivesDiffer(source.url)))
        problems.push(Resources.formatReportSourceArchivesDiffer(source.url));
    }
    if (problems.length > 0)
      throw new BuildException(Resources.formatReportsMismatch(problems));
    return { text: Resources.formatReportsVerified(this.signedPlatforms), unstarted: this.targets.filter(t => !reports.some(u => u.target === t.id && u.isStarted)),
      sources: [...sources.values()] };
  }

  private static async readAsync(folder: string, entry: Dirent): Promise<PackageReport | string> {
    const missing = Resources.formatReportFolderEmpty(entry.name);
    if (!entry.isDirectory())
      return missing;
    let text: string;
    try {
      text = await readFile(path.join(folder, entry.name, Resources.packageReportFile), Resources.textEncoding);
    }
    catch (error) {
      return error instanceof Error && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.fileNotFoundCode ? missing : Resources.formatReportUnreadable(entry.name);
    }
    let report: JsonReader;
    try {
      report = JsonReader.parse(text);
    }
    catch {
      return missing;
    }
    return PackageReport.parse(report) ?? missing;
  }

  private static describe(report: PackageReport): string {
    if (report.isSigned)
      return report.isChecked ? Resources.reportSignedChecked : Resources.reportSignedUnchecked;
    return report.isChecked ? Resources.reportUnsignedChecked : Resources.reportUnsigned;
  }
}
