/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";

import { Resources } from "../../resources.ts";

export class PackageReport {
  public readonly target: string;
  public readonly isSigned: boolean;
  public readonly isChecked: boolean;

  public constructor(target: string, isSigned: boolean, isChecked: boolean) {
    this.target = target;
    this.isSigned = isSigned;
    this.isChecked = isChecked;
  }

  public static parse(report: JsonReader): PackageReport | null {
    if (Object.keys(report.toJson()).length !== Resources.packageReportFieldCount
      || !report.hasField(Resources.packageReportTargetField) || !report.hasField(Resources.packageReportSignedField) || !report.hasField(Resources.packageReportCheckedField))
      return null;
    const target = report.readValue(Resources.packageReportTargetField);
    const signed = report.readValue(Resources.packageReportSignedField);
    const checked = report.readValue(Resources.packageReportCheckedField);
    if (!Object.isString(target) || !Object.isBoolean(signed) || !Object.isBoolean(checked))
      return null;
    return new PackageReport(target, signed, checked);
  }

  public async writeAsync(file: string): Promise<void> {
    await writeFile(file, Resources.formatJsonFile({ target: this.target, signed: this.isSigned, checked: this.isChecked }));
  }
}
