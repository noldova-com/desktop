/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class SigningOutputCheckResources {
  public static readonly title: string = "Signing output";
  public static readonly publisher: string = "CN=Sample Signer, O=Sample Signer";
  public static readonly otherPublisher: string = "CN=Other Signer, O=Other Signer";
  public static readonly publisherVariable: string = "WINDOWS_PUBLISHER";
  public static readonly program: string = "app.exe";
  public static readonly scriptEncoding: BufferEncoding = "utf16le";
  public static readonly pinnedScript: readonly string[] = [
    "$ErrorActionPreference = 'Stop'",
    "$flags = [System.Security.Cryptography.X509Certificates.X500DistinguishedNameFlags]::UseNewLines",
    "function Get-Fields($name) { @($name.Decode($flags).Split([char]10) | Microsoft.PowerShell.Core\\ForEach-Object { $_.Trim() } | Microsoft.PowerShell.Core\\Where-Object { $_ }) }",
    "$publisher = Get-Fields ([System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new($env:NOLDOVA_DESKTOP_WINDOWS_PUBLISHER))",
    "$vendors = @($env:NOLDOVA_DESKTOP_SIGNING_VENDORS.Split([char]10))",
    "foreach ($file in @($env:NOLDOVA_DESKTOP_SIGNED_FILES.Split([char]10))) {",
    "  $signature = Microsoft.PowerShell.Security\\Get-AuthenticodeSignature -LiteralPath $file",
    "  $subject = if ($null -eq $signature.SignerCertificate) { @() } else { Get-Fields $signature.SignerCertificate.SubjectName }",
    "  $vendor = @($vendors | Microsoft.PowerShell.Core\\Where-Object { $subject -ccontains \"O=$_\" }) | Microsoft.PowerShell.Utility\\Select-Object -First 1",
    "  $signer = if ($subject.Count -eq 0) { '' } elseif (@($publisher | Microsoft.PowerShell.Core\\Where-Object { $subject -cnotcontains $_ }).Count -eq 0) { '*' } "
      + "elseif ($vendor) { $vendor } else { '?' }",
    "  $timestamped = if ($null -ne $signature.TimeStamperCertificate) { 'yes' } else { 'no' }",
    "  \"$file`t$($signature.Status)`t$timestamped`t$signer\"",
    "}"
  ];
  public static readonly productFolder: string = "_build";
  public static readonly productFile: string = "product.json";
  public static readonly archiveAlignment: number = 4;
  public static readonly rule: string = "documents/BUILD.md, Packaging, says neither the publisher nor a signer's subject is ever printed, so a job's log can't show the secret.";
  public static readonly checkedLine: string = "Checked the Authenticode check's script against its pinned copy, and its failure and each case of the package's publisher check for a printed publisher or subject.\n";
  public static readonly passingOutput: string = `${SigningOutputCheckResources.program}\tValid\tyes\t*\n`;
  public static readonly failingOutput: string = `${SigningOutputCheckResources.program}\tNotSigned\tno\t?\n`;
  public static readonly publisherOnCommandLine: string = "AuthenticodeCheck passes the publisher on PowerShell's command line.";
  public static readonly scriptArgumentEncoding: BufferEncoding = "base64";
  public static readonly noLine: string = "(no line)";
  public static readonly authenticodeFailure: string = "AuthenticodeCheck's failure";
  public static readonly passCases: readonly (readonly [string, unknown, string | null])[] = [
    ["no publisher and no variable", { windowsPublisher: null }, null],
    ["a publisher matching the variable", { windowsPublisher: SigningOutputCheckResources.publisher }, SigningOutputCheckResources.publisher]
  ];
  public static readonly failureCases: readonly (readonly [string, unknown, string | null])[] = [
    ["a publisher set without the variable", { windowsPublisher: SigningOutputCheckResources.publisher }, null],
    ["a missing publisher with the variable set", { windowsPublisher: null }, SigningOutputCheckResources.publisher],
    ["a publisher that differs from the variable", { windowsPublisher: SigningOutputCheckResources.otherPublisher }, SigningOutputCheckResources.publisher],
    ["a publisher that is not a string", { windowsPublisher: [SigningOutputCheckResources.otherPublisher] }, SigningOutputCheckResources.publisher],
    ["no publisher field", { name: SigningOutputCheckResources.otherPublisher }, SigningOutputCheckResources.publisher]
  ];
  public static readonly folderPrefix: string = "signing-output-";
  public static readonly contentOffset: string = "0";
  public static readonly archiveExtension: string = ".asar";

  public static formatPrintedFinding(finding: string): string {
    return `${finding} ${SigningOutputCheckResources.rule}${Resources.lineEnd}`;
  }

  public static formatScriptChanged(line: number, text: string | undefined): string {
    return `AuthenticodeCheck's script differs from the copy pinned in scripts/checks/signing-output-check.resources.ts at line ${line}: ${text ?? SigningOutputCheckResources.noLine}. Read what the changed script prints, and pin it again only if it prints neither a subject nor the publisher.`;
  }

  public static formatPassSubject(name: string): string {
    return `PackagedPublisherCheck's line for ${name}`;
  }

  public static formatFailureSubject(name: string): string {
    return `PackagedPublisherCheck's failure for ${name}`;
  }

  public static formatNotFailed(subject: string): string {
    return `${subject} did not fail.`;
  }

  public static formatUnnamed(subject: string, message: string): string {
    return `${subject} does not name ${SigningOutputCheckResources.publisherVariable}: ${message}`;
  }

  public static formatContainsPublisher(subject: string): string {
    return `${subject} contains a publisher's value.`;
  }
}
