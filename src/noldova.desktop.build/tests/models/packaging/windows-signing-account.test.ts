/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { WindowsSigningAccount } from "../../../src/models/packaging/windows-signing-account.js";

@TestClass
export class WindowsSigningAccountTests {
  private static readonly VALID: Readonly<Record<string, unknown>> = { endpoint: "https://sample.codesigning.example.com/", account: "sample-signing", profile: "SampleApp" };

  @TestMethod
  public readsTheEndpointAccountAndProfile(): void {
    const account = WindowsSigningAccount.fromProduct(WindowsSigningAccountTests.VALID);

    Assert.areEqual("https://sample.codesigning.example.com/ sample-signing SampleApp", `${account.endpoint} ${account.account} ${account.profile}`);
  }

  @TestMethod
  public refusesAProductWithoutWindowsSigning(): void {
    const error = Assert.throws(() => WindowsSigningAccount.fromProduct(null), BuildException);

    Assert.areEqual("Signing Windows packages needs desktop.product.windowsSigning in the root package.json, with the Artifact Signing endpoint, account and certificate profile.",
      error.message);
  }

  @TestMethod
  public refusesAnEndpointThatIsNotAnHttpsFolderUrl(): void {
    for (const endpoint of ["http://sample.example.com/", "https://sample.example.com", 1]) {
      const error = Assert.throws(() => WindowsSigningAccount.fromProduct({ ...WindowsSigningAccountTests.VALID, endpoint }), BuildException);

      Assert.areEqual("desktop.product.windowsSigning.endpoint in the root package.json must be the HTTPS URL of the Artifact Signing endpoint, ending in /.", error.message);
    }
  }

  @TestMethod
  public refusesAnAccountOrProfileThatIsNotAName(): void {
    const account = Assert.throws(() => WindowsSigningAccount.fromProduct({ ...WindowsSigningAccountTests.VALID, account: "-sample" }), BuildException);
    const profile = Assert.throws(() => WindowsSigningAccount.fromProduct({ ...WindowsSigningAccountTests.VALID, profile: undefined }), BuildException);
    const expected = "in the root package.json must be a name of letters, digits and hyphens that starts and ends with a letter or digit.";

    Assert.areEqual(`desktop.product.windowsSigning.account ${expected}`, account.message);
    Assert.areEqual(`desktop.product.windowsSigning.profile ${expected}`, profile.message);
  }
}
