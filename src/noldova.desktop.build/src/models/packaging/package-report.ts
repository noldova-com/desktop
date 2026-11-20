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

export class PackageReport {
  public readonly target: string;
  public readonly isSigned: boolean;
  public readonly isChecked: boolean;
  public readonly isStarted: boolean;

  public constructor(target: string, isSigned: boolean, isChecked: boolean, isStarted: boolean = false) {
    this.target = target;
    this.isSigned = isSigned;
    this.isChecked = isChecked;
    this.isStarted = isStarted;
  }

  public static parse(report: JsonReader): PackageReport | null {
    if (Object.keys(report.toJson()).length !== Resources.packageReportFieldCount
      || !report.hasField(Resources.packageReportTargetField) || !report.hasField(Resources.packageReportSignedField) || !report.hasField(Resources.packageReportCheckedField)
      || !report.hasField(Resources.packageReportStartedField))
      return null;
    const target = report.readValue(Resources.packageReportTargetField);
    const signed = report.readValue(Resources.packageReportSignedField);
    const checked = report.readValue(Resources.packageReportCheckedField);
    const started = report.readValue(Resources.packageReportStartedField);
    if (!Object.isString(target) || !Object.isBoolean(signed) || !Object.isBoolean(checked) || !Object.isBoolean(started))
      return null;
    return new PackageReport(target, signed, checked, started);
  }

  public static async markStartedAsync(file: string): Promise<void> {
    if (!existsSync(file))
      return;
    const report = PackageReport.parse(JsonReader.parse(await readFile(file, Resources.textEncoding)));
    if (!Object.isNull(report))
      await new PackageReport(report.target, report.isSigned, report.isChecked, true).writeAsync(file);
  }

  public async writeAsync(file: string): Promise<void> {
    await writeFile(file, Resources.formatJsonFile({ target: this.target, signed: this.isSigned, checked: this.isChecked, started: this.isStarted }));
  }
}
