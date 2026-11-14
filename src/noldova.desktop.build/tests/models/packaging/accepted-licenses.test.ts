/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { AcceptedLicenses } from "../../../src/models/packaging/accepted-licenses.js";

@TestClass
export class AcceptedLicensesTests {
  @TestMethod
  public async readsTheLicenseTheAppAcceptsForEachPackage(): Promise<void> {
    const accepted = await AcceptedLicensesTests.readAsync({
      "@scope/sample@1.0.0": { license: "Custom-1.0", reason: "Reviewed." },
      "@scope/sample@2.0.0": { license: "Custom-2.0", reason: "Reviewed." },
      "other@1.0.0": { license: "Custom-1.0", reason: "Reviewed." }
    });

    Assert.areEqual("Custom-2.0", accepted.of("@scope/sample@2.0.0"));
    Assert.isNull(accepted.of("@scope/sample@3.0.0"));
    Assert.areEqual("@scope/sample@1.0.0,@scope/sample@2.0.0,other@1.0.0", accepted.ids.join(","));
    Assert.areEqual("@scope/sample@1.0.0,@scope/sample@2.0.0", accepted.listOtherVersions("@scope/sample@3.0.0").join(","));
    Assert.areEqual("@scope/sample@2.0.0", accepted.listOtherVersions("@scope/sample@1.0.0").join(","));
  }

  @TestMethod
  public async refusesAnEntryWithoutAReason(): Promise<void> {
    await Assert.throwsAsync(() => AcceptedLicensesTests.readAsync({ "sample@1.0.0": { license: "Custom-1.0" } }), BuildException);
  }

  @TestMethod
  public acceptsNothingByDefault(): void {
    const accepted = new AcceptedLicenses();

    Assert.isNull(accepted.of("sample@1.0.0"));
    Assert.areEqual(0, accepted.ids.length);
  }

  private static async readAsync(licenses: object): Promise<AcceptedLicenses> {
    const root = await mkdtemp(path.join(tmpdir(), "accepted-licenses-"));
    try {
      await writeFile(path.join(root, "package.json"), JSON.stringify({ desktop: { packaging: { acceptedLicenses: licenses } } }));
      return await AcceptedLicenses.readAsync(root);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
