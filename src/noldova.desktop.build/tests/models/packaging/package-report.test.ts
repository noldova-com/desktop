/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PackageReport } from "../../../src/models/packaging/package-report.js";

@TestClass
export class PackageReportTests {
  @TestMethod
  public readsAReportWithExactlyItsThreeFields(): void {
    const report = PackageReport.parse(JsonReader.fromValue({ target: "windows-x64", signed: true, checked: false }));

    Assert.areEqual("{\"target\":\"windows-x64\",\"isSigned\":true,\"isChecked\":false}", JSON.stringify(report));
  }

  @TestMethod
  public readsNoReportWithOtherFieldsOrTypes(): void {
    const reports = [
      { target: "windows-x64", signed: true },
      { target: "windows-x64", signed: true, checked: false, extra: 1 },
      { target: "windows-x64", signed: true, other: false },
      { target: "windows-x64", other: true, checked: false },
      { other: "windows-x64", signed: true, checked: false },
      { target: 1, signed: true, checked: false },
      { target: "windows-x64", signed: "yes", checked: false },
      { target: "windows-x64", signed: true, checked: "no" }
    ];

    for (const report of reports)
      Assert.isNull(PackageReport.parse(JsonReader.fromValue(report)), JSON.stringify(report));
  }

  @TestMethod
  public writesItsFieldsAsJson(): Promise<void> {
    return PackageReportTests.withFolderAsync(async folder => {
      const file = path.join(folder, "report.json");

      await new PackageReport("macos-arm64", false, true).writeAsync(file);

      Assert.areEqual("{\n  \"target\": \"macos-arm64\",\n  \"signed\": false,\n  \"checked\": true\n}\n", await readFile(file, "utf8"));
    });
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "package-report-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
