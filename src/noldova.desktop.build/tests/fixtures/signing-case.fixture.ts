/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PackageReport } from "../../src/models/packaging/package-report.js";

export class SigningCaseFixture {
  public readonly report: PackageReport;
  public readonly signed: readonly string[];
  public readonly problem: string;

  public constructor(report: PackageReport, signed: readonly string[], problem: string) {
    this.report = report;
    this.signed = signed;
    this.problem = problem;
  }
}
