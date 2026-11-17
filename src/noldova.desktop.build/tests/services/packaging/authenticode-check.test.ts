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
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { AuthenticodeCheck } from "../../../src/services/packaging/authenticode-check.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { Resources } from "../../../src/resources.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";

class ReportingRunner extends ProcessRunner {
  private readonly exitCode: number;
  private readonly lines: readonly string[];

  public environment: NodeJS.ProcessEnv = {};

  public constructor(exitCode: number, lines: readonly string[]) {
    super();
    this.exitCode = exitCode;
    this.lines = lines;
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    this.environment = call[4] ?? {};
    return Promise.resolve(new ProcessResult(this.exitCode, this.lines.map(t => `${t}\r\n`).join(String.empty), this.exitCode === 0 ? String.empty : "Get-AuthenticodeSignature broke"));
  }
}

@TestClass
export class AuthenticodeCheckTests {
  private static readonly PUBLISHER: string = "CN=Sample Publisher, O=Sample Publisher, C=US";
  private static readonly UNPACKED: string = path.join("out", "win-unpacked");
  private static readonly MODULES: string = path.join(AuthenticodeCheckTests.UNPACKED, "resources", "app.asar.unpacked", "node_modules");
  private static readonly PROGRAM: string = path.join(AuthenticodeCheckTests.UNPACKED, "Sample.exe");
  private static readonly GIT: string = path.join(AuthenticodeCheckTests.MODULES, "sample-git-win32-x64", "git", "cmd", "git.exe");
  private static readonly CONSOLE: string = path.join(AuthenticodeCheckTests.MODULES, "node-pty", "prebuilds", "win32-x64", "conpty", "OpenConsole.exe");
  private static readonly SELF_SIGNING: string = [
    "$ErrorActionPreference = 'Stop'",
    "$organizations = $env:NOLDOVA_TEST_ORGANIZATIONS.Split([char]10)",
    "$files = $env:NOLDOVA_TEST_FILES.Split([char]10)",
    "$usages = [System.Security.Cryptography.OidCollection]::new()",
    "$null = $usages.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3'))",
    "for ($index = 0; $index -lt $files.Count; $index++) {",
    "  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(\"CN=Sample Vendor, O=$($organizations[$index])\",",
    "    [System.Security.Cryptography.RSA]::Create(2048), [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)",
    "  $request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($usages, $false))",
    "  $certificate = $request.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddDays(1))",
    "  $null = Set-AuthenticodeSignature -LiteralPath $files[$index] -Certificate $certificate",
    "}"
  ].join("\n");
  private static readonly CONPTY: string = path.join(AuthenticodeCheckTests.MODULES, "node-pty", "prebuilds", "win32-x64", "conpty", "conpty.dll");

  @TestMethod
  public acceptsTheProgramsAPackageBringsWithTheirVendorsSignature(): Promise<void> {
    return AuthenticodeCheckTests.expectReportAsync([
      `${AuthenticodeCheckTests.PROGRAM}\tValid\tyes\t*`,
      `${AuthenticodeCheckTests.GIT}\tValid\tyes\t${Resources.authenticodeGitForWindowsOrganization}`,
      `${AuthenticodeCheckTests.CONSOLE}\tValid\tyes\t${Resources.authenticodeMicrosoft}`,
      `${AuthenticodeCheckTests.CONPTY}\tValid\tyes\t${Resources.authenticodeMicrosoft}`
    ], [
      `${AuthenticodeCheckTests.PROGRAM}: Valid, timestamped: yes, signed by: the publisher`,
      `${AuthenticodeCheckTests.GIT}: Valid, timestamped: yes, signed by: ${Resources.authenticodeGitForWindows}`,
      `${AuthenticodeCheckTests.CONSOLE}: Valid, timestamped: yes, signed by: ${Resources.authenticodeMicrosoft}`,
      `${AuthenticodeCheckTests.CONPTY}: Valid, timestamped: yes, signed by: ${Resources.authenticodeMicrosoft}`
    ].join("\n"));
  }

