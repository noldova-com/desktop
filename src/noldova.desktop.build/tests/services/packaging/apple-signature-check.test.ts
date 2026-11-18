/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { AppleSignatureCheck } from "../../../src/services/packaging/apple-signature-check.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { PausedTimersFixture } from "../../fixtures/paused-timers.fixture.js";

class StaplerRunner extends ProcessRunner {
  private readonly staples: readonly ProcessResult[];
  private readonly isSigned: boolean;

  public validations: number = 0;
  public readonly required: string[] = [];

  public constructor(staples: readonly ProcessResult[], isSigned: boolean = true) {
    super();
    this.staples = staples;
    this.isSigned = isSigned;
  }

  public override requireAsync(...call: Parameters<ProcessRunner["requireAsync"]>): Promise<void> {
    const [command, commandArguments] = call;
    this.required.push(`${command} ${commandArguments[0] ?? String.empty}`);
    return Promise.resolve();
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    const [command, commandArguments] = call;
    if (command === "xcrun")
      return Promise.resolve(this.staples[this.validations++] ?? StaplerRunner.failure("no more staple results"));
    if (!this.isSigned)
      return Promise.resolve(new ProcessResult(1, "Sample.app: code object is not signed at all\n", String.empty));
    if (commandArguments.includes("--display"))
      return Promise.resolve(new ProcessResult(0, String.empty, "Authority=Developer ID Application: Sample Publisher (SAMPLE1234)\n"));
    if (command === "spctl")
      return Promise.resolve(new ProcessResult(0, String.empty, "Sample.app: accepted\nsource=Notarized Developer ID\n"));
    return Promise.resolve(new ProcessResult(0, String.empty, "Sample.app: valid on disk\n"));
  }

  public static failure(text: string): ProcessResult {
    return new ProcessResult(65, `Processing: Sample.app\n${text}\nThe validate action failed! Error 65.\n`, String.empty);
  }
}

class InstallerRunner extends StaplerRunner {
  private readonly authority: string;
  private readonly hasApp: boolean;

  public constructor(staples: readonly ProcessResult[], authority: string = "Developer ID Installer", hasApp: boolean = true, isSigned: boolean = true) {
    super(staples, isSigned);
    this.authority = authority;
    this.hasApp = hasApp;
  }

  public override async requireAsync(...call: Parameters<ProcessRunner["requireAsync"]>): Promise<void> {
    await super.requireAsync(...call);
    const [, commandArguments] = call;
    const expanded = commandArguments[2] ?? String.empty;
    await mkdir(path.join(expanded, "Sample.pkg", "Payload", this.hasApp ? "Sample.app" : "Other.app"), { recursive: true });
    await mkdir(path.join(expanded, "Resources"));
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    const [command] = call;
    if (command === "pkgutil" && this.authority.length > 0)
      return Promise.resolve(new ProcessResult(0, `Package "Sample.pkg":\n   Status: signed by a developer certificate issued by Apple for distribution\n`
        + `   Notarization: trusted by the Apple notary service\n   Certificate Chain:\n    1. ${this.authority}: Sample Publisher (SAMPLE1234)\n`, String.empty));
    return super.captureAsync(...call);
  }
}

@TestClass
export class AppleSignatureCheckTests {
  private static readonly PAUSE: number = 5_000;
  private static readonly STAPLED: ProcessResult = new ProcessResult(0, "Processing: Sample.app\nThe validate action worked!\n", String.empty);
  private static readonly NETWORK_LOST: ProcessResult = new ProcessResult(68, [
    "Processing: Sample.app",
    "error is Error Domain=NSURLErrorDomain Code=-1005 \"The network connection was lost.\"",
    "CloudKit's response is inconsistent with expections: (null)",
    "The validate action failed! Error 68."
  ].join("\n"), String.empty);
  private static readonly MISSING: ProcessResult = StaplerRunner.failure("Sample.app does not have a ticket stapled to it.");

