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
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = {
    NOLDOVA_DESKTOP_SIGNING_ENDPOINT: "https://other.codesigning.example.com/", NOLDOVA_DESKTOP_SIGNING_ACCOUNT: "other-signing", NOLDOVA_DESKTOP_SIGNING_PROFILE: "OtherApp"
  };
  private static readonly MISSING: string = "Signing Windows packages needs the Artifact Signing endpoint, account and certificate profile, "
    + "in NOLDOVA_DESKTOP_SIGNING_ENDPOINT, NOLDOVA_DESKTOP_SIGNING_ACCOUNT and NOLDOVA_DESKTOP_SIGNING_PROFILE or in desktop.product.windowsSigning in the root package.json.";

  @TestMethod
  public readsTheEndpointAccountAndProfile(): void {
    const account = WindowsSigningAccount.fromProduct(WindowsSigningAccountTests.VALID);

    Assert.areEqual("https://sample.codesigning.example.com/ sample-signing SampleApp", `${account.endpoint} ${account.account} ${account.profile}`);
  }

  @TestMethod
  public refusesAProductWithoutWindowsSigning(): void {
    const error = Assert.throws(() => WindowsSigningAccount.fromProduct(null), BuildException);

    Assert.areEqual(WindowsSigningAccountTests.MISSING, error.message);
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

  @TestMethod
  public takesTheAccountFromTheEnvironmentBeforeThePackageJsonBlock(): void {
    const account = WindowsSigningAccount.fromSources(WindowsSigningAccountTests.ENVIRONMENT, WindowsSigningAccountTests.VALID);

    Assert.areEqual("https://other.codesigning.example.com/ other-signing OtherApp", `${account.endpoint} ${account.account} ${account.profile}`);
  }

  @TestMethod
  public takesThePackageJsonBlockWhenTheEnvironmentSetsNoneOfTheAccount(): void {
    const account = WindowsSigningAccount.fromSources({ NOLDOVA_DESKTOP_SIGNING_ENDPOINT: String.empty }, WindowsSigningAccountTests.VALID);

    Assert.areEqual("https://sample.codesigning.example.com/ sample-signing SampleApp", `${account.endpoint} ${account.account} ${account.profile}`);
  }

  @TestMethod
  public refusesToSignWithNeitherTheEnvironmentNorThePackageJsonBlock(): void {
    const error = Assert.throws(() => WindowsSigningAccount.fromSources({}, null), BuildException);

    Assert.areEqual(WindowsSigningAccountTests.MISSING, error.message);
  }

  @TestMethod
  public refusesAnEnvironmentThatSetsOnlySomeOfTheAccount(): void {
    const environment: NodeJS.ProcessEnv = { NOLDOVA_DESKTOP_SIGNING_ENDPOINT: "https://other.codesigning.example.com/", NOLDOVA_DESKTOP_SIGNING_PROFILE: String.empty };
    const error = Assert.throws(() => WindowsSigningAccount.fromSources(environment, WindowsSigningAccountTests.VALID), BuildException);

    Assert.areEqual("Signing Windows packages with the account from the environment needs NOLDOVA_DESKTOP_SIGNING_ACCOUNT, NOLDOVA_DESKTOP_SIGNING_PROFILE as well, "
      + "since the environment sets the account in place of desktop.product.windowsSigning.", error.message);
  }

  @TestMethod
  public refusesAnEnvironmentValueThatIsNotAnEndpointOrAName(): void {
    const sign = (variable: string, value: string): string =>
      Assert.throws(() => WindowsSigningAccount.fromSources({ ...WindowsSigningAccountTests.ENVIRONMENT, [variable]: value }, null), BuildException).message;
    const expected = "must be a name of letters, digits and hyphens that starts and ends with a letter or digit.";

    Assert.areEqual("NOLDOVA_DESKTOP_SIGNING_ENDPOINT must be the HTTPS URL of the Artifact Signing endpoint, ending in /.", sign("NOLDOVA_DESKTOP_SIGNING_ENDPOINT", "http://other.example.com/"));
    Assert.areEqual(`NOLDOVA_DESKTOP_SIGNING_ACCOUNT ${expected}`, sign("NOLDOVA_DESKTOP_SIGNING_ACCOUNT", "-other"));
    Assert.areEqual(`NOLDOVA_DESKTOP_SIGNING_PROFILE ${expected}`, sign("NOLDOVA_DESKTOP_SIGNING_PROFILE", "Other App"));
  }
}
