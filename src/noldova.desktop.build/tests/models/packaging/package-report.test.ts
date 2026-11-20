/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
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
  public readsAReportWithExactlyItsFourFields(): void {
    const report = PackageReport.parse(JsonReader.fromValue({ target: "windows-x64", signed: true, checked: false, started: true }));

    Assert.areEqual("{\"target\":\"windows-x64\",\"isSigned\":true,\"isChecked\":false,\"isStarted\":true}", JSON.stringify(report));
  }

  @TestMethod
  public readsNoReportWithOtherFieldsOrTypes(): void {
    const reports = [
      { target: "windows-x64", signed: true, checked: false },
      { target: "windows-x64", signed: true, checked: false, started: false, extra: 1 },
      { target: "windows-x64", signed: true, checked: false, other: false },
      { target: "windows-x64", signed: true, other: false, started: false },
      { target: "windows-x64", other: true, checked: false, started: false },
      { other: "windows-x64", signed: true, checked: false, started: false },
      { target: 1, signed: true, checked: false, started: false },
      { target: "windows-x64", signed: "yes", checked: false, started: false },
      { target: "windows-x64", signed: true, checked: "no", started: false },
      { target: "windows-x64", signed: true, checked: false, started: "no" }
    ];

    for (const report of reports)
      Assert.isNull(PackageReport.parse(JsonReader.fromValue(report)), JSON.stringify(report));
  }

  @TestMethod
  public writesItsFieldsAsJson(): Promise<void> {
    return PackageReportTests.withFolderAsync(async folder => {
      const file = path.join(folder, "report.json");

      await new PackageReport("macos-arm64", false, true).writeAsync(file);

      Assert.areEqual("{\n  \"target\": \"macos-arm64\",\n  \"signed\": false,\n  \"checked\": true,\n  \"started\": false\n}\n", await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public marksAWrittenReportStarted(): Promise<void> {
    return PackageReportTests.withFolderAsync(async folder => {
      const file = path.join(folder, "report.json");
      await new PackageReport("linux-arm64", false, true).writeAsync(file);

      await PackageReport.markStartedAsync(file);

      Assert.areEqual("{\n  \"target\": \"linux-arm64\",\n  \"signed\": false,\n  \"checked\": true,\n  \"started\": true\n}\n", await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public marksNoReportWhereNoneWasWritten(): Promise<void> {
    return PackageReportTests.withFolderAsync(async folder => {
      const file = path.join(folder, "report.json");

      await PackageReport.markStartedAsync(file);

      Assert.isFalse(existsSync(file));
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
