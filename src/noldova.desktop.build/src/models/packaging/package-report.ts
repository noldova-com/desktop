/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../../resources.ts";
import { SourceArchive } from "./source-archive.ts";

export class PackageReport {
  public readonly target: string;
  public readonly isSigned: boolean;
  public readonly isChecked: boolean;
  public readonly isStarted: boolean;
  public readonly sources: readonly SourceArchive[];

  public constructor(target: string, isSigned: boolean, isChecked: boolean, isStarted: boolean = false, sources: readonly SourceArchive[] = []) {
    this.target = target;
    this.isSigned = isSigned;
    this.isChecked = isChecked;
    this.isStarted = isStarted;
    this.sources = sources;
  }

  public static parse(report: JsonReader): PackageReport | null {
    if (Object.keys(report.toJson()).length !== Resources.packageReportFieldCount
      || !report.hasField(Resources.packageReportTargetField) || !report.hasField(Resources.packageReportSignedField) || !report.hasField(Resources.packageReportCheckedField)
      || !report.hasField(Resources.packageReportStartedField) || !report.hasField(Resources.packageReportSourcesField))
      return null;
    const target = report.readValue(Resources.packageReportTargetField);
    const signed = report.readValue(Resources.packageReportSignedField);
    const checked = report.readValue(Resources.packageReportCheckedField);
    const started = report.readValue(Resources.packageReportStartedField);
    const listed = report.readValue(Resources.packageReportSourcesField);
    if (!Object.isString(target) || !Object.isBoolean(signed) || !Object.isBoolean(checked) || !Object.isBoolean(started) || !Array.isArray(listed))
      return null;
    const sources: SourceArchive[] = [];
    for (const item of listed) {
      const source = SourceArchive.parse(item);
      if (Object.isNull(source))
        return null;
      sources.push(source);
    }
    return new PackageReport(target, signed, checked, started, sources);
  }

  public static async markStartedAsync(file: string): Promise<void> {
    if (!existsSync(file))
      return;
    const report = PackageReport.parse(JsonReader.parse(await readFile(file, Resources.textEncoding)));
    if (!Object.isNull(report))
      await new PackageReport(report.target, report.isSigned, report.isChecked, true, report.sources).writeAsync(file);
  }

  public async writeAsync(file: string): Promise<void> {
    await writeFile(file, Resources.formatJsonFile({ target: this.target, signed: this.isSigned, checked: this.isChecked, started: this.isStarted, sources: this.sources.map(t => t.toJson()) }));
  }
}
