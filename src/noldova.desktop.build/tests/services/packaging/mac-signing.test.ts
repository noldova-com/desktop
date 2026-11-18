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
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { MacSigning } from "../../../src/services/packaging/mac-signing.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { PausedTimersFixture } from "../../fixtures/paused-timers.fixture.js";
import { Resources } from "../../../src/resources.js";

class NotarizingRunner extends ProcessRunner {
  private static readonly ACCEPTED: ProcessResult = new ProcessResult(0, "{\"id\":\"submission-1\",\"status\":\"Accepted\"}", String.empty);

  private readonly results: readonly ProcessResult[];
  private readonly submission: ProcessResult;

  public staples: number = 0;
  public submissions: number = 0;

  public constructor(results: readonly ProcessResult[], submission: ProcessResult = NotarizingRunner.ACCEPTED) {
    super();
    this.results = results;
    this.submission = submission;
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    const [, commandArguments] = call;
    if (commandArguments.includes("notarytool")) {
      this.submissions++;
      return Promise.resolve(this.submission);
    }
    return Promise.resolve(this.results[this.staples++] ?? new ProcessResult(65, "no more staple results", String.empty));
  }
}

@TestClass
export class MacSigningTests {
  private static readonly PAUSE: number = 5_000;
  private static readonly PRODUCT: ProductIdentity = new ProductIdentity("Sample App", "Sample", "sample-app", "com.example.sample", "com.example.sample.development",
    ".sample/app", ["Sample/App", "Sample/App", "sample/app"], "SAMPLE_APP_DATA_DIR", "assets/icons", "example/sample-app");
  private static readonly IMAGE: string = path.join(tmpdir(), "Sample-1.2.3-macos-arm64.dmg");
  private static readonly STAPLED: ProcessResult = new ProcessResult(0, "Processing: Sample.dmg\nThe staple and validate action worked!\n", String.empty);
  private static readonly NETWORK_LOST: ProcessResult = new ProcessResult(68, [
    "Processing: Sample.dmg",
    "error is Error Domain=NSURLErrorDomain Code=-1005 \"The network connection was lost.\"",
    "The staple and validate action failed! Error 68."
  ].join("\n"), String.empty);
  private static readonly MISSING: ProcessResult = new ProcessResult(65, "Processing: Sample.dmg\nCould not find base64 encoded ticket in response.\nThe staple and validate action failed! Error 65.\n", String.empty);

  @TestMethod
  public async staplesTheTicketAgainWhenAppleNetworkConnectionDrops(): Promise<void> {
    const runner = new NotarizingRunner([MacSigningTests.NETWORK_LOST, MacSigningTests.STAPLED]);

    const report = await PausedTimersFixture.withoutPausesAsync(() => MacSigningTests.signing(runner).finishAsync([MacSigningTests.IMAGE]), MacSigningTests.PAUSE);

    Assert.areEqual(`${MacSigningTests.IMAGE}: Apple accepted notarization submission submission-1, and its ticket is stapled.\n 2`, `${report} ${runner.staples}`);
  }

  @TestMethod
  public async refusesATicketStaplerStapleCannotReachAppleForInThreeAttempts(): Promise<void> {
    const runner = new NotarizingRunner(Array.from({ length: 4 }, () => MacSigningTests.NETWORK_LOST));

    const message = await MacSigningTests.messageAsync(PausedTimersFixture.withoutPausesAsync(() => MacSigningTests.signing(runner).finishAsync([MacSigningTests.IMAGE]), MacSigningTests.PAUSE));

    Assert.isTrue(message.startsWith(`The notarization ticket could not be stapled to the disk image ${MacSigningTests.IMAGE}, as stapler staple lost its network connection on all 3 attempts:\n`),
      message);
    Assert.isTrue(message.includes("NSURLErrorDomain"), message);
    Assert.areEqual(3, runner.staples);
  }

  @TestMethod
  public async refusesAMissingTicketAtOnce(): Promise<void> {
    const runner = new NotarizingRunner([MacSigningTests.MISSING, MacSigningTests.STAPLED]);

    const message = await MacSigningTests.messageAsync(PausedTimersFixture.withoutPausesAsync(() => MacSigningTests.signing(runner).finishAsync([MacSigningTests.IMAGE]), MacSigningTests.PAUSE));

    Assert.isTrue(message.startsWith(`The notarization ticket could not be stapled to the disk image ${MacSigningTests.IMAGE}:\n`), message);
    Assert.isTrue(message.includes("Could not find base64 encoded ticket"), message);
    Assert.areEqual(1, runner.staples);
  }

  @TestMethod
  public async notarizesOnlyTheDiskImagesAndReportsEachOnALineOfItsOwn(): Promise<void> {
    const runner = new NotarizingRunner([MacSigningTests.STAPLED]);
    const archive = MacSigningTests.IMAGE.replace(".dmg", ".zip");

    const report = await MacSigningTests.signing(runner).finishAsync([archive, MacSigningTests.IMAGE]);

    Assert.areEqual(`${MacSigningTests.IMAGE}: Apple accepted notarization submission submission-1, and its ticket is stapled.\n`, report);
    Assert.areEqual(1, runner.submissions);
  }