  @TestMethod
  public asksForTheVendorsOnTheListAndReadsEveryFile(): Promise<void> {
    const runner = new ReportingRunner(0, [`${AuthenticodeCheckTests.PROGRAM}\tValid\tyes\t*`, `${AuthenticodeCheckTests.GIT}\tValid\tyes\t*`]);

    return new AuthenticodeCheck(runner, "root", {}).verifyAsync([AuthenticodeCheckTests.PROGRAM], [AuthenticodeCheckTests.GIT], AuthenticodeCheckTests.PUBLISHER).then(() => {
      Assert.areEqual(`${Resources.authenticodeMicrosoft}|${Resources.authenticodeGitForWindowsOrganization}`, (runner.environment["NOLDOVA_DESKTOP_SIGNING_VENDORS"] ?? String.empty).split("\n").join("|"));
      Assert.areEqual(`${AuthenticodeCheckTests.PROGRAM}|${AuthenticodeCheckTests.GIT}`, (runner.environment["NOLDOVA_DESKTOP_SIGNED_FILES"] ?? String.empty).split("\n").join("|"));
      Assert.areEqual(AuthenticodeCheckTests.PUBLISHER, runner.environment["NOLDOVA_DESKTOP_WINDOWS_PUBLISHER"]);
    });
  }

  @TestMethod
  public acceptsAProgramAPackageBringsWithItsVendorsSignatureWhateverTheCaseOfItsExtension(): Promise<void> {
    const git = AuthenticodeCheckTests.GIT.replace("git.exe", "GIT.EXE");

    return AuthenticodeCheckTests.expectReportAsync([`${git}\tValid\tyes\t${Resources.authenticodeGitForWindowsOrganization}`],
      `${git}: Valid, timestamped: yes, signed by: ${Resources.authenticodeGitForWindows}`);
  }

  @TestMethod
  public refusesAProgramAPackageBringsSignedByAVendorNotOnTheList(): Promise<void> {
    return AuthenticodeCheckTests.expectRefusedAsync([`${AuthenticodeCheckTests.GIT}\tValid\tyes\t?`],
      [`${AuthenticodeCheckTests.GIT}: Valid, timestamped: yes, signed by: another signer`]);
  }

  @TestMethod
  public refusesAnUnsignedProgramAndAnUntimestampedOrInvalidVendorSignature(): Promise<void> {
    return AuthenticodeCheckTests.expectRefusedAsync([
      `${AuthenticodeCheckTests.GIT}\tNotSigned\tno\t`,
      `${AuthenticodeCheckTests.CONSOLE}\tValid\tno\t${Resources.authenticodeMicrosoft}`,
      `${AuthenticodeCheckTests.CONPTY}\tUnknownError\tyes\t${Resources.authenticodeMicrosoft}`
    ], [
      `${AuthenticodeCheckTests.GIT}: NotSigned, timestamped: no, signed by: no one`,
      `${AuthenticodeCheckTests.CONSOLE}: Valid, timestamped: no, signed by: ${Resources.authenticodeMicrosoft}`,
      `${AuthenticodeCheckTests.CONPTY}: UnknownError, timestamped: yes, signed by: ${Resources.authenticodeMicrosoft}`
    ]);
  }

  @TestMethod
  public keepsTheAppsOwnProgramsToThePublisherAndLibrariesToMicrosoft(): Promise<void> {
    return AuthenticodeCheckTests.expectRefusedAsync([
      `${AuthenticodeCheckTests.PROGRAM}\tValid\tyes\t${Resources.authenticodeMicrosoft}`,
      `${AuthenticodeCheckTests.GIT}\tValid\tyes\t*`,
      `${AuthenticodeCheckTests.CONPTY}\tValid\tyes\t${Resources.authenticodeGitForWindowsOrganization}`
    ], [
      `${AuthenticodeCheckTests.PROGRAM}: Valid, timestamped: yes, signed by: ${Resources.authenticodeMicrosoft}`,
      `${AuthenticodeCheckTests.CONPTY}: Valid, timestamped: yes, signed by: ${Resources.authenticodeGitForWindows}`
    ]);
  }

  @TestMethod
  public refusesAReportThatMissesAFileOrNamesAnother(): Promise<void> {
    return Promise.all([
      [`${AuthenticodeCheckTests.PROGRAM}\tValid\tyes\t*`],
      [`${AuthenticodeCheckTests.PROGRAM}\tValid\tyes\t*`, `${AuthenticodeCheckTests.CONPTY}\tValid\tyes\t*`],
      [`${AuthenticodeCheckTests.PROGRAM}\tValid\tyes`, `${AuthenticodeCheckTests.GIT}\tValid\tyes\t*`]
    ].map(lines => AuthenticodeCheckTests.messageAsync(new ReportingRunner(0, lines), [AuthenticodeCheckTests.PROGRAM], [AuthenticodeCheckTests.GIT]))).then(messages => {
      Assert.areEqual("pwsh did not report one signature for each of the 2 files it checked.", [...new Set(messages)].join("|"));
    });
  }

