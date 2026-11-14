/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PackageLayout } from "../../../src/services/packaging/package-layout.js";

@TestClass
export class PackageLayoutTests {
  private static readonly ROOT: string = path.resolve("sample-app");
  private static readonly FOLDER: string = path.join(PackageLayoutTests.ROOT, "_build", "package");

  @TestMethod
  public placesEveryPackagingFolderAndFileUnderTheAppsPackageFolder(): void {
    const layout = new PackageLayout(PackageLayoutTests.ROOT);

    Assert.areEqual(JSON.stringify([
      "app", path.join("app", "_build", "product.json"), "npm-cache", "electron", "tool-cache", "out", "smoke", "command", "signing", "archive-check",
      "electron-builder.json", "package-report.json", "third-party", "company", "runtime-third-party.txt"
    ].map(t => path.join(PackageLayoutTests.FOLDER, t))), JSON.stringify([
      layout.stage, layout.stagedProduct, layout.npmCache, layout.electron, layout.toolCache, layout.output, layout.smoke, layout.command, layout.signing,
      layout.archiveCheck, layout.configuration, layout.report, layout.thirdParty, layout.company, layout.thirdPartyLicenses
    ]));
  }
}