  @TestMethod
  public async refusesADiskImageAppleDidNotAccept(): Promise<void> {
    const invalid = new ProcessResult(0, "{\"id\":\"submission-1\",\"status\":\"Invalid\"}", String.empty);
    const failed = new ProcessResult(1, "Error: HTTP status code: 401. Unauthenticated.", String.empty);
    const anonymous = new ProcessResult(0, "{\"status\":\"Accepted\"}", String.empty);

    const messages = await Promise.all([invalid, failed, anonymous].map(t => MacSigningTests.messageAsync(MacSigningTests.signing(new NotarizingRunner([], t))
      .finishAsync([MacSigningTests.IMAGE]))));

    Assert.areEqual(`Apple did not notarize the disk image ${MacSigningTests.IMAGE}:\n${invalid.text}`, messages[0]);
    Assert.areEqual(`Apple did not notarize the disk image ${MacSigningTests.IMAGE}:\n${failed.text}`, messages[1]);
    Assert.areEqual(`Apple did not notarize the disk image ${MacSigningTests.IMAGE}:\n${anonymous.text}`, messages[2]);
  }

  @TestMethod
  public refusesCredentialsThatAreMissingOrEmpty(): void {
    const error = Assert.throws(() => new MacSigning(new NotarizingRunner([]), path.join(tmpdir(), "mac-signing-sample"), {}, { MAC_CERTIFICATE: "sample", APPLE_API_KEY_ID: String.empty }),
      BuildException);

    Assert.areEqual("Signing macOS packages needs MAC_CERTIFICATE_PASSWORD, APPLE_API_KEY_P8, APPLE_API_KEY_ID, APPLE_API_ISSUER, the Developer ID Application certificate "
      + "and the App Store Connect key that notarizes.", error.message);
  }

  @TestMethod
  public refusesAnInstallerPackageWithoutTheDeveloperIdInstallerCertificate(): void {
    const missing = Assert.throws(() => new MacSigning(new NotarizingRunner([]), path.join(tmpdir(), "mac-signing-sample"), {}, MacSigningTests.credentials(), true),
      BuildException);
    const empty = Assert.throws(() => new MacSigning(new NotarizingRunner([]), path.join(tmpdir(), "mac-signing-sample"), {},
      { ...MacSigningTests.credentials(), MAC_INSTALLER_CERTIFICATE: "sample", MAC_INSTALLER_CERTIFICATE_PASSWORD: String.empty }, true), BuildException);

    Assert.areEqual("Signing the macOS installer package of an app that names an install folder needs MAC_INSTALLER_CERTIFICATE, MAC_INSTALLER_CERTIFICATE_PASSWORD, "
      + "the Developer ID Installer certificate.", missing.message);
    Assert.areEqual("Signing the macOS installer package of an app that names an install folder needs MAC_INSTALLER_CERTIFICATE_PASSWORD, the Developer ID Installer certificate.",
      empty.message);
  }

  @TestMethod
  public passesTheDeveloperIdInstallerCertificateToElectronBuilderForAnInstallerPackage(): void {
    const signing = new MacSigning(new NotarizingRunner([]), path.join(tmpdir(), "mac-signing-sample"), {}, {
      ...MacSigningTests.credentials(), MAC_INSTALLER_CERTIFICATE: "MAC_INSTALLER_CERTIFICATE", MAC_INSTALLER_CERTIFICATE_PASSWORD: "MAC_INSTALLER_CERTIFICATE_PASSWORD"
    }, true);

    Assert.areEqual("MAC_INSTALLER_CERTIFICATE|MAC_INSTALLER_CERTIFICATE_PASSWORD", [signing.builderEnvironment["CSC_INSTALLER_LINK"],
      signing.builderEnvironment["CSC_INSTALLER_KEY_PASSWORD"]].join("|"));
  }

  @TestMethod
  public async writesTheNotarizationKeyForElectronBuilderAndRemovesItWhenDisposed(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "mac-signing-"));
    try {
      const signing = new MacSigning(new NotarizingRunner([]), path.join(folder, "signing"), {}, MacSigningTests.credentials());
      const key = path.join(folder, "signing", "notarization-key.p8");

      await signing.prepareAsync();
      const written = await readFile(key, "utf8");
      await signing.disposeAsync();

      Assert.areEqual("APPLE_API_KEY_P8", written);
      Assert.areEqual(JSON.stringify({
        CSC_IDENTITY_AUTO_DISCOVERY: "true",
        CSC_LINK: "MAC_CERTIFICATE",
        CSC_KEY_PASSWORD: "MAC_CERTIFICATE_PASSWORD",
        APPLE_API_KEY: key,
        APPLE_API_KEY_ID: "APPLE_API_KEY_ID",
        APPLE_API_ISSUER: "APPLE_API_ISSUER"
      }), JSON.stringify(signing.builderEnvironment));
      Assert.isNull(signing.windowsPublisher);
      Assert.isFalse(existsSync(path.join(folder, "signing")));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async verifiesNoPackageWhenGivenNone(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "mac-signing-"));
    try {
      const signing = new MacSigning(new NotarizingRunner([]), folder, {}, MacSigningTests.credentials());

      const report = await signing.verifyAsync([], MacSigningTests.PRODUCT);

      Assert.areEqual(String.empty, report);
      Assert.isFalse(existsSync(path.join(folder, "check")));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static credentials(): NodeJS.ProcessEnv {
    return Object.fromEntries(Resources.macSigningCredentials.map(t => [t, t]));
  }

  private static signing(runner: ProcessRunner): MacSigning {
    const credentials = Object.fromEntries(Resources.macSigningCredentials.map(t => [t, "sample"]));
    return new MacSigning(runner, path.join(tmpdir(), "mac-signing-sample"), {}, credentials);
  }

  private static async messageAsync(signing: Promise<string>): Promise<string> {
    let error: unknown = null;
    try {
      await signing;
    }
    catch (thrown) {
      error = thrown;
    }
    Assert.isTrue(error instanceof BuildException, String(error));
    return error instanceof Error ? error.message : String(error);
  }
}
