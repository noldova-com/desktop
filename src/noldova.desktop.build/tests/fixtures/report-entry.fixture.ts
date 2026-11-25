/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PackageReport } from "../../src/models/packaging/package-report.js";

export class ReportEntryFixture {
  public readonly id: string;
  public readonly report: PackageReport | string | null;

  public constructor(id: string, report: PackageReport | string | null) {
    this.id = id;
    this.report = report;
  }
}