  @TestMethod
  public validatesTheStapledTicketAgainWhenAppleNetworkConnectionDrops(): Promise<void> {
    return AppleSignatureCheckTests.withCheckAsync([AppleSignatureCheckTests.NETWORK_LOST, AppleSignatureCheckTests.STAPLED], async (check, runner, archive) => {
      const report = await check.verifyAsync([archive], "Sample");

      Assert.areEqual(`${archive}: a valid Developer ID Application signature, notarized and stapled. 2`, `${report} ${runner.validations}`);
    });
  }

  @TestMethod
  public refusesAMissingTicketAtOnce(): Promise<void> {
    return AppleSignatureCheckTests.withCheckAsync([AppleSignatureCheckTests.MISSING, AppleSignatureCheckTests.STAPLED], async (check, runner, archive) => {
      const message = await AppleSignatureCheckTests.messageAsync(check.verifyAsync([archive], "Sample"));

      Assert.isTrue(message.startsWith(`The app in ${archive} lacks a stapled ticket:\n`), message);
      Assert.isTrue(message.includes("does not have a ticket stapled to it."), message);
      Assert.areEqual(1, runner.validations);
    });
  }

  @TestMethod
  public refusesATicketStaplerValidateCannotReachAppleForInThreeAttempts(): Promise<void> {
    return AppleSignatureCheckTests.withCheckAsync(Array.from({ length: 4 }, () => AppleSignatureCheckTests.NETWORK_LOST), async (check, runner, archive) => {
      const message = await AppleSignatureCheckTests.messageAsync(check.verifyAsync([archive], "Sample"));

      Assert.isTrue(message.startsWith(`The app in ${archive} lacks a stapled ticket confirmed by stapler validate, which lost its network connection on all 3 attempts:\n`),
        message);
      Assert.isTrue(message.includes("NSURLErrorDomain"), message);
      Assert.areEqual(3, runner.validations);
    });
  }

  @TestMethod
  public verifiesADiskImageAndTheAppInsideIt(): Promise<void> {
    return AppleSignatureCheckTests.withCheckAsync([AppleSignatureCheckTests.STAPLED, AppleSignatureCheckTests.STAPLED], async (check, runner, archive) => {
      const image = archive.replace(".zip", ".dmg");

      const report = await check.verifyAsync([image], "Sample");

      Assert.areEqual(`${image}: the disk image and its app each have a valid Developer ID Application signature, notarized and stapled.`, report);
      Assert.areEqual("hdiutil attach,hdiutil detach", runner.required.join(","));
      Assert.areEqual(2, runner.validations);
    });
  }

  @TestMethod
  public verifiesEachPackageOnALineOfItsOwn(): Promise<void> {
    return AppleSignatureCheckTests.withCheckAsync([AppleSignatureCheckTests.STAPLED, AppleSignatureCheckTests.STAPLED], async (check, runner, archive) => {
      const second = archive.replace("arm64", "x64");

      const report = await check.verifyAsync([archive, second], "Sample");

      Assert.areEqual([archive, second].map(t => `${t}: a valid Developer ID Application signature, notarized and stapled.`).join("\n"), report);
      Assert.areEqual("ditto -x,ditto -x", runner.required.join(","));
    });
  }

  @TestMethod
  public refusesAnUnsignedDiskImageBeforeAttachingIt(): Promise<void> {
    return AppleSignatureCheckTests.withCheckAsync([AppleSignatureCheckTests.STAPLED], async (check, runner, archive) => {
      const image = archive.replace(".zip", ".dmg");

      const message = await AppleSignatureCheckTests.messageAsync(check.verifyAsync([image], "Sample"));

      Assert.isTrue(message.startsWith(`The disk image ${image} lacks a valid signature, a Developer ID Application signature, notarization:\n`), message);
      Assert.areEqual(0, runner.required.length);
    }, false);
  }

  @TestMethod
  public detachesTheDiskImageWhenItsAppIsRefused(): Promise<void> {
    return AppleSignatureCheckTests.withCheckAsync([AppleSignatureCheckTests.STAPLED, AppleSignatureCheckTests.MISSING], async (check, runner, archive) => {
      const image = archive.replace(".zip", ".dmg");

      const message = await AppleSignatureCheckTests.messageAsync(check.verifyAsync([image], "Sample"));

      Assert.isTrue(message.startsWith(`The app in ${image} lacks a stapled ticket:\n`), message);
      Assert.areEqual("hdiutil attach,hdiutil detach", runner.required.join(","));
    });
  }

