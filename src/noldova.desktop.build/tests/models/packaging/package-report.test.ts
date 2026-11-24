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
import { SourceArchive } from "../../../src/models/packaging/source-archive.js";

@TestClass
export class PackageReportTests {
  private static readonly SOURCE: { readonly url: string; readonly size: number; readonly sha256: string } =
    { url: "https://example.com/releases/download/sources-1/sample-source.tar", size: 10, sha256: "ab".repeat(32) };

  @TestMethod
  public readsAReportWithExactlyItsFiveFields(): void {
    const report = PackageReport.parse(JsonReader.fromValue({ target: "windows-x64", signed: true, checked: false, started: true, sources: [PackageReportTests.SOURCE] }));

    Assert.areEqual(`{"target":"windows-x64","isSigned":true,"isChecked":false,"isStarted":true,"sources":[${JSON.stringify(PackageReportTests.SOURCE)}]}`, JSON.stringify(report));
  }

  @TestMethod
  public readsNoReportWithOtherFieldsOrTypes(): void {
    const reports = [
      { target: "windows-x64", signed: true, checked: false, started: false },
      { target: "windows-x64", signed: true, checked: false, started: false, sources: [], extra: 1 },
      { target: "windows-x64", signed: true, checked: false, other: false, sources: [] },
      { target: "windows-x64", signed: true, other: false, started: false, sources: [] },
      { target: "windows-x64", other: true, checked: false, started: false, sources: [] },
      { other: "windows-x64", signed: true, checked: false, started: false, sources: [] },
      { target: "windows-x64", signed: true, checked: false, started: false, other: [] },
      { target: 1, signed: true, checked: false, started: false, sources: [] },
      { target: "windows-x64", signed: "yes", checked: false, started: false, sources: [] },
      { target: "windows-x64", signed: true, checked: "no", started: false, sources: [] },
      { target: "windows-x64", signed: true, checked: false, started: "no", sources: [] },
      { target: "windows-x64", signed: true, checked: false, started: false, sources: PackageReportTests.SOURCE },
      { target: "windows-x64", signed: true, checked: false, started: false, sources: [PackageReportTests.SOURCE, { ...PackageReportTests.SOURCE, size: -1 }] }
    ];

    for (const report of reports)
      Assert.isNull(PackageReport.parse(JsonReader.fromValue(report)), JSON.stringify(report));
  }

  @TestMethod
  public writesItsFieldsAsJson(): Promise<void> {
    return PackageReportTests.withFolderAsync(async folder => {
      const file = path.join(folder, "report.json");

      await new PackageReport("macos-arm64", false, true).writeAsync(file);

      Assert.areEqual("{\n  \"target\": \"macos-arm64\",\n  \"signed\": false,\n  \"checked\": true,\n  \"started\": false,\n  \"sources\": []\n}\n", await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public marksAWrittenReportStarted(): Promise<void> {
    return PackageReportTests.withFolderAsync(async folder => {
      const file = path.join(folder, "report.json");
      const source = SourceArchive.parse(PackageReportTests.SOURCE);
      await new PackageReport("linux-arm64", false, true, false, Object.isNull(source) ? [] : [source]).writeAsync(file);

      await PackageReport.markStartedAsync(file);

      Assert.areEqual(`{\n  "target": "linux-arm64",\n  "signed": false,\n  "checked": true,\n  "started": true,\n  "sources": [\n    {\n      "url": "${PackageReportTests.SOURCE.url}",\n`
        + `      "size": 10,\n      "sha256": "${PackageReportTests.SOURCE.sha256}"\n    }\n  ]\n}\n`, await readFile(file, "utf8"));
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