  @TestMethod
  public saysWhenPowerShellFailsReadingTheSignatures(): Promise<void> {
    return AuthenticodeCheckTests.messageAsync(new ReportingRunner(1, []), [AuthenticodeCheckTests.PROGRAM], []).then(message => {
      Assert.areEqual("pwsh failed reading the Windows signatures with exit code 1:\nGet-AuthenticodeSignature broke", message);
    });
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async readsAnUnsignedProgramsSignatureWithPowerShell(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "authenticode-"));
    try {
      const unsigned = path.join(folder, "Sample.exe");
      await writeFile(unsigned, "MZ");
      const message = await AuthenticodeCheckTests.messageAsync(new ProcessRunner(), [unsigned], [], folder, process.env);
      const refused = message.slice(message.indexOf("Refused:\n") + "Refused:\n".length);

      Assert.isTrue(refused.startsWith(`  ${unsigned}: `) && refused.endsWith(", timestamped: no, signed by: no one") && !refused.includes("\n"), message);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async matchesAVendorOnlyOnItsExactOrganizationWithPowerShell(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "authenticode-"));
    try {
      const organizations = [Resources.authenticodeGitForWindowsOrganization, `${Resources.authenticodeGitForWindowsOrganization} Ltd`,
        Resources.authenticodeGitForWindowsOrganization.toLowerCase()];
      const scripts = organizations.map((_, i) => path.join(folder, `sample-${i}.ps1`));
      for (const script of scripts)
        await writeFile(script, "Write-Output 'sample'\r\n");
      const signed = await new ProcessRunner().captureAsync(Resources.powershellCommand, [...Resources.powershellOptions,
        Buffer.from(AuthenticodeCheckTests.SELF_SIGNING, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding)], folder, Resources.authenticodeTimeout,
        { ...process.env, NOLDOVA_TEST_ORGANIZATIONS: organizations.join("\n"), NOLDOVA_TEST_FILES: scripts.join("\n") });
      Assert.isTrue(signed.isSuccessful, signed.text);

      const message = await AuthenticodeCheckTests.messageAsync(new ProcessRunner(), scripts, [], folder, process.env);
      const signers = message.slice(message.indexOf("Refused:\n") + "Refused:\n".length).split("\n").map(t => t.slice(t.lastIndexOf("signed by: ") + "signed by: ".length));

      Assert.areEqual(`${Resources.authenticodeGitForWindows}|another signer|another signer`, signers.join("|"), message);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async expectReportAsync(lines: readonly string[], expected: string): Promise<void> {
    const files = lines.map(t => t.split("\t")[0] ?? String.empty);
    const report = await new AuthenticodeCheck(new ReportingRunner(0, lines), "root", {})
      .verifyAsync(files.filter(t => t === AuthenticodeCheckTests.PROGRAM), files.filter(t => t !== AuthenticodeCheckTests.PROGRAM), AuthenticodeCheckTests.PUBLISHER);

    Assert.areEqual(expected, report);
  }

  private static async expectRefusedAsync(lines: readonly string[], refused: readonly string[]): Promise<void> {
    const files = lines.map(t => t.split("\t")[0] ?? String.empty);
    const message = await AuthenticodeCheckTests.messageAsync(new ReportingRunner(0, lines), files.filter(t => t === AuthenticodeCheckTests.PROGRAM),
      files.filter(t => t !== AuthenticodeCheckTests.PROGRAM));

    Assert.areEqual(refused.map(t => `  ${t}`).join("\n"), message.slice(message.indexOf("Refused:\n") + "Refused:\n".length));
    Assert.isTrue(message.startsWith("Not every program and addon is signed by the publisher in WINDOWS_PUBLISHER, every library by it or Microsoft Corporation, "
      + `and every program a package brings by it or Microsoft Corporation, Git for Windows' signer, with a valid, timestamped signature.`), message);
  }

  private static async messageAsync(runner: ProcessRunner, files: readonly string[], libraries: readonly string[], folder: string = "root",
    environment: NodeJS.ProcessEnv = {}): Promise<string> {
    let error: unknown = null;
    try {
      await new AuthenticodeCheck(runner, folder, environment).verifyAsync(files, libraries, AuthenticodeCheckTests.PUBLISHER);
    }
    catch (thrown) {
      error = thrown;
    }
    Assert.isTrue(error instanceof BuildException, String(error));
    return error instanceof Error ? error.message : String(error);
  }
}