  @TestMethod
  public verifiesAnInstallerPackageAndTheAppInItsPayload(): Promise<void> {
    return AppleSignatureCheckTests.withInstallerAsync(new InstallerRunner([AppleSignatureCheckTests.STAPLED, AppleSignatureCheckTests.STAPLED]), async (check, runner, installer) => {
      const report = await check.verifyAsync([installer], "Sample");

      Assert.areEqual(`${installer}: the installer package has a valid Developer ID Installer signature and its app a valid Developer ID Application signature, `
        + "each notarized and stapled.", report);
      Assert.areEqual("pkgutil --expand-full", runner.required.join(","));
      Assert.areEqual(2, runner.validations);
    });
  }

  @TestMethod
  public refusesAnInstallerPackageWithoutADeveloperIdInstallerSignatureBeforeExpandingIt(): Promise<void> {
    return AppleSignatureCheckTests.withInstallerAsync(new InstallerRunner([AppleSignatureCheckTests.STAPLED], "Developer ID Application"), async (check, runner, installer) => {
      const message = await AppleSignatureCheckTests.messageAsync(check.verifyAsync([installer], "Sample"));

      Assert.isTrue(message.startsWith(`The installer package ${installer} lacks a Developer ID Installer signature:\n`), message);
      Assert.areEqual(0, runner.required.length);
    });
  }

  @TestMethod
  public refusesAnUnsignedInstallerPackage(): Promise<void> {
    return AppleSignatureCheckTests.withInstallerAsync(new InstallerRunner([AppleSignatureCheckTests.MISSING], String.empty, true, false), async (check, _runner, installer) => {
      const message = await AppleSignatureCheckTests.messageAsync(check.verifyAsync([installer], "Sample"));

      Assert.isTrue(message.startsWith(`The installer package ${installer} lacks a valid signature, a Developer ID Installer signature, notarization, a stapled ticket:\n`),
        message);
    });
  }

  @TestMethod
  public refusesAnInstallerPackageWhosePayloadHoldsNoApp(): Promise<void> {
    return AppleSignatureCheckTests.withInstallerAsync(new InstallerRunner([AppleSignatureCheckTests.STAPLED], "Developer ID Installer", false), async (check, _runner, installer) => {
      const message = await AppleSignatureCheckTests.messageAsync(check.verifyAsync([installer], "Sample"));

      Assert.isTrue(/^The installer package expanded into .+expanded holds no Sample\.app in a component's payload\.$/.test(message), message);
    });
  }

  private static async withInstallerAsync(runner: InstallerRunner, run: (check: AppleSignatureCheck, runner: InstallerRunner, installer: string) => Promise<void>):
    Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "apple-signature-"));
    try {
      await PausedTimersFixture.withoutPausesAsync(() => run(new AppleSignatureCheck(runner, path.join(folder, "check"), {}), runner,
        path.join(folder, "Sample-1.2.3-macos-arm64.pkg")), AppleSignatureCheckTests.PAUSE);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async withCheckAsync(staples: readonly ProcessResult[], run: (check: AppleSignatureCheck, runner: StaplerRunner, archive: string) => Promise<void>,
    isSigned: boolean = true): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "apple-signature-"));
    try {
      const runner = new StaplerRunner(staples, isSigned);
      await PausedTimersFixture.withoutPausesAsync(() => run(new AppleSignatureCheck(runner, path.join(folder, "check"), {}), runner,
        path.join(folder, "Sample-1.2.3-macos-arm64.zip")), AppleSignatureCheckTests.PAUSE);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async messageAsync(checking: Promise<string>): Promise<string> {
    let error: unknown = null;
    try {
      await checking;
    }
    catch (thrown) {
      error = thrown;
    }
    Assert.isTrue(error instanceof BuildException, String(error));
    return error instanceof Error ? error.message : String(error);
  }
}
