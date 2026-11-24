/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class Resources {
  public static readonly commandName: string = "noldova-desktop-build";
  public static readonly buildCommand: string = "build";
  public static readonly installCommand: string = "install";
  public static readonly startCommand: string = "start";
  public static readonly desktopToolsCommand: string = "desktop-tools";
  public static readonly packageCommand: string = "package";
  public static readonly packageSmokeCommand: string = "package-smoke";
  public static readonly listTargetsCommand: string = "list-targets";
  public static readonly releaseCheckCommand: string = "release-check";
  public static readonly chooseFeedCommand: string = "choose-feed";
  public static readonly feedCheckCommand: string = "feed-check";
  public static readonly moduleRangeCommand: string = "module-range";
  public static readonly noldovaDesktopRangeCommand: string = "noldova-desktop-range";
  public static readonly releaseAssetsCommand: string = "release-assets";
  public static readonly releasePublishCommand: string = "release-publish";
  public static readonly releaseLockCommand: string = "release-lock";
  public static readonly releaseUnlockCommand: string = "release-unlock";
  public static readonly commands: readonly string[] = [
    Resources.installCommand,
    Resources.buildCommand,
    Resources.startCommand,
    Resources.desktopToolsCommand,
    Resources.packageCommand,
    Resources.packageSmokeCommand,
    Resources.listTargetsCommand,
    Resources.releaseCheckCommand,
    Resources.releaseAssetsCommand,
    Resources.releasePublishCommand
  ];
  public static readonly usage: string = `Usage: ${Resources.commandName} <command> [<argument>...], where the command is one of ${Resources.commands.join(", ")}.\n`;
  public static readonly usageExitCode: number = 2;
  public static readonly releaseCommandName: string = "noldova-desktop-release";
  public static readonly releaseCommands: readonly string[] = [
    Resources.listTargetsCommand,
    Resources.releaseCheckCommand,
    Resources.chooseFeedCommand,
    Resources.releasePublishCommand,
    Resources.releaseLockCommand,
    Resources.releaseUnlockCommand,
    Resources.feedCheckCommand,
    Resources.moduleRangeCommand,
    Resources.noldovaDesktopRangeCommand
  ];
  public static readonly releaseUsage: string = `Usage: ${Resources.releaseCommandName} <command> [<argument>...], where the command is one of ${Resources.releaseCommands.join(", ")}.`
    + " It loads only Node.js's own modules and the context packages desktop.build takes as peers, so it runs from desktop.build's archive with those beside it, without an install.\n";
  public static readonly licenseNotice: readonly string[] = [
    "@license",
    "Copyright (c) Noldova.",
    String.empty,
    "This source code is licensed under the license found in the",
    "LICENSE file in the root directory of this source tree."
  ];
  public static readonly licenseHeaderBlock: string = ["/**", ...Resources.licenseNotice.map(t => ` *${Resources.indentNoticeLine(t)}`), " */", String.empty].join("\n");
  public static readonly packageManifestFileName: string = "package.json";
  public static readonly windowsTarget: string = "windows";
  public static readonly macosTarget: string = "macos";
  public static readonly linuxTarget: string = "linux";
  public static readonly installerTarget: string = "exe";
  public static readonly diskImageTarget: string = "dmg";
  public static readonly macInstallerTarget: string = "pkg";
  public static readonly appImageTarget: string = "AppImage";
  public static readonly debianPackageTarget: string = "deb";
  public static readonly modulesPrefix: string = "@noldova/desktop.";
  public static readonly modulesPrefixPattern: RegExp = /^@[a-z0-9][a-z0-9._-]*\/(?:[a-z0-9][a-z0-9._-]*[-.])?$/;
  public static readonly versionRangeForm: string = ">=<lowest version> <first version refused>, such as >=0.0.70 <0.1.0";
  public static readonly runtimePart: string = "runtime";
  public static readonly windowPart: string = "window";
  public static readonly cliPart: string = "cli";
  public static readonly moduleParts: readonly string[] = [Resources.runtimePart, Resources.windowPart, Resources.cliPart];
  public static readonly moduleFixtureFolder: string = "src/noldova.desktop.electron/tests/e2e/fixtures/modules";
  public static readonly settingsFileName: string = "settings.json";
  public static readonly settingsKind: string = "settings";
  public static readonly settingScopesKind: string = "settingScopes";
  public static readonly settingsPagesKind: string = "settingsPages";
  public static readonly webViewsFileName: string = "webViews.json";
  public static readonly shellMenuPlaces: readonly string[] = ["desktop.file", "desktop.edit", "desktop.view", "desktop.window", "desktop.help", "desktop.tab"];
  public static readonly cliCommandsKind: string = "cliCommands";
  public static readonly galleryMarkers: readonly string[] = ["nol-gallery-scope-frame", "nol-gallery-forms", "Plate, center chosen", "\"data-nol-state\""];
  public static readonly updateFeedOption: string = "--update-feed";
  public static readonly downloadAttemptTimeout: number = 600_000;
  public static readonly compileTimeout: number = 300_000;
  public static readonly carryTimeout: number = 300_000;
  public static readonly carryScriptSegments: readonly string[] = ["scripts", "carry-docs.ts"];
  public static readonly inputsOption: string = "--inputs";
  public static readonly addonOutputFolder: string = "native";
  public static readonly addonExtension: string = ".node";
  public static readonly releaseAddonsVariable: string = "RELEASE_ADDONS";
  public static readonly targetArchitectureVariable: string = "NOLDOVA_DESKTOP_ARCHITECTURE";
  public static readonly companyArchivesVariable: string = "NOLDOVA_DESKTOP_COMPANY_ARCHIVES";
  public static readonly electronArchitectureVariable: string = "npm_config_arch";
  public static readonly addonWindowsTargets: readonly string[] = ["win32-x64", "win32-arm64"];
  public static readonly addonPosixTargets: readonly string[] = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"];
  public static readonly addonProcessorSeparator: string = "+";
  public static readonly addonTargetPattern: RegExp = /^(?:aix|android|cygwin|darwin|freebsd|haiku|linux|netbsd|openbsd|sunos|win32)-[a-z0-9]+(?:\+[a-z0-9]+)*$/;
  public static readonly desktopToolsEntrySegments: readonly string[] = ["node_modules", "@noldova", "desktop.cli", "services", "cli-entry.js"];
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly runAsNodeValue: string = "1";
  public static readonly electronMainSegments: readonly string[] = ["node_modules", "@noldova", "desktop.electron", "main.js"];
  public static readonly userNamespacesProbeCommand: string = "unshare";
  public static readonly userNamespacesProbeArguments: readonly string[] = ["-Ur", "true"];
  public static readonly windowsIconFile: string = "icon-dark.ico";
  public static readonly macIconFile: string = "icon-dock-512.png";
  public static readonly linuxIconFile: string = "icon-dark-512.png";
  public static readonly commandFolder: string = "bin";
  public static readonly windowsCommandExtension: string = ".cmd";
  public static readonly installerIncludeSegments: readonly string[] = ["assets", "installer", "installer.nsh"];
  public static readonly entitlementsSegments: readonly string[] = ["assets", "macos", "entitlements.plist"];
  public static readonly fontLicensesSegments: readonly string[] = ["assets", "licenses", "fonts"];
  public static readonly reviewedLicensesSegments: readonly string[] = ["assets", "licenses", "third-party"];
  public static readonly dictionariesSegments: readonly string[] = ["assets", "dictionaries"];
  public static readonly licenseSegments: readonly string[] = ["LICENSE"];
  public static readonly omittedOptionalsSection: string = "desktop.packaging.omittedOptionals";
  public static readonly typeOnlyPeersSection: string = "desktop.packaging.typeOnlyPeers";
  public static readonly acceptedLicensesSection: string = "desktop.packaging.acceptedLicenses";
  public static readonly tarFileTypes: readonly string[] = ["0", String.empty, "7"];
  public static readonly tarFolderType: string = "5";
  public static readonly windowsPublisherVariable: string = "WINDOWS_PUBLISHER";
  public static readonly linuxSigningKeyVariable: string = "LINUX_UPDATE_SIGNING_KEY";
  public static readonly linuxUpdateKeysVariable: string = "LINUX_UPDATE_PUBLIC_KEYS";
  public static readonly linuxSigningCredentials: readonly string[] = [Resources.linuxSigningKeyVariable, Resources.linuxUpdateKeysVariable];
  public static readonly updateSignatureKeyType: string = "ed25519";
  public static readonly updateSignatureEncoding: BufferEncoding = "base64";
  public static readonly updateSignatureLength: number = 64;
  public static readonly publicKeyEncoding: "spki" = "spki";
  public static readonly keyDerFormat: "der" = "der";
  public static readonly feedLinuxKeysMissing: string = `${Resources.linuxUpdateKeysVariable} is empty, but the feed serves a Linux target, whose app refuses an update`
    + " without a valid signature by a key it ships; set it to those keys, as the release workflow's feed job reads them from the app repository's variable.";
  public static readonly linuxUpdateKeysInvalid: string = `${Resources.linuxUpdateKeysVariable} must list distinct Ed25519 public keys, each the base64 of its DER SubjectPublicKeyInfo, separated by spaces or lines.`;
  public static readonly linuxSigningKeyInvalid: string = `${Resources.linuxSigningKeyVariable} must be an Ed25519 private key in PKCS #8 PEM, so it is not shown here.`;
  public static readonly linuxSigningKeyNotShipped: string = `The public half of ${Resources.linuxSigningKeyVariable} is not among ${Resources.linuxUpdateKeysVariable}, so the packaged app would refuse its own updates; ship the key one release before signing with it.`;
  public static readonly windowsSigningSection: string = "desktop.product.windowsSigning";
  public static readonly windowsSigningCredentials: readonly string[] = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];
  public static readonly macSigningCredentials: readonly string[] = ["MAC_CERTIFICATE", "MAC_CERTIFICATE_PASSWORD", "APPLE_API_KEY_P8", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
  public static readonly staplerAttempts: number = 3;
  public static readonly releaseTargetsVariable: string = "RELEASE_TARGETS";
  public static readonly powershellStopLine: string = "$ErrorActionPreference = 'Stop'";
  public static readonly lineSeparator: string = "\n";
  public static readonly pathSegmentSeparator: string = "/";
  public static readonly textEncoding: BufferEncoding = "utf8";
  public static readonly listSeparator: string = ", ";
  public static readonly diskImageExtension: string = ".dmg";
  public static readonly macInstallerExtension: string = ".pkg";
  public static readonly appBundleExtension: string = ".app";
  public static readonly hdiutilCommand: string = "hdiutil";
  public static readonly hdiutilAttachArgument: string = "attach";
  public static readonly hdiutilReadonlyOption: string = "-readonly";
  public static readonly hdiutilNoBrowseOption: string = "-nobrowse";
  public static readonly hdiutilNoAutoOpenOption: string = "-noautoopen";
  public static readonly hdiutilMountpointOption: string = "-mountpoint";
  public static readonly hdiutilAttachArguments: readonly string[] = [Resources.hdiutilAttachArgument, Resources.hdiutilReadonlyOption, Resources.hdiutilNoBrowseOption,
    Resources.hdiutilNoAutoOpenOption, Resources.hdiutilMountpointOption];
  public static readonly hdiutilDetachArgument: string = "detach";
  public static readonly hdiutilForceOption: string = "-force";
  public static readonly dittoCommand: string = "ditto";
  public static readonly dittoExtractArguments: readonly string[] = ["-x", "-k"];
  public static readonly codesignCommand: string = "codesign";
  public static readonly codesignVerifyOption: string = "--verify";
  public static readonly codesignDeepOption: string = "--deep";
  public static readonly codesignStrictOption: string = "--strict";
  public static readonly codesignDisplayOption: string = "--display";
  public static readonly appleVerboseOption: string = "--verbose=2";
  public static readonly spctlCommand: string = "spctl";
  public static readonly spctlAssessOption: string = "--assess";
  public static readonly spctlTypeOption: string = "--type";
  public static readonly spctlAppAssessment: readonly string[] = [Resources.spctlTypeOption, "execute"];
  public static readonly spctlInstallerAssessment: readonly string[] = [Resources.spctlTypeOption, "install"];
  public static readonly pkgutilCommand: string = "pkgutil";
  public static readonly pkgutilCheckSignatureOption: string = "--check-signature";
  public static readonly pkgutilExpandFullOption: string = "--expand-full";
  public static readonly installerPayloadFolder: string = "Payload";
  public static readonly installerExpandedFolder: string = "expanded";
  public static readonly installerDistributionFile: string = "Distribution";
  public static readonly installerDomainsPattern: RegExp = /<domains\b[^>]*>/gu;
  public static readonly xmlAttributePattern: RegExp = /([\w:-]+)\s*=\s*"([^"]*)"/gu;
  public static readonly macInstallerDomains: ReadonlyMap<string, string> = new Map([["enable_anywhere", "false"], ["enable_currentUserHome", "false"], ["enable_localSystem", "true"]]);
  public static readonly appleDeveloperIdInstallerPattern: RegExp = /^\s*1\. Developer ID Installer: /m;
  public static readonly appleDeveloperIdInstallerRequirement: string = "a Developer ID Installer signature";
  public static readonly spctlDiskImageAssessment: readonly string[] = [Resources.spctlTypeOption, "open", "--context", "context:primary-signature"];
  public static readonly xcrunCommand: string = "xcrun";
  public static readonly staplerCommand: string = "stapler";
  public static readonly staplerValidateArguments: readonly string[] = [Resources.staplerCommand, "validate"];
  public static readonly appleSignatureTimeout: number = 300_000;
  public static readonly appleDeveloperIdPattern: RegExp = /^Authority=Developer ID Application: /m;
  public static readonly appleNotarizedPattern: RegExp = /^source=Notarized Developer ID$/m;
  public static readonly appleNetworkErrorPattern: RegExp = /NSURLErrorDomain/;
  public static readonly staplerPause: number = 5_000;
  public static readonly appleValidSignatureRequirement: string = "a valid signature";
  public static readonly appleDeveloperIdRequirement: string = "a Developer ID Application signature";
  public static readonly appleNotarizationRequirement: string = "notarization";
  public static readonly appleStapledRequirement: string = "a stapled ticket";
  public static readonly appleStapledOfflineRequirement: string = `a stapled ticket confirmed by stapler validate, which lost its network connection on all ${Resources.staplerAttempts} attempts`;
  public static readonly fileReadFlag: string = "r";
  public static readonly asarSizeLength: number = 8;
  public static readonly asarHeaderSizeOffset: number = 4;
  public static readonly asarHeaderLengthOffset: number = 4;
  public static readonly asarHeaderOffset: number = 8;
  public static readonly asarFilesField: string = "files";
  public static readonly asarSizeField: string = "size";
  public static readonly asarOffsetField: string = "offset";
  public static readonly asarUnpackedField: string = "unpacked";
  public static readonly authenticodeMicrosoft: string = "Microsoft Corporation";
  public static readonly authenticodeGitForWindows: string = "Git for Windows' signer";
  public static readonly authenticodeGitForWindowsOrganization: string = "Johannes Schindelin";
  public static readonly authenticodeLibraryVendors: readonly string[] = [Resources.authenticodeMicrosoft];
  public static readonly authenticodeProgramVendors: readonly string[] = [Resources.authenticodeMicrosoft, Resources.authenticodeGitForWindows];
  public static readonly authenticodeOrganizations: ReadonlyMap<string, string> = new Map([
    [Resources.authenticodeMicrosoft, Resources.authenticodeMicrosoft],
    [Resources.authenticodeGitForWindowsOrganization, Resources.authenticodeGitForWindows]
  ]);
  public static readonly powershellCommand: string = "pwsh";
  public static readonly powershellOptions: readonly string[] = ["-NoProfile", "-NonInteractive", "-EncodedCommand"];
  public static readonly powershellScriptEncoding: BufferEncoding = "utf16le";
  public static readonly powershellCommandEncoding: BufferEncoding = "base64";
  public static readonly authenticodeFilesVariable: string = "NOLDOVA_DESKTOP_SIGNED_FILES";
  public static readonly authenticodePublisherVariable: string = "NOLDOVA_DESKTOP_WINDOWS_PUBLISHER";
  public static readonly authenticodeVendorsVariable: string = "NOLDOVA_DESKTOP_SIGNING_VENDORS";
  public static readonly authenticodeFieldSeparator: string = "\t";
  public static readonly lineBreakPattern: RegExp = /\r?\n/;
  public static readonly authenticodeTimeout: number = 120_000;
  public static readonly windowsProgramExtension: string = ".exe";
  public static readonly authenticodeValidStatus: string = "Valid";
  public static readonly authenticodeTimestamped: string = "yes";
  public static readonly authenticodePublisherSigner: string = "*";
  public static readonly authenticodeOtherSigner: string = "?";
  public static readonly authenticodeNoSigner: string = String.empty;
  public static readonly authenticodeReportFieldCount: number = 4;
  public static readonly authenticodePublisherLabel: string = "the publisher";
  public static readonly authenticodeOtherSignerLabel: string = "another signer";
  public static readonly authenticodeNoSignerLabel: string = "no one";
  public static readonly authenticodeScript: string = [
    Resources.powershellStopLine,
    "$flags = [System.Security.Cryptography.X509Certificates.X500DistinguishedNameFlags]::UseNewLines",
    "function Get-Fields($name) { @($name.Decode($flags).Split([char]10) | Microsoft.PowerShell.Core\\ForEach-Object { $_.Trim() } | Microsoft.PowerShell.Core\\Where-Object { $_ }) }",
    `$publisher = Get-Fields ([System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new($env:${Resources.authenticodePublisherVariable}))`,
    `$vendors = @($env:${Resources.authenticodeVendorsVariable}.Split([char]10))`,
    `foreach ($file in @($env:${Resources.authenticodeFilesVariable}.Split([char]10))) {`,
    "  $signature = Microsoft.PowerShell.Security\\Get-AuthenticodeSignature -LiteralPath $file",
    "  $subject = if ($null -eq $signature.SignerCertificate) { @() } else { Get-Fields $signature.SignerCertificate.SubjectName }",
    "  $vendor = @($vendors | Microsoft.PowerShell.Core\\Where-Object { $subject -ccontains \"O=$_\" }) | Microsoft.PowerShell.Utility\\Select-Object -First 1",
    "  $signer = if ($subject.Count -eq 0) { '' } "
      + "elseif (@($publisher | Microsoft.PowerShell.Core\\Where-Object { $subject -cnotcontains $_ }).Count -eq 0) { '*' } "
      + "elseif ($vendor) { $vendor } else { '?' }",
    "  $timestamped = if ($null -ne $signature.TimeStamperCertificate) { 'yes' } else { 'no' }",
    "  \"$file`t$($signature.Status)`t$timestamped`t$signer\"",
    "}"
  ].join(Resources.lineSeparator);
  public static readonly packageScopePrefix: string = "@";
  public static readonly electronPackageName: string = "electron";
  public static readonly nodeModulesFolder: string = "node_modules";
  public static readonly electronPackageSegments: readonly string[] = [Resources.nodeModulesFolder, Resources.electronPackageName];
  public static readonly electronDistributionFolder: string = "dist";
  public static readonly electronDefaultAppFile: string = "default_app.asar";
  public static readonly electronVersionFile: string = "version";
  public static readonly windowsPowershellCommand: string = "powershell.exe";
  public static readonly fileHoldersFilesVariable: string = "NOLDOVA_DESKTOP_LEFT_FILES";
  public static readonly fileHoldersTimeout: number = 120_000;
  public static readonly fileHoldersScript: string = [
    Resources.powershellStopLine,
    "Microsoft.PowerShell.Utility\\Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Collections.Generic;",
    "using System.Runtime.InteropServices;",
    "using System.Text;",
    "public static class ShellFileHolders {",
    "  private const int MoreData = 234;",
    "  [StructLayout(LayoutKind.Sequential)]",
    "  private struct UniqueProcess { public uint ProcessId; public uint StartLow; public uint StartHigh; }",
    "  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]",
    "  private struct ProcessInfo {",
    "    public UniqueProcess Process;",
    "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string AppName;",
    "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string ServiceName;",
    "    public int ApplicationType;",
    "    public uint AppStatus;",
    "    public uint SessionId;",
    "    [MarshalAs(UnmanagedType.Bool)] public bool Restartable;",
    "  }",
    "  [DllImport(\"rstrtmgr.dll\", CharSet = CharSet.Unicode)]",
    "  private static extern int RmStartSession(out uint session, int flags, StringBuilder key);",
    "  [DllImport(\"rstrtmgr.dll\", CharSet = CharSet.Unicode)]",
    "  private static extern int RmRegisterResources(uint session, uint fileCount, string[] files, uint processCount, IntPtr processes, uint serviceCount, IntPtr services);",
    "  [DllImport(\"rstrtmgr.dll\")]",
    "  private static extern int RmGetList(uint session, out uint needed, ref uint count, [In, Out] ProcessInfo[] infos, out uint reasons);",
    "  [DllImport(\"rstrtmgr.dll\")]",
    "  private static extern int RmEndSession(uint session);",
    "  public static string[] Describe(string file) {",
    "    uint session;",
    "    int error = RmStartSession(out session, 0, new StringBuilder(64));",
    "    if (error != 0)",
    "      return new[] { \"Restart Manager could not start, error \" + error };",
    "    try {",
    "      error = RmRegisterResources(session, 1, new[] { file }, 0, IntPtr.Zero, 0, IntPtr.Zero);",
    "      if (error != 0)",
    "        return new[] { \"Restart Manager could not register it, error \" + error };",
    "      uint needed;",
    "      uint count = 0;",
    "      uint reasons;",
    "      ProcessInfo[] infos = new ProcessInfo[0];",
    "      error = RmGetList(session, out needed, ref count, infos, out reasons);",
    "      while (error == MoreData) {",
    "        infos = new ProcessInfo[needed];",
    "        count = needed;",
    "        error = RmGetList(session, out needed, ref count, infos, out reasons);",
    "      }",
    "      if (error != 0)",
    "        return new[] { \"Restart Manager could not list what uses it, error \" + error };",
    "      List<string> holders = new List<string>();",
    "      for (int i = 0; i < count; i++)",
    "        holders.Add(\"process \" + infos[i].Process.ProcessId + \" \" + infos[i].AppName + (string.IsNullOrEmpty(infos[i].ServiceName) ? \"\" : \", service \" + infos[i].ServiceName));",
    "      return holders.ToArray();",
    "    }",
    "    finally {",
    "      RmEndSession(session);",
    "    }",
    "  }",
    "}",
    "'@",
    `foreach ($file in $env:${Resources.fileHoldersFilesVariable}.Split([char]10)) {`,
    "  $holders = @([ShellFileHolders]::Describe($file))",
    "  if ($holders.Count -eq 0) { \"${file}: no process holds it now.\" }",
    "  foreach ($holder in $holders) { \"${file}: $holder.\" }",
    "}",
    "$since = (Microsoft.PowerShell.Utility\\Get-Date).AddMinutes(-5)",
    "$records = @(Microsoft.PowerShell.Diagnostics\\Get-WinEvent -MaxEvents 20 -ErrorAction SilentlyContinue -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; StartTime = $since })",
    "if ($records.Count -eq 0) { 'Defender logged no event in the last 5 minutes.' }",
    "foreach ($record in $records) { \"Defender event $($record.Id) at $($record.TimeCreated.ToString('o')): $(\"$($record.Message)\".Split([char]10)[0].Trim())\" }"
  ].join(Resources.lineSeparator);
  public static readonly addonPrebuildsFolder: string = "prebuilds";
  public static readonly addonBuildFolders: readonly string[] = [Resources.addonOutputFolder, Resources.addonPrebuildsFolder];
  public static readonly conptyFolderSegments: readonly string[] = ["third_party", "conpty"];
  public static readonly conptyTargets: readonly string[] = ["win10-x64", "win10-arm64"];
  public static readonly conptyTargetPrefix: string = "win10-";
  public static readonly macCertificateVariable: string = "MAC_CERTIFICATE";
  public static readonly macCertificatePasswordVariable: string = "MAC_CERTIFICATE_PASSWORD";
  public static readonly macInstallerCertificateVariable: string = "MAC_INSTALLER_CERTIFICATE";
  public static readonly macInstallerCertificatePasswordVariable: string = "MAC_INSTALLER_CERTIFICATE_PASSWORD";
  public static readonly macInstallerSigningCredentials: readonly string[] = [Resources.macInstallerCertificateVariable, Resources.macInstallerCertificatePasswordVariable];
  public static readonly builderInstallerCertificateVariable: string = "CSC_INSTALLER_LINK";
  public static readonly builderInstallerCertificatePasswordVariable: string = "CSC_INSTALLER_KEY_PASSWORD";
  public static readonly appleApiKeyVariable: string = "APPLE_API_KEY_P8";
  public static readonly appleApiKeyIdVariable: string = "APPLE_API_KEY_ID";
  public static readonly appleApiIssuerVariable: string = "APPLE_API_ISSUER";
  public static readonly builderIdentityDiscoveryVariable: string = "CSC_IDENTITY_AUTO_DISCOVERY";
  public static readonly builderIdentityDiscoveryValue: string = "true";
  public static readonly builderCertificateVariable: string = "CSC_LINK";
  public static readonly builderCertificatePasswordVariable: string = "CSC_KEY_PASSWORD";
  public static readonly builderAppleKeyVariable: string = "APPLE_API_KEY";
  public static readonly macNotarizationKeyFile: string = "notarization-key.p8";
  public static readonly macSigningCheckFolder: string = "check";
  public static readonly macNotarizationTimeout: number = 2_820_000;
  public static readonly macNotarizationWait: string = "45m";
  public static readonly macStapleTimeout: number = 300_000;
  public static readonly macPackagingLimit: number = 4_200_000;
  public static readonly millisecondsPerMinute: number = 60_000;
  public static readonly macNotarizationAcceptedPattern: RegExp = /"status"\s*:\s*"Accepted"/;
  public static readonly macNotarizationSubmissionPattern: RegExp = /"id"\s*:\s*"([^"]+)"/;
  public static readonly privateFolderMode: number = 0o700;
  public static readonly privateFileMode: number = 0o600;
  public static readonly notarytoolSubmitArguments: readonly string[] = ["notarytool", "submit"];
  public static readonly notarytoolKeyOption: string = "--key";
  public static readonly notarytoolKeyIdOption: string = "--key-id";
  public static readonly notarytoolIssuerOption: string = "--issuer";
  public static readonly notarytoolWaitArguments: readonly string[] = ["--wait", "--timeout"];
  public static readonly notarytoolOutputArguments: readonly string[] = ["--output-format", "json"];
  public static readonly staplerStapleArguments: readonly string[] = [Resources.staplerCommand, "staple"];
  public static readonly macUpdateArchiveTimeout: number = 300_000;
  public static readonly frameworkExtension: string = ".framework";
  public static readonly frameworkCurrentVersionSegments: readonly string[] = ["Versions", "Current"];
  public static readonly macUpdateShownDifferences: number = 10;
  public static readonly macUpdateFolderEntry: string = "folder";
  public static readonly macUpdateLinkPrefix: string = "link to ";
  public static readonly macUpdateMissingEntry: string = "missing";
  public static readonly nativeHeaderLength: number = 64;
  public static readonly nativePeOffsetPosition: number = 0x3c;
  public static readonly nativeMagicEncoding: BufferEncoding = "latin1";
  public static readonly nativeMagicHexEncoding: BufferEncoding = "hex";
  public static readonly nativeDosMagic: Buffer = Buffer.from("MZ", Resources.nativeMagicEncoding);
  public static readonly nativePeMagic: Buffer = Buffer.from("PE\0\0", Resources.nativeMagicEncoding);
  public static readonly nativeMagics: readonly Buffer[] = ["7f454c46", "feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabf"].map(t => Buffer.from(t, Resources.nativeMagicHexEncoding));
  public static readonly nativeUniversalMagic: Buffer = Buffer.from("cafebabe", Resources.nativeMagicHexEncoding);
  public static readonly nativeUniversalHeaderLength: number = 8;
  public static readonly nativeJavaFirstVersion: number = 45;
  public static readonly filePatternCharacters: RegExp = /[*?[\]{}()\\]/u;
  public static readonly packageAssetsDefaultsUrl: string = "../..";
  public static readonly windowsLibraryExtension: string = ".dll";
  public static readonly licenseTextFilter: readonly string[] = ["*.txt"];
  public static readonly buildFolder: string = "_build";
  public static readonly windowLicensesSegments: readonly string[] = [Resources.buildFolder, "window", "3rdpartylicenses.txt"];
  public static readonly packagedLicensesFolder: string = "licenses";
  public static readonly windowLicensesFile: string = "window-third-party.txt";
  public static readonly builderExtensionMacro: string = "${ext}";
  public static readonly addonsPattern: string = `**/*${Resources.addonExtension}`;
  public static readonly appImageToolset: string = "1.0.3";
  public static readonly windowsSignedExtensions: readonly string[] = [Resources.addonExtension, Resources.windowsLibraryExtension, Resources.windowsProgramExtension];
  public static readonly windowsCommandFolder: string = "%~dp0..";
  public static readonly packagedResourcesFolder: string = "resources";
  public static readonly packagedArchiveFile: string = "app.asar";
  public static readonly packagedUnpackedFolder: string = `${Resources.packagedArchiveFile}.unpacked`;
  public static readonly packagedThirdPartySegments: readonly string[] = [Resources.packagedResourcesFolder, Resources.packagedUnpackedFolder, Resources.nodeModulesFolder];
  public static readonly windowsLineSeparator: string = "\r\n";
  public static readonly posixResourcesVariable: string = "$resources";
  public static readonly parentFolderSegment: string = "..";
  public static readonly macProgramSegments: readonly string[] = [Resources.parentFolderSegment, "MacOS"];
  public static readonly executableMode: number = 0o755;
  public static readonly debianUpdateInstallerFile: string = "linux-update-install";
  public static readonly debianUpdateArgumentsRefusedCode: number = 64;
  public static readonly debianUpdateChangedCode: number = 65;
  public static readonly debianUpdateNotInstalledCode: number = 66;
  public static readonly debianUpdateFolderPrefix: string = "noldova-desktop-update.";
  public static readonly debianUpdateCopyLimit: number = 300;
  public static readonly polkitActionsFolder: string = "/usr/share/polkit-1/actions";
  public static readonly polkitPolicyEnd: string = "NOLDOVA_UPDATE_POLICY";
  public static readonly polkitActionIdUnsafe: RegExp = /[^a-z0-9.-]/g;
  public static readonly polkitActionIdReplacement: string = "-";
  public static readonly afterInstallTemplateOption: string = "afterInstall";
  public static readonly afterRemoveTemplateOption: string = "afterRemove";
  public static readonly debianUpdateInstallerScript: string = [
    "#!/bin/sh",
    "set -eu",
    `[ "$#" -eq 3 ] || exit ${Resources.debianUpdateArgumentsRefusedCode}`,
    "file=$1",
    "hash=$2",
    "size=$3",
    `[ "\${#hash}" -eq 128 ] || exit ${Resources.debianUpdateArgumentsRefusedCode}`,
    "case $hash in",
    `  *[!0-9a-f]*) exit ${Resources.debianUpdateArgumentsRefusedCode} ;;`,
    "esac",
    "case $size in",
    `  ''|0*|*[!0-9]*) exit ${Resources.debianUpdateArgumentsRefusedCode} ;;`,
    "esac",
    `folder=$(/bin/mktemp -d -p /tmp ${Resources.debianUpdateFolderPrefix}XXXXXXXXXX)`,
    "trap '/bin/rm -rf -- \"$folder\"' EXIT",
    "trap 'exit 1' HUP INT TERM",
    "copy=$folder/update.deb",
    `/usr/bin/timeout ${String(Resources.debianUpdateCopyLimit)} /bin/cp --no-dereference -- "$file" "$copy" || exit ${Resources.debianUpdateChangedCode}`,
    `[ ! -L "$copy" ] && [ -f "$copy" ] || exit ${Resources.debianUpdateChangedCode}`,
    `[ "$(/usr/bin/stat --format=%s -- "$copy")" = "$size" ] || exit ${Resources.debianUpdateChangedCode}`,
    "actual=$(/usr/bin/sha512sum -- \"$copy\")",
    `[ "\${actual%% *}" = "$hash" ] || exit ${Resources.debianUpdateChangedCode}`,
    `/usr/bin/dpkg --install -- "$copy" || exit ${Resources.debianUpdateNotInstalledCode}`
  ].map(t => `${t}\n`).join(String.empty);
  public static readonly windowsSigningHash: string = "sha256";
  public static readonly windowsSignHookName: string = "windows-sign-hook";
  public static readonly packageFuses: Readonly<Record<string, boolean>> = {
    runAsNode: true,
    enableCookieEncryption: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    loadBrowserProcessSpecificV8Snapshot: false,
    grantFileProtocolExtraPrivileges: true
  };
  public static readonly installerTimeout: number = 120_000;
  public static readonly installerTemporaryVariable: string = "TMP";
  public static readonly installerTemporaryFallbackVariable: string = "TEMP";
  public static readonly installerTemporaryFolderPattern: RegExp = /^ns[^.]*\.tmp$/iu;
  public static readonly installerTemporaryMargin: number = 2_000;
  public static readonly installerTemporaryUnknown: string = "The installer's temporary folder is unknown: neither TMP nor TEMP is set.";
  public static readonly installerProcessVariable: string = "NOLDOVA_DESKTOP_INSTALLER_PROCESS";
  public static readonly installerProcessesTimeout: number = 30_000;
  public static readonly installerProcessesScript: string = [
    Resources.powershellStopLine,
    `$parent = [int]$env:${Resources.installerProcessVariable}`,
    "@(CimCmdlets\\Get-CimInstance -ClassName Win32_Process -Filter \"ParentProcessId = $parent\") | Microsoft.PowerShell.Core\\ForEach-Object {",
    "  \"$($_.ProcessId) $($_.Name), started $($_.CreationDate.ToString('HH:mm:ss')): $($_.CommandLine)\"",
    "}"
  ].join(Resources.lineSeparator);
  public static readonly localAppDataVariable: string = "LOCALAPPDATA";
  public static readonly windowsProgramsFolder: string = "Programs";
  public static readonly silentInstallArguments: readonly string[] = ["/S"];
  public static readonly uninstallerPrefix: string = "Uninstall ";
  public static readonly uninstallerInPlaceOption: string = "_?=";
  public static readonly removeRetries: number = 20;
  public static readonly removeRetryDelay: number = 500;
  public static readonly powershellModulePathVariable: string = "PSModulePath";
  public static readonly systemRootVariable: string = "SystemRoot";
  public static readonly windowsPowershellModulesSegments: readonly string[] = ["System32", "WindowsPowerShell", "v1.0", "Modules"];
  public static readonly installerAttachOptions: readonly string[] = [Resources.hdiutilNoBrowseOption, Resources.hdiutilReadonlyOption, Resources.hdiutilMountpointOption];
  public static readonly hdiutilDetachArguments: readonly string[] = [Resources.hdiutilDetachArgument, Resources.hdiutilForceOption];
  public static readonly installerMountFolder: string = "mount";
  public static readonly macBundleContentsFolder: string = "Contents";
  public static readonly macBundleProgramSegments: readonly string[] = [Resources.macBundleContentsFolder, "MacOS"];
  public static readonly macBundleResourcesSegments: readonly string[] = [Resources.macBundleContentsFolder, "Resources"];
  public static readonly appImageExtractArguments: readonly string[] = ["--appimage-extract"];
  public static readonly appImageExtractedFolder: string = "squashfs-root";
  public static readonly systemRootMissing: string = `${Resources.systemRootVariable} must name the Windows folder, whose PowerShell modules the smoke's PowerShell checks search first.`;
  public static readonly localAppDataMissing: string = `${Resources.localAppDataVariable} must name the folder the installer installs into for the user.`;
  public static readonly appDataVariable: string = "APPDATA";
  public static readonly appDataMissing: string = `${Resources.appDataVariable} must name the folder that holds the user's Start menu.`;
  public static readonly installFolderOption: string = "/D=";
  public static readonly startMenuProgramsSegments: readonly string[] = ["Microsoft", "Windows", "Start Menu", "Programs"];
  public static readonly shortcutExtension: string = ".lnk";
  public static readonly shortcutVariable: string = "NOLDOVA_DESKTOP_SHORTCUT";
  public static readonly shortcutTimeout: number = 120_000;
  public static readonly uninstallerVariable: string = "NOLDOVA_DESKTOP_UNINSTALLER";
  public static readonly uninstallFolderVariable: string = "NOLDOVA_DESKTOP_UNINSTALL_FOLDER";
  public static readonly uninstallWaitScript: string = [
    Resources.powershellStopLine,
    `$uninstall = Microsoft.PowerShell.Management\\Start-Process -FilePath $env:${Resources.uninstallerVariable} -ArgumentList @('/S', "_?=$env:${Resources.uninstallFolderVariable}") -Wait -PassThru`,
    "exit $uninstall.ExitCode"
  ].join(Resources.lineSeparator);
  public static readonly shortcutScript: string = [
    Resources.powershellStopLine,
    `(Microsoft.PowerShell.Utility\\New-Object -ComObject WScript.Shell).CreateShortcut($env:${Resources.shortcutVariable}).TargetPath`
  ].join(Resources.lineSeparator);
  public static readonly packageLayoutFolderSegments: readonly string[] = [Resources.buildFolder, "package"];
  public static readonly packageStageFolder: string = "app";
  public static readonly packageStagedProductSegments: readonly string[] = [Resources.buildFolder, "product.json"];
  public static readonly packageNpmCacheFolder: string = "npm-cache";
  public static readonly packageToolCacheFolder: string = "tool-cache";
  public static readonly packageOutputFolder: string = "out";
  public static readonly packageSmokeFolder: string = "smoke";
  public static readonly packageCommandFolder: string = "command";
  public static readonly packageSigningFolder: string = "signing";
  public static readonly runnerTemporaryVariable: string = "RUNNER_TEMP";
  public static readonly runnerSigningFolder: string = "noldova-package-signing";
  public static readonly packageArchiveCheckFolder: string = "archive-check";
  public static readonly packageConfigurationFile: string = "electron-builder.json";
  public static readonly packageReportFile: string = "package-report.json";
  public static readonly packageUpdateSignaturesFile: string = "update-signatures.json";
  public static readonly packageThirdPartyFolder: string = "third-party";
  public static readonly packageCompanyFolder: string = "company";
  public static readonly packageThirdPartyLicensesFile: string = "runtime-third-party.txt";
  public static readonly noneLabel: string = "none";
  public static readonly stageEntryPackages: readonly string[] = ["@noldova/desktop.electron", "@noldova/desktop.cli"];
  public static readonly desktopFileExtension: string = ".desktop";
  public static readonly stageNoticeRuleWidth: number = 80;
  public static readonly stageNoticeSeparator: string = `\n${"-".repeat(Resources.stageNoticeRuleWidth)}\n\n`;
  public static readonly stageUnreachableRegistry: string = "http://127.0.0.1:9/";
  public static readonly stageOverridesInvalid: string = "The root package.json's overrides must be an object, as npm reads them.";
  public static readonly stageOverrideReferencePrefix: string = "$";
  public static readonly stageOverrideSelfKey: string = ".";
  public static readonly stageInstallArguments: readonly string[] = [
    "install", "--offline", "--no-save", "--no-package-lock", "--omit=dev", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error",
    `--registry=${Resources.stageUnreachableRegistry}`, "--cache"
  ];
  public static readonly stageLicenseRole: string = "the license the package ships";
  public static readonly stageIconsRole: string = "the icons folder that desktop.product.icons names";
  public static readonly stageDictionariesRole: string = "the spelling dictionaries the window checks text with";
  public static readonly stageNoGallery: string = "The packaged window holds no Gallery.\n";
  public static readonly machCpuTypeOffset: number = 4;
  public static readonly machUniversalCountOffset: number = 4;
  public static readonly machThinMagic: number = 0xfeedfacf;
  public static readonly machThin32Magic: number = 0xfeedface;
  public static readonly machUniversalMagics: readonly number[] = [0xcafebabe, 0xcafebabf];
  public static readonly machUniversalArchitectureLimit: number = 30;
  public static readonly machCpuTypes: Readonly<Record<string, number>> = { arm64: 0x0100000c, x64: 0x01000007 };
  public static readonly machUniversalFile: string = "a universal Mach-O file";
  public static readonly mach32BitFile: string = "a 32-bit Mach-O file";
  public static readonly machKind: string = "Mach-O";
  public static readonly peHeaderOffsetField: number = 0x3c;
  public static readonly peSignatureLength: number = 6;
  public static readonly peMachineOffset: number = 4;
  public static readonly peMachines: Readonly<Record<string, number>> = { arm64: 0xaa64, x64: 0x8664, x86: 0x14c };
  public static readonly windowsRunnablePeMachines: readonly (readonly [string, string])[] = [
    ["x64", "x64"], ["x64", "x86"], ["arm64", "arm64"], ["arm64", "x64"], ["arm64", "x86"]
  ];
  public static readonly peKind: string = "PE";
  public static readonly elfClassOffset: number = 4;
  public static readonly elf64BitClass: number = 2;
  public static readonly elfDataOffset: number = 5;
  public static readonly elfLittleEndianData: number = 1;
  public static readonly elfMachineOffset: number = 18;
  public static readonly elfMachines: Readonly<Record<string, number>> = { arm64: 183, x64: 62 };
  public static readonly elfKind: string = "ELF";
  public static readonly elf32BitFile: string = "a 32-bit ELF file";
  public static readonly elfBigEndianFile: string = "a big-endian ELF file";
  public static readonly packagedBuildCommandLineName: string = "../build-command-line";
  public static readonly packagedBuildOptions: readonly string[] = [Resources.buildCommand, "--packaged", "--output"];
  public static readonly packagedWindowFolder: string = "window";
  public static readonly packagedBuildGalleryLeft: string = "The packaged build's Gallery file still brings in the Gallery.";
  public static readonly statusModulesField: string = "modules";
  public static readonly statusIdField: string = "id";
  public static readonly statusStateField: string = "state";
  public static readonly statusCauseField: string = "cause";
  public static readonly moduleActiveState: string = "Active";
  public static readonly moduleUnavailableState: string = "Unavailable";
  public static readonly moduleBlockedState: string = "Blocked";
  public static readonly moduleOffState: string = "Off";
  public static readonly packagedModulesNone: string = "The installed app has no modules.";
  public static readonly packagedModuleWithoutId: string = "a module without an id";
  public static readonly packagedModuleWithoutState: string = "in no state";
  public static readonly productWindowsPublisherField: string = "windowsPublisher";
  public static readonly productLinuxUpdateKeysField: string = "linuxUpdateKeys";
  public static readonly packagedUpdateKeysInvalid: string = `The packaged product file's ${Resources.productLinuxUpdateKeysField} must be a list of public keys, so its packages cannot be released.`;
  public static readonly publisherNoneVerified: string = `The installed package has no Windows publisher, and ${Resources.windowsPublisherVariable} is not set.`;
  public static readonly publisherMatchVerified: string = `The installed package's Windows publisher matches ${Resources.windowsPublisherVariable}.`;
  public static readonly errorCodeField: "code" = "code";
  public static readonly errorOutputField: "stdout" = "stdout";
  public static readonly chromiumNoSandboxOption: string = "--no-sandbox";
  public static readonly chromiumTypePrefix: string = "--type=";
  public static readonly chromiumRendererType: string = "renderer";
  public static readonly seccompFilterMode: number = 2;
  public static readonly processIdPattern: RegExp = /^[1-9]\d*$/u;
  public static readonly processParentLinePattern: RegExp = /^PPid:\s+(\d+)$/mu;
  public static readonly processSeccompLinePattern: RegExp = /^Seccomp:\s+(\d+)$/mu;
  public static readonly processStatusFile: string = "status";
  public static readonly processCommandLineFile: string = "cmdline";
  public static readonly processArgumentSeparator: RegExp = /[\0 ]+/u;
  public static readonly processEndedCodes: ReadonlySet<string> = new Set(["ENOENT", "ESRCH", "EACCES"]);
  public static readonly sandboxFilterWait: number = 5000;
  public static readonly sandboxPause: number = 250;
  public static readonly sandboxUntypedProcess: string = "untyped";
  public static readonly sandboxWithOption: string = "with";
  public static readonly sandboxWithoutOption: string = "without";
  public static readonly builderUnpackField: string = "asarUnpack";
  public static readonly unpackedPatternCharacters: RegExp = /[*?[\]{}()!\\]/u;
  public static readonly unpackedPackagesFolder: string = `${Resources.nodeModulesFolder}${Resources.pathSegmentSeparator}`;
  public static readonly unpackedPackagePrefix: string = `**/${Resources.unpackedPackagesFolder}`;
  public static readonly unpackedNoneVerified: string = "The package's configuration keeps no named file outside app.asar.";
  public static readonly statusWindowField: string = "window";
  public static readonly statusTitleField: string = "title";
  public static readonly statusIsVisibleField: string = "isVisible";
  public static readonly statusIsPaintedField: string = "isPainted";
  public static readonly windowTitlePageSeparator: string = " — ";
  public static readonly gypMakeExtension: string = ".mk";
  public static readonly shippedBuildFolder: string = "build";
  public static readonly shippedSourceFolder: string = "src";
  public static readonly shippedResourceForkPrefix: string = "._";
  public static readonly packageLockFileName: string = "package-lock.json";
  public static readonly shippedIgnoredNames: ReadonlySet<string> = new Set([
    ".git", ".hg", ".svn", "CVS", "RCS", "SCCS", "__pycache__", ".DS_Store", "thumbs.db", ".gitignore", ".gitkeep", ".gitattributes", ".npmignore", ".idea", ".vs",
    ".flowconfig", ".jshintrc", ".eslintrc", ".circleci", ".yarn-integrity", ".yarn-metadata.json", "yarn-error.log", "yarn.lock", Resources.packageLockFileName, "npm-debug.log",
    "pnpm-lock.yaml", "bun.lock", "bun.lockb", "appveyor.yml", ".travis.yml", "circle.yml", ".nyc_output", ".husky", ".github", "electron-builder.env"
  ]);
  public static readonly shippedAppIgnoredNames: ReadonlySet<string> = new Set([
    "electron-builder.yaml", "electron-builder.yml", Resources.packageConfigurationFile, "electron-builder.json5", "electron-builder.toml", "electron-builder.ts"
  ]);
  public static readonly shippedIgnoredExtensions: readonly string[] = [
    ".iml", ".hprof", ".orig", ".pyc", ".pyo", ".rbc", ".swp", ".csproj", ".sln", ".suo", ".xproj", ".cc", ".d.ts", Resources.gypMakeExtension, ".a", ".o", ".obj", ".forge-meta",
    ".pdb"
  ];
  public static readonly shippedTopIgnoredNames: ReadonlySet<string> = new Set([".yarn", ".editorconfig", ".yarnrc.yml"]);
  public static readonly shippedPackageIgnoredNames: ReadonlySet<string> = new Set([
    "CHANGELOG.md", "ChangeLog", "changelog.md", "Changelog.md", "Changelog", "binding.gyp", "node_gyp_bins"
  ]);
  public static readonly shippedWindowsExtensions: readonly string[] = [Resources.windowsLibraryExtension, Resources.windowsProgramExtension];
  public static readonly shippedPackageTopIgnoredNames: ReadonlySet<string> = new Set([
    "karma.conf.js", ".coveralls.yml", "README.md", "readme.markdown", "README", "readme.md", "Readme.md", "Readme", "readme", "test", "tests", "__tests__", "powered-test",
    "example", "examples", ".bin"
  ]);
  public static readonly shippedBuildIgnoredNames: ReadonlySet<string> = new Set(["gyp-mac-tool", "Makefile"]);
  public static readonly shippedBuildIgnoredExtensions: readonly string[] = [Resources.gypMakeExtension, ".gypi", ".Makefile"];
  public static readonly shippedReleaseFolder: string = "Release";
  public static readonly shippedReleaseIgnoredNames: ReadonlySet<string> = new Set([".deps", "obj.target"]);
  public static readonly shippedPackageIgnoredFolders: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ["keytar", new Set([Resources.shippedSourceFolder])], ["keytar-prebuild", new Set([Resources.shippedSourceFolder])],
    ["lzma-native", new Set([Resources.shippedBuildFolder, "deps"])]
  ]);
  public static readonly shippedPackageTopIgnoredFolders: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ["libui-node", new Set([Resources.shippedBuildFolder, "docs", Resources.shippedSourceFolder])]
  ]);
  public static readonly shippedScopedPackageOffset: number = 3;
  public static readonly shippedPackageOffset: number = 2;
  public static readonly shippedWindowsFilesOmission: string = "it leaves a package's .exe and .dll files out of macOS and Linux packages.";
  public static readonly shippedResourceForkOmission: string = `it leaves out every file and folder whose name starts with ${Resources.shippedResourceForkPrefix}.`;
  public static readonly signingCredentialNames: readonly string[] = [...Resources.windowsSigningCredentials, Resources.windowsPublisherVariable, ...Resources.macSigningCredentials,
    ...Resources.macInstallerSigningCredentials, ...Resources.linuxSigningCredentials];
  public static readonly installedLockfileSegments: readonly string[] = [Resources.nodeModulesFolder, ".package-lock.json"];
  public static readonly lockfileVersion: number = 3;
  public static readonly lockfileRootLocation: string = String.empty;
  public static readonly lockfileNestedFolder: string = `${Resources.pathSegmentSeparator}${Resources.nodeModulesFolder}${Resources.pathSegmentSeparator}`;
  public static readonly lockfileNegation: string = "!";
  public static readonly lockfilePlatforms: ReadonlyMap<string, string> = new Map([[Resources.windowsTarget, "win32"], [Resources.macosTarget, "darwin"], [Resources.linuxTarget, "linux"]]);
  public static readonly lockfileLinuxLibrary: string = "glibc";
  public static readonly lockfileVersionField: string = "lockfileVersion";
  public static readonly lockfilePackagesField: string = "packages";
  public static readonly lockfileDependenciesField: string = "dependencies";
  public static readonly lockfileOptionalDependenciesField: string = "optionalDependencies";
  public static readonly lockfilePeerDependenciesField: string = "peerDependencies";
  public static readonly lockfileOsField: string = "os";
  public static readonly lockfileCpuField: string = "cpu";
  public static readonly lockfileLibcField: string = "libc";
  public static readonly rootLockfileTitle: string = `The root ${Resources.packageLockFileName}`;
  public static readonly installedLockfileTitle: string = `npm's ${Resources.installedLockfileSegments.join(Resources.pathSegmentSeparator)}`;
  public static readonly trustedSigningModuleName: string = "TrustedSigning";
  public static readonly trustedSigningModuleVersion: string = "0.5.8";
  public static readonly trustedSigningModuleFolder: string = "module";
  public static readonly trustedSigningToolsFolder: string = "tools";
  public static readonly nugetFlatContainerUrl: string = "https://api.nuget.org/v3-flatcontainer";
  public static readonly nugetPackageExtension: string = ".nupkg";
  public static readonly trustedSigningTimeout: number = 300_000;
  public static readonly trustedSigningDownloadTimeout: number = 120_000;
  public static readonly pinnedPackageHashAlgorithm: string = "sha512";
  public static readonly powershellManifestExtension: string = ".psd1";
  public static readonly trustedSigningArchivesVariable: string = "NOLDOVA_DESKTOP_SIGNING_ARCHIVES";
  public static readonly trustedSigningDestinationsVariable: string = "NOLDOVA_DESKTOP_SIGNING_DESTINATIONS";
  public static readonly trustedSigningFolderVariable: string = "NOLDOVA_DESKTOP_SIGNING_FOLDER";
  public static readonly trustedSigningFileVariable: string = "NOLDOVA_DESKTOP_SIGNING_FILE";
  public static readonly trustedSigningEndpointVariable: string = "NOLDOVA_DESKTOP_SIGNING_ENDPOINT";
  public static readonly trustedSigningAccountVariable: string = "NOLDOVA_DESKTOP_SIGNING_ACCOUNT";
  public static readonly trustedSigningProfileVariable: string = "NOLDOVA_DESKTOP_SIGNING_PROFILE";
  public static readonly trustedSigningAccountVariables: readonly string[] = [
    Resources.trustedSigningEndpointVariable, Resources.trustedSigningAccountVariable, Resources.trustedSigningProfileVariable
  ];
  public static readonly trustedSigningFileSeparator: string = ",";
  public static readonly trustedSigningTimestampServer: string = "http://timestamp.acs.microsoft.com";
  public static readonly trustedSigningDigest: string = "SHA256";
  public static readonly trustedSigningImportLine: string = `Microsoft.PowerShell.Core\\Import-Module (Microsoft.PowerShell.Management\\Join-Path $env:${Resources.trustedSigningFolderVariable} `
    + `'${Resources.trustedSigningModuleFolder}' '${Resources.trustedSigningModuleName}${Resources.powershellManifestExtension}')`;
  public static readonly trustedSigningExpandScript: string = [
    Resources.powershellStopLine,
    `$archives = $env:${Resources.trustedSigningArchivesVariable}.Split([char]10)`,
    `$destinations = $env:${Resources.trustedSigningDestinationsVariable}.Split([char]10)`,
    "for ($index = 0; $index -lt $archives.Count; $index++) { Microsoft.PowerShell.Archive\\Expand-Archive -LiteralPath $archives[$index] -DestinationPath $destinations[$index] }",
    Resources.trustedSigningImportLine,
    `$module = Microsoft.PowerShell.Core\\Get-Module -Name ${Resources.trustedSigningModuleName}`,
    `if ($module.Version -ne [version]'${Resources.trustedSigningModuleVersion}') { throw "${Resources.trustedSigningModuleName} $($module.Version) loaded instead of ${Resources.trustedSigningModuleVersion}." }`
  ].join(Resources.lineSeparator);
  public static readonly trustedSigningSignLines: readonly string[] = [
    Resources.trustedSigningImportLine,
    `${Resources.trustedSigningModuleName}\\Invoke-TrustedSigning -Endpoint $env:${Resources.trustedSigningEndpointVariable} `
      + `-CodeSigningAccountName $env:${Resources.trustedSigningAccountVariable} -CertificateProfileName $env:${Resources.trustedSigningProfileVariable} -FileDigest '${Resources.trustedSigningDigest}' `
      + `-TimestampRfc3161 '${Resources.trustedSigningTimestampServer}' -TimestampDigest '${Resources.trustedSigningDigest}' -Files $env:${Resources.trustedSigningFileVariable}`
  ];
  public static readonly trustedSigningSignScript: string = [Resources.powershellStopLine, ...Resources.trustedSigningSignLines].join(Resources.lineSeparator);
  public static readonly trustedSigningLibrarySignScript: string = [
    Resources.powershellStopLine,
    `if ((Microsoft.PowerShell.Security\\Get-AuthenticodeSignature -LiteralPath $env:${Resources.trustedSigningFileVariable}).Status -eq 'Valid') { exit 0 }`,
    ...Resources.trustedSigningSignLines
  ].join(Resources.lineSeparator);
  public static readonly hashDigestEncoding: "base64" = "base64";
  public static readonly trustedSigningModuleSha512: string = "h3QX13+As/6i8v7rSUhgDWg033GklH5JiVLGFV0Rl3CipfT6/0XQPqEhI2uOogGTFkxiqXOTCeQc4zTSt2v6KQ==";
  public static readonly buildToolsPackageName: string = "Microsoft.Windows.SDK.BuildTools";
  public static readonly buildToolsPackageVersion: string = "10.0.26100.4188";
  public static readonly buildToolsPackageSha512: string = "OkiRhdDr0ngD6+wm0Ezdu1mgV8ZuknXdHwjzeHVZjYSXi9bCkYkq9Ns/X/ab9BoHb+Tq/5/RmXbdNWtC0qHipQ==";
  public static readonly signingClientPackageName: string = "Microsoft.Trusted.Signing.Client";
  public static readonly signingClientPackageVersion: string = "1.0.95";
  public static readonly signingClientPackageSha512: string = "uTRnbWSg1agZUh8J5bqJXhJr4LZ9dzs6Xy9PNxK4yA9ubpGuPq71bz1AZMmiKs/HVbQc3NUChtGMVexqmuV+kA==";
  public static readonly signToolPackageName: string = "sign";
  public static readonly signToolPackageVersion: string = "0.9.1-beta.24469.1";
  public static readonly signToolPackageSha512: string = "JftL2Fv9TwqfQdxh3Sjq/iqPb8lWEIMgDfa32KCXFqkebD1iadk10eRTjagVQgoxxRQiOp39eCd0ufs5cPD93A==";
  public static readonly trustedSigningExpandAction: string = "expanding and loading";
  public static readonly trustedSigningModuleUrl: string =
    `https://www.powershellgallery.com/api/v2/package/${Resources.trustedSigningModuleName}/${Resources.trustedSigningModuleVersion}`;
  public static readonly desktopUnpackedField: string = "unpacked";
  public static readonly installedPackageFolderPattern: RegExp = /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^@/][^/]*$/u;
  public static readonly absolutePathPattern: RegExp = /^(?:\/|[A-Za-z]:)/u;
  public static readonly currentFolderSegment: string = ".";
  public static readonly unpackedRelativeSegments: readonly string[] = [String.empty, Resources.currentFolderSegment, Resources.parentFolderSegment];
  public static readonly unpackedNamedTwice: string = "it names that file twice; name each file once.";
  public static readonly unpackedWildcardPath: string = "its path holds a character a file pattern reads as a wildcard; name the file with / between folders.";
  public static readonly unpackedAbsolutePath: string = "it is an absolute path; name the file from the package's folder.";
  public static readonly unpackedRelativePath: string = "its path has an empty, . or .. segment; name the file from the package's folder without one.";
  public static readonly unpackedPackagesPath: string = `its path goes into ${Resources.nodeModulesFolder}, which holds other packages; each package names only its own files.`;
  public static readonly unpackedNoFile: string = "the package holds no file there.";
  public static readonly unpackedLinkOutside: string = "a symbolic link on its path leads outside the package's own files; name a file the package holds itself.";
  public static readonly registryCommand: string = "reg.exe";
  public static readonly userEnvironmentKey: string = "HKCU\\Environment";
  public static readonly userPathName: string = "Path";
  public static readonly registryValueOption: string = "/v";
  public static readonly registryForceOption: string = "/f";
  public static readonly registryTypeOption: string = "/t";
  public static readonly registryDataOption: string = "/d";
  public static readonly userPathQueryArguments: readonly string[] = ["query", Resources.userEnvironmentKey, Resources.registryValueOption, Resources.userPathName];
  public static readonly userPathDeleteArguments: readonly string[] = ["delete", Resources.userEnvironmentKey, Resources.registryValueOption, Resources.userPathName,
    Resources.registryForceOption];
  public static readonly userPathAddArguments: readonly string[] = ["add", Resources.userEnvironmentKey, Resources.registryValueOption, Resources.userPathName];
  public static readonly registryMissingExitCode: number = 1;
  public static readonly registryTimeout: number = 30_000;
  public static readonly userPathValuePattern: RegExp = /^ {4}Path {4}(REG_(?:EXPAND_)?SZ) {4}([^\r\n]*)$/im;
  public static readonly userPathSeparator: string = ";";
  public static readonly windowsUnpackedFolderPrefix: string = "win";
  public static readonly windowsUnpackedFolderSuffix: string = "unpacked";
  public static readonly windowsUnpackedFolderSeparator: string = "-";
  public static readonly windowsDefaultArchitecture: string = "x64";
  public static readonly sourceFolder: string = "src";
  public static readonly jsonIndent: number = 2;
  public static readonly qualifiedNameSeparator: string = ".";
  public static readonly qualifiedNameForm: string = "<id>.<name>";
  public static readonly kebabSeparator: string = "-";
  public static readonly snakeSeparator: string = "_";
  public static readonly camelCaseNamePattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly qualifiedNamePattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-zA-Z0-9]*$/;
  public static readonly upperCaseLetterPattern: RegExp = /[A-Z]/g;
  public static readonly modulePartsExpected: string = `${Resources.runtimePart}, ${Resources.windowPart} or ${Resources.cliPart}`;
  public static readonly methodsKind: string = "methods";
  public static readonly eventsKind: string = "events";
  public static readonly commandsKind: string = "commands";
  public static readonly notificationsKind: string = "notifications";
  public static readonly viewsKind: string = "views";
  public static readonly documentsKind: string = "documents";
  public static readonly placeholdersKind: string = "placeholders";
  public static readonly statusBarItemsKind: string = "statusBarItems";
  public static readonly topBarActionsKind: string = "topBarActions";
  public static readonly menusKind: string = "menus";
  public static readonly themesKind: string = "themes";
  public static readonly toolsKind: string = "tools";
  public static readonly moduleContributionKinds: readonly string[] = [
    Resources.methodsKind, Resources.eventsKind, Resources.commandsKind, Resources.notificationsKind, Resources.viewsKind, Resources.documentsKind, Resources.placeholdersKind,
    Resources.statusBarItemsKind, Resources.topBarActionsKind, Resources.menusKind, Resources.themesKind, Resources.settingsKind, Resources.settingScopesKind,
    Resources.settingsPagesKind, Resources.cliCommandsKind, Resources.toolsKind
  ];
  public static readonly idField: string = "id";
  public static readonly versionField: string = "version";
  public static readonly displayNameField: string = "displayName";
  public static readonly descriptionField: string = "description";
  public static readonly partsField: string = "parts";
  public static readonly dependenciesField: string = "dependencies";
  public static readonly optionalDependenciesField: string = "optionalDependencies";
  public static readonly contributesField: string = "contributes";
  public static readonly pseudoTerminalsField: string = "pseudoTerminals";
  public static readonly switchSettingField: string = "switchSetting";
  public static readonly platformsField: string = "platforms";
  public static readonly noldovaDesktopField: string = "noldovaDesktop";
  public static readonly nameField: string = "name";
  public static readonly typeField: string = "type";
  public static readonly kindField: string = "kind";
  public static readonly localityField: string = "locality";
  public static readonly scopesField: string = "scopes";
  public static readonly summaryField: string = "summary";
  public static readonly argumentsField: string = "arguments";
  public static readonly optionsField: string = "options";
  public static readonly examplesField: string = "examples";
  public static readonly requiredField: string = "required";
  public static readonly variadicField: string = "variadic";
  public static readonly repeatedField: string = "repeated";
  public static readonly defaultField: string = "default";
  public static readonly keysField: string = "keys";
  public static readonly macKeysField: string = "macKeys";
  public static readonly loadingKeysField: string = "loadingKeys";
  public static readonly escapeKey: string = "Escape";
  public static readonly newWindowsField: string = "newWindows";
  public static readonly parametersField: string = "parameters";
  public static readonly valuesField: string = "values";
  public static readonly minimumField: string = "minimum";
  public static readonly maximumField: string = "maximum";
  public static readonly maxLengthField: string = "maxLength";
  public static readonly fieldsField: string = "fields";
  public static readonly placesField: string = "places";
  public static readonly groupsField: string = "groups";
  public static readonly titleField: string = "title";
  public static readonly showsField: string = "shows";
  public static readonly shownField: string = "shown";
  public static readonly afterField: string = "after";
  public static readonly beforeField: string = "before";
  public static readonly newRowField: string = "newRow";
  public static readonly bandField: string = "band";
  public static readonly placeField: string = "place";
  public static readonly exclusiveField: string = "exclusive";
  public static readonly dynamicField: string = "dynamic";
  public static readonly itemsField: string = "items";
  public static readonly commandField: string = "command";
  public static readonly labelField: string = "label";
  public static readonly submenuField: string = "submenu";
  public static readonly choiceField: string = "choice";
  public static readonly pagesField: string = "pages";
  public static readonly pageField: string = "page";
  public static readonly groupField: string = "group";
  public static readonly stepField: string = "step";
  public static readonly checkedField: string = "checked";
  public static readonly valueField: string = "value";
  public static readonly peerDependenciesField: string = "peerDependencies";
  public static readonly peerDependenciesMetaField: string = "peerDependenciesMeta";
  public static readonly optionalField: string = "optional";
  public static readonly packageField: string = "package";
  public static readonly desktopField: string = "desktop";
  public static readonly modulesField: string = "modules";
  public static readonly productField: string = "product";
  public static readonly permissionsModuleField: string = "permissionsModule";
  public static readonly modulesListSection: string = `${Resources.desktopField}.${Resources.modulesField}`;
  public static readonly textType: string = "Text";
  public static readonly numberType: string = "Number";
  public static readonly booleanType: string = "Boolean";
  public static readonly choiceType: string = "Choice";
  public static readonly modulesType: string = "Modules";
  public static readonly actionType: string = "Action";
  public static readonly deviceLocality: string = "Device";
  public static readonly sharedLocality: string = "Shared";
  public static readonly reservedCommands: readonly string[] = ["status", "commands", "run", "open", "quit", "help"];
  public static readonly reservedOptions: readonly string[] = ["data-dir", "device-dir", "timeout", "args-file", "json", "no-start", "take-over", "help"];
  public static readonly windowsDeviceNames: readonly string[] = [
    "con", "prn", "aux", "nul",
    "com0", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
    "lpt0", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"
  ];
  public static readonly moduleDeclarationFileName: string = "module.json";
  public static readonly moduleShellId: string = "desktop";
  public static readonly moduleReservedIds: readonly string[] = [Resources.moduleShellId, ...Resources.reservedCommands];
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly moduleToolPattern: RegExp = /^[a-z][a-z0-9_]{0,63}$/;
  public static readonly moduleToolNameLimit: number = 64;
  public static readonly moduleDeclarationFields: readonly string[] = [
    Resources.idField, Resources.versionField, Resources.displayNameField, Resources.descriptionField, Resources.partsField, Resources.dependenciesField,
    Resources.optionalDependenciesField, Resources.contributesField, Resources.pseudoTerminalsField, Resources.switchSettingField, Resources.platformsField,
    Resources.noldovaDesktopField
  ];
  public static readonly modulePlatforms: readonly string[] = [Resources.windowsTarget, Resources.macosTarget, Resources.linuxTarget];
  public static readonly modulePlatformsExpected: string = `${Resources.windowsTarget}, ${Resources.macosTarget} or ${Resources.linuxTarget}`;
  public static readonly moduleWindowEntry: string = "window/src/api/index";
  public static readonly moduleDependsOn: string = "depends on";
  public static readonly moduleOptionallyDependsOn: string = "optionally depends on";
  public static readonly moduleOptionalDependenciesLabel: string = "optional dependencies";
  public static readonly moduleVersionInvalid: string =
    "must have a version of the form <major>.<minor>.<patch>: three whole numbers of up to nine digits without leading zeros, such as 0.0.1";
  public static readonly moduleDisplayNameMissing: string = "must have a display name";
  public static readonly moduleDescriptionMissing: string = "must have a description";
  public static readonly moduleContributesNotObject: string = "must list its contributions as an object";
  public static readonly moduleFormerNamesNotObject: string = "must give its former names as an object from a command's or a document's name to the names it had before";
  public static readonly formerNamesField: string = "formerNames";
  public static readonly modulePlaceholderRepeated: string = "declares more than one placeholder, and a window shows one";
  public static readonly modulePlaceholderWithoutWindow: string = "declares a placeholder without a window part, which registers it";
  public static readonly moduleSettingsPagesWithoutWindow: string = "declares settings pages without a window part, which registers them";
  public static readonly moduleCliCommandsWithoutCli: string = "declares command-line commands without a cli part";
  public static readonly moduleWebViewsWithoutWindow: string = `declares web views in ${Resources.webViewsFileName} without a window part, which opens them`;
  public static readonly modulePseudoTerminalsNotBoolean: string = `must declare ${Resources.pseudoTerminalsField} as true or false`;
  public static readonly modulePseudoTerminalsWithoutRuntime: string = "declares pseudo-terminals without a runtime part, which starts them";
  public static readonly moduleSwitchSettingUnknown: string =
    `must name one of its own settings, which ${Resources.settingsFileName} defines, as its ${Resources.switchSettingField}`;
  public static readonly modulePlatformsEmpty: string =
    `must name at least one platform as its ${Resources.platformsField}, or leave the field out to run on every platform`;
  public static readonly versionPattern: RegExp = /^(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})$/;
  public static readonly versionRangePattern: RegExp = /^>=(\S+) <(\S+)$/;
  public static readonly versionSeparator: string = ".";
  public static readonly versionPartCount: number = 3;
  public static readonly moduleArtifactsFolder: string = "modules";
  public static readonly moduleDeclarationsFileName: string = "declarations.json";
  public static readonly moduleDeclarationsFile: string = `${Resources.buildFolder}/${Resources.moduleArtifactsFolder}/${Resources.moduleDeclarationsFileName}`;
  public static readonly moduleOutputDeclarationsSegments: readonly string[] = [Resources.moduleArtifactsFolder, Resources.moduleDeclarationsFileName];
  public static readonly moduleWindowPartsFile: string = `${Resources.buildFolder}/generated/window-parts.ts`;
  public static readonly moduleDeclarationsFormatVersion: number = 2;
  public static readonly windowPartSourceKinds: readonly string[] = [
    Resources.viewsKind, Resources.documentsKind, Resources.commandsKind, Resources.statusBarItemsKind, Resources.topBarActionsKind, Resources.notificationsKind
  ];
  public static readonly windowPartsSourceImport: string = "import { type IWindowInputs, WindowPartSource } from \"@noldova/desktop.window/build\";\n";
  public static readonly cliFileName: string = "cli.json";
  public static readonly cliCommandFields: readonly string[] = [
    Resources.nameField, Resources.summaryField, Resources.descriptionField, Resources.argumentsField, Resources.optionsField, Resources.examplesField
  ];
  public static readonly cliOptionalCommandFields: readonly string[] = [Resources.descriptionField, Resources.examplesField];
  public static readonly cliArgumentFields: readonly string[] = [Resources.nameField, Resources.descriptionField, Resources.requiredField, Resources.variadicField];
  public static readonly cliArgumentOptionalFields: readonly string[] = [Resources.requiredField, Resources.variadicField];
  public static readonly cliValueFields: readonly string[] = [
    Resources.nameField, Resources.descriptionField, Resources.typeField, Resources.requiredField, Resources.repeatedField, Resources.defaultField
  ];
  public static readonly cliValueOptionalFields: readonly string[] = [Resources.requiredField, Resources.repeatedField, Resources.defaultField];
  public static readonly cliBooleanFields: readonly string[] = [Resources.nameField, Resources.descriptionField, Resources.typeField];
  public static readonly cliExampleFields: readonly string[] = [Resources.argumentsField, Resources.descriptionField];
  public static readonly cliOptionTypes: readonly string[] = [Resources.textType, Resources.numberType, Resources.booleanType];
  public static readonly cliNameOrSummaryBlank: string = "must have a name and a summary that are not blank";
  public static readonly cliDescriptionBlank: string = "must have a description that is not blank, or none";
  public static readonly cliNamesRepeated: string = "must name each of its arguments and options once";
  public static readonly cliRequiredAfterOptional: string = "must not have a required argument after an optional one";
  public static readonly cliVariadicNotLast: string = "must have only its last argument variadic";
  public static readonly cliArgumentFlagsNotBoolean: string = "must have a required and a variadic that are true or false";
  public static readonly cliOptionTypeInvalid: string = `must have the type ${Resources.textType}, ${Resources.numberType} or ${Resources.booleanType}`;
  public static readonly cliValueFlagsNotBoolean: string = "must have a required and a repeated that are true or false";
  public static readonly cliDefaultInvalid: string = "must have a default its type accepts, or none, and none when it is required or repeated";
  public static readonly cliExampleInvalid: string = "must have arguments as text and a description that is not blank";
  public static readonly cliMemberInvalid: string = "must have a camelCase name and a description that is not blank";
  public static readonly menusFileName: string = "menus.json";
  public static readonly menuShowsMenu: string = "menu";
  public static readonly menuShowsMenuBar: string = "menuBar";
  public static readonly menuShowsToolbar: string = "toolbar";
  public static readonly menuShows: readonly string[] = [Resources.menuShowsMenu, Resources.menuShowsMenuBar, Resources.menuShowsToolbar];
  public static readonly menusFields: readonly string[] = [Resources.placesField, Resources.groupsField];
  public static readonly menuToolbarFields: readonly string[] = [Resources.shownField, Resources.afterField, Resources.beforeField, Resources.newRowField, Resources.bandField];
  public static readonly menuAnchorFields: readonly string[] = [Resources.afterField, Resources.beforeField];
  public static readonly menuPlaceFields: readonly string[] = [Resources.nameField, Resources.titleField, Resources.showsField, ...Resources.menuToolbarFields];
  public static readonly menuGroupFields: readonly string[] = [Resources.nameField, Resources.placeField, Resources.exclusiveField, Resources.dynamicField, Resources.itemsField];
  public static readonly menuCommandFields: readonly string[] = [Resources.commandField, Resources.argumentsField, Resources.labelField];
  public static readonly menuSubmenuFields: readonly string[] = [Resources.submenuField];
  public static readonly menuChoiceFields: readonly string[] = [Resources.choiceField];
  public static readonly menusFileInvalid: string = `must be a JSON object with ${Resources.placesField} and ${Resources.groupsField}`;
  public static readonly menusPlaceRepeated: string = "describes a place more than once";
  public static readonly menusGroupRepeated: string = "names a group more than once";
  public static readonly menusPlaceInvalid: string = "must describe each place with a name, a title and optionally shows";
  public static readonly menusGroupInvalid: string = "must describe each group with a name, a place, its items or dynamic, and optionally exclusive";
  public static readonly settingsFileFields: readonly string[] = [Resources.settingsKind, Resources.pagesField];
  public static readonly settingsPageFields: readonly string[] = [Resources.nameField, Resources.titleField];
  public static readonly settingFields: readonly string[] = [
    Resources.nameField, Resources.titleField, Resources.descriptionField, Resources.typeField, Resources.defaultField, Resources.localityField, Resources.scopesField,
    Resources.pageField, Resources.groupField
  ];
  public static readonly settingTextFields: readonly string[] = [Resources.titleField, Resources.descriptionField, Resources.pageField, Resources.groupField];
  public static readonly settingLocalities: readonly string[] = [Resources.deviceLocality, Resources.sharedLocality];
  public static readonly settingKindFields: ReadonlyMap<string, readonly string[]> = new Map([
    [Resources.booleanType, []],
    [Resources.choiceType, [Resources.optionsField]],
    [Resources.numberType, [Resources.minimumField, Resources.maximumField, Resources.stepField]],
    [Resources.textType, [Resources.maxLengthField]],
    [Resources.modulesType, []],
    [Resources.actionType, [Resources.commandField, Resources.labelField]]
  ]);
  public static readonly settingDynamicChoiceFields: readonly string[] = [Resources.dynamicField];
  public static readonly settingCheckedTextFields: readonly string[] = [Resources.maxLengthField, Resources.checkedField];
  public static readonly settingStepTolerance: number = 1e-9;
  public static readonly settingChoiceOptionFieldCount: number = 2;
  public static readonly settingFieldsInvalid: string = `must have exactly the fields ${Resources.settingFields.join(", ")}`;
  public static readonly settingTextsBlank: string = "must have a title, description, page and group that are not blank";
  public static readonly settingDefaultInvalid: string = "must have a default its type accepts";
  public static readonly settingLocalityInvalid: string = `must have the locality ${Resources.settingLocalities.join(" or ")}`;
  public static readonly settingScopesInvalid: string =
    `must list distinct scopes, each one its module declares among its ${Resources.settingScopesKind} or a dependency's, and none for a device setting`;
  public static readonly settingTypeInvalid: string =
    "must have a type of kind Boolean, Choice, Number, Text, Modules or Action, with exactly that kind's fields, a choice either options or dynamic, and a text optionally checked";
  public static readonly settingDynamicChoiceInvalid: string = "must have a dynamic choice type whose dynamic is true";
  public static readonly settingTextMaxLengthInvalid: string = "must have a text type whose maxLength is a positive integer";
  public static readonly settingCheckedTextInvalid: string = "must have a checked text type whose checked is true";
  public static readonly settingActionInvalid: string = "must have an action type whose command is one its module declares and whose label is not blank";
  public static readonly settingChoiceInvalid: string =
    "must have a choice type with options, each with a distinct value, empty or not blank, and a title that is not blank";
  public static readonly settingNumberInvalid: string = "must have a number type whose minimum is no greater than its maximum and whose step is positive";
  public static readonly modKey: string = "Mod";
  public static readonly ctrlKey: string = "Ctrl";
  public static readonly altKey: string = "Alt";
  public static readonly shiftKey: string = "Shift";
  public static readonly keyChordSeparator: string = "+";
  public static readonly functionKeyPattern: RegExp = /^F\d+$/;
  public static readonly functionKeyCount: number = 24;
  public static readonly webViewKeyModifiers: readonly string[] = [Resources.modKey, Resources.ctrlKey, Resources.altKey, Resources.shiftKey];
  public static readonly webViewKeyNames: readonly string[] = [
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "Backquote", "Minus", "Equal", "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period", "Slash",
    "Enter", "Escape", "Tab", "Space", "Backspace", "Delete", "Insert", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    ...Array.from({ length: Resources.functionKeyCount }, (_, index) => Resources.formatFunctionKey(index + 1))
  ];
  public static readonly webViewEditingKeys: readonly string[] = ["Mod+A", "Mod+C", "Mod+V", "Mod+X", "Mod+Z", "Mod+Y", "Mod+Shift+Z"];
  public static readonly webViewMacSystemKeys: readonly string[] = ["Mod+Q", "Mod+W", "Mod+H", "Mod+M", "Mod+Comma", "Mod+Tab", "Mod+Space", "Mod+Alt+Escape"];
  public static readonly webViewStandardSystemKeys: readonly string[] = ["Alt+F4", "Alt+Tab", "Mod+Escape"];
  public static readonly webViewShellKeys: readonly (readonly [string, readonly string[], readonly string[]])[] = [
    ["desktop.search", ["Mod+K"], ["Mod+K"]],
    ["desktop.showCommands", ["Mod+Shift+P"], ["Mod+Shift+P"]],
    ["desktop.goBack", ["Alt+ArrowLeft"], ["Mod+BracketLeft"]],
    ["desktop.goForward", ["Alt+ArrowRight"], ["Mod+BracketRight"]],
    ["desktop.openSettings", ["Mod+Comma"], ["Mod+Comma"]],
    ["desktop.closeTab", ["Mod+W"], ["Mod+W"]],
    ["desktop.nextTab", ["Ctrl+Tab", "Ctrl+PageDown"], ["Ctrl+Tab", "Mod+Alt+ArrowRight"]],
    ["desktop.previousTab", ["Ctrl+Shift+Tab", "Ctrl+PageUp"], ["Ctrl+Shift+Tab", "Mod+Alt+ArrowLeft"]],
    ["desktop.toggleLeftDock", ["Mod+B"], ["Mod+B"]],
    ["desktop.toggleBottomDock", ["Mod+J"], ["Mod+J"]],
    ["desktop.toggleRightDock", ["Mod+Alt+B"], ["Mod+Alt+B"]]
  ];
  public static readonly webViewStopAgentControlKey: string = "Mod+Shift+Period";
  public static readonly webViewKeysLimit: number = 32;
  public static readonly webViewChordsLimit: number = 4;
  public static readonly webViewMethodPattern: RegExp = /^[A-Z][A-Za-z]*\.[a-z][A-Za-z]*$/;
  public static readonly webViewRefusedMethods: readonly string[] = [
    "Page.navigate", "Page.navigateToHistoryEntry", "Page.reload", "Page.setDocumentContent", "Page.resetNavigationHistory",
    "Page.setInterceptFileChooserDialog", "Page.disable", "Page.setDownloadBehavior", "Page.close", "Page.crash",
    "Network.setRequestInterception", "Network.continueInterceptedRequest", "DOM.setFileInputFiles", "Input.dispatchDragEvent",
    "Input.setInterceptDrags", "DOM.getFileInfo", "Input.setIgnoreInputEvents"
  ];
  public static readonly webViewRefusedDomains: readonly string[] = ["Target", "Browser", "Fetch", "Security"];
  public static readonly webViewFields: readonly string[] = [Resources.methodsKind, Resources.eventsKind, Resources.keysField, Resources.newWindowsField, Resources.loadingKeysField];
  public static readonly webViewMethodFields: readonly string[] = [Resources.nameField, Resources.parametersField];
  public static readonly webViewKeyFields: readonly string[] = [Resources.nameField, Resources.keysField, Resources.macKeysField];
  public static readonly webViewRuleFields: readonly string[] = [
    Resources.requiredField, Resources.valuesField, Resources.minimumField, Resources.maximumField, Resources.maxLengthField, Resources.fieldsField
  ];
  public static readonly webViewStandardPlatforms: string = "Windows and Linux";
  public static readonly webViewMacPlatform: string = "macOS";
  public static readonly webViewFileInvalid: string =
    `must be an object with optional ${Resources.methodsKind}, ${Resources.eventsKind}, ${Resources.keysField}, ${Resources.newWindowsField} and ${Resources.loadingKeysField}`;
  public static readonly webViewMethodRepeated: string = "names a method more than once";
  public static readonly webViewEventsInvalid: string =
    "must list its events once each as a debugging protocol domain, a dot and a name, such as Page.loadEventFired";
  public static readonly webViewNewWindowsNotBoolean: string = `must say ${Resources.newWindowsField} as true or false`;
  public static readonly webViewKeysInvalid: string = `must name each of its keys and loading keys once, with at most ${Resources.webViewKeysLimit} names in all`;
  public static readonly modulePackageFixturesFolder: string = `${Resources.moduleFixtureFolder}/packages`;
  public static readonly modulesSourceFolder: string = `${Resources.sourceFolder}/modules`;
  public static readonly angularCorePackage: string = "@angular/core";
  public static readonly angularPeerRangeForm: string = ">=<the Angular it builds with> <the next Angular major>, such as >=22.2.5 <23.0.0";
  public static readonly desktopRuntimePackage: string = "@noldova/desktop.runtime";
  public static readonly catalogPeerFields: readonly string[] = [Resources.peerDependenciesField];
  public static readonly shellSettingsPages: readonly string[] = ["General", "Appearance", "Notifications", "Keyboard shortcuts", "Gallery", "About"];
  public static readonly moduleListRequired: string =
    `The root ${Resources.packageManifestFileName} must list the build's modules once each in ${Resources.modulesListSection}, each as its id or as { "id": "<id>", "package": "<package name>" }.`;
  public static readonly moduleListEntryFieldCount: number = 2;
  public static readonly packageNamePattern: RegExp = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
  public static readonly catalogAppHolder: string = "the app has";
  public static readonly catalogBuildHolder: string = "the build gives it";
  public static readonly catalogWorkspaceHolder: string = "the app's install has";
  public static readonly npmExecPathVariable: string = "npm_execpath";
  public static readonly npmUnavailable: string = `${Resources.npmExecPathVariable} is not set; run this through npm, such as npm run build or npm test.`;
  public static readonly npmCommandTimeout: number = 600_000;
  public static readonly nodeGypScriptSegments: readonly string[] = ["..", Resources.nodeModulesFolder, "node-gyp", "bin", "node-gyp.js"];
  public static readonly nodeGypTimeout: number = 600_000;
  public static readonly typeScriptManifestPath: string = "typescript/package.json";
  public static readonly typeScriptCompilerPath: string = "bin/tsc";
  public static readonly aboutLogoFolder: string = "about";
  public static readonly titleBarIconFolder: string = "title-bar";
  public static readonly windowBrowserFolder: string = "browser";
  public static readonly aboutLogoLightFile: string = "icon-light-512.png";
  public static readonly aboutLogoSeparator: string = "/";
  public static readonly allFilesPattern: string = "**/*";
  public static readonly angularWorkspaceFile: string = "angular.json";
  public static readonly angularProjectsField: string = "projects";
  public static readonly angularArchitectField: string = "architect";
  public static readonly angularInstallRecord: string = `${Resources.nodeModulesFolder}/.noldova-install`;
  public static readonly angularDependencyCache: string = `${Resources.nodeModulesFolder}/.vite`;
  public static readonly angularCli: string = `${Resources.nodeModulesFolder}/@angular/cli/bin/ng.js`;
  public static readonly playwrightCli: string = `${Resources.nodeModulesFolder}/playwright/cli.js`;
  public static readonly angularInstallArguments: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
  public static readonly angularSingleCopyPackage: string = "@angular/cdk";
  public static readonly angularListArguments: readonly string[] = ["ls", Resources.angularSingleCopyPackage, "--all", "--long", "--json"];
  public static readonly angularBrowserArguments: readonly string[] = ["install", "--only-shell", "chromium"];
  public static readonly angularTestTarget: string = "test";
  public static readonly angularBuildArguments: readonly string[] = ["build"];
  public static readonly angularOutputPathOption: string = "--output-path";
  public static readonly windowFolder: string = "window";
  public static readonly windowOutputSegments: readonly string[] = [Resources.buildFolder, Resources.windowFolder];
  public static readonly windowAppSuffix: string = ".window.app";
  public static readonly angularNoProject: string = `No window app in ${Resources.sourceFolder}/, a folder whose name ends in ${Resources.windowAppSuffix} and holds an angular.json; there is nothing to prepare.\n`;
  public static readonly angularInstalling: string = "Installing the app's packages from its package-lock.json...\n";
  public static readonly angularInstallingBrowser: string = "Installing the browser for the Angular tests...\n";
  public static readonly angularNotInstalled: string = `The app isn't installed for its package-lock.json; run ${Resources.commandName} ${Resources.installCommand} first, `
    + "with the token for the registry its packages come from.";
  public static readonly angularNoBrowser: string = `No test target in an angular.json of a folder in ${Resources.sourceFolder}/, so no browser for the Angular tests.\n`;
  public static readonly angularBrowserSubject: string = "The browser for the Angular tests";
  public static readonly angularBuilding: string = "Building the window...\n";
  public static readonly generatedFolder: string = "generated";
  public static readonly galleryFileSegments: readonly string[] = [Resources.buildFolder, Resources.generatedFolder, "gallery.ts"];
  public static readonly galleryTypeImport: string = "import type { Type } from \"@angular/core\";\n";
  public static readonly galleryComponentImport: string = "import { GalleryComponent } from \"@noldova/ui.components.angular/gallery\";\n";
  public static readonly productFileSegments: readonly string[] = [Resources.buildFolder, Resources.generatedFolder, "product.ts"];
  public static readonly productAboutTypeImport: string = "import type { IProductAbout, IProductTitleBar } from \"@noldova/desktop.window/build\";";
  public static readonly installedCopiesTrailSeparator: string = " > ";
  public static readonly npmListErrorField: string = "error";
  public static readonly npmListDependenciesField: string = "dependencies";
  public static readonly npmListVersionField: string = "version";
  public static readonly npmListPathField: string = "path";
  public static readonly windowsPlatform: string = "win32";
  public static readonly macPlatform: string = "darwin";
  public static readonly linuxPlatform: string = "linux";
  public static readonly developmentOutputSegments: readonly string[] = [Resources.buildFolder, "development-app"];
  public static readonly developmentPackageSegments: readonly string[] = [Resources.buildFolder, "development-package"];
  public static readonly developmentStampFile: string = "development-app.sha256";
  public static readonly developmentStampHash: string = "sha256";
  public static readonly developmentStampDigest: "hex" = "hex";
  public static readonly developmentCommandTimeout: number = 60_000;
  public static readonly developmentUnsupportedPlatform: string = "The development binary is supported on Windows, macOS and Linux only.";
  public static readonly developmentNoVersionInfo: string = "Electron's executable carries no version information to relabel.";
  public static readonly electronInstallerFile: string = "install.js";
  public static readonly electronPathFile: string = "path.txt";
  public static readonly electronDistributionSegments: readonly string[] = [...Resources.electronPackageSegments, Resources.electronDistributionFolder];
  public static readonly electronManifestSegments: readonly string[] = [...Resources.electronPackageSegments, Resources.packageManifestFileName];
  public static readonly electronInstallerSegments: readonly string[] = [...Resources.electronPackageSegments, Resources.electronInstallerFile];
  public static readonly electronInstallTimeout: number = 600_000;
  public static readonly electronName: string = "Electron";
  public static readonly electronWindowsExecutable: string = "electron.exe";
  public static readonly electronMacBundle: string = "Electron.app";
  public static readonly electronLinuxExecutable: string = "electron";
  public static readonly electronMacIconFile: string = "electron.icns";
  public static readonly electronMacHelperPrefix: string = "Electron Helper";
  public static readonly electronSubject: string = "Electron's binary";
  public static readonly electronInstalling: string = "Installing Electron's binary...\n";
  public static readonly electronStillMissing: string = "it reported success, but the binary is still missing";
  public static readonly windowsIconGroup: number = 1;
  public static readonly macIconExtension: string = ".icns";
  public static readonly macIconsetExtension: string = ".iconset";
  public static readonly macIconsetSizes: readonly (readonly [string, number])[] = [
    ["icon_16x16.png", 16], ["icon_16x16@2x.png", 32], ["icon_32x32.png", 32], ["icon_32x32@2x.png", 64], ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256], ["icon_256x256.png", 256], ["icon_256x256@2x.png", 512], ["icon_512x512.png", 512]
  ];
  public static readonly macResourcesSegments: readonly string[] = ["Contents", "Resources"];
  public static readonly macExecutableSegments: readonly string[] = ["Contents", "MacOS"];
  public static readonly macFrameworksSegments: readonly string[] = ["Contents", "Frameworks"];
  public static readonly macPlistSegments: readonly string[] = ["Contents", "Info.plist"];
  public static readonly macHelperIdentifierSuffix: string = ".helper";
  public static readonly macHelperRolePattern: RegExp = /[()]/g;
  public static readonly macResizeCommand: string = "sips";
  public static readonly macResizeSizeOption: string = "-z";
  public static readonly macResizeOutputOption: string = "--out";
  public static readonly macIconsetCommand: string = "iconutil";
  public static readonly macIconsetArguments: readonly string[] = ["--convert", "icns", "--output"];
  public static readonly macPlistCommand: string = "plutil";
  public static readonly macPlistReplaceOption: string = "-replace";
  public static readonly macPlistStringOption: string = "-string";
  public static readonly macPlistIconKey: string = "CFBundleIconFile";
  public static readonly macAdHocSignArguments: readonly string[] = ["--force", "--deep", "--sign", "-"];
  public static readonly chromeSandboxFile: string = "chrome-sandbox";
  public static readonly rootUserId: number = 0;
  public static readonly chromeSandboxMode: number = 0o4755;
  public static readonly userNamespaceRestrictions: readonly (readonly [string, string])[] = [
    ["/proc/sys/kernel/apparmor_restrict_unprivileged_userns", "1"],
    ["/proc/sys/kernel/unprivileged_userns_clone", "0"],
    ["/proc/sys/user/max_user_namespaces", "0"]
  ];
  public static readonly failureExitCode: number = 1;
  public static readonly githubErrorPrefix: string = "::error::";
  public static readonly outputOption: string = "--output";
  public static readonly buildUsage: string = `Usage: ${Resources.commandName} ${Resources.buildCommand} [--test [--without <module id>]... [--output <folder> [--update-feed <URL>]] | --packaged [--output <folder> [--update-feed <URL>]] | --shard=<1 or 2>/2 | --list-copies], where a URL is an https URL, or an http URL of localhost, ending in /\n`;
  public static readonly buildNoPackages: string = "No packages under src/; there is nothing to build.\n";
  public static readonly buildTestOption: string = "--test";
  public static readonly buildPackagedOption: string = "--packaged";
  public static readonly buildWithoutOption: string = "--without";
  public static readonly buildListCopiesOption: string = "--list-copies";
  public static readonly buildEndOfCopies: string = "end of copies\n";
  public static readonly installUsage: string = `Usage: ${Resources.commandName} ${Resources.installCommand} [--shard=<1 or 2>/2]\n`;
  public static readonly buildPartPattern: RegExp = /^--shard=([12])\/2$/u;
  public static readonly buildPackageTestsPart: number = 2;
  public static readonly buildOtherChecksPart: number = 1;
  public static readonly npmStartingFolderVariable: string = "INIT_CWD";
  public static readonly githubOutputVariable: string = "GITHUB_OUTPUT";
  public static readonly whitespacePattern: RegExp = /\s+/;
  public static readonly internalFeedVariable: string = "INTERNAL_FEED";
  public static readonly internalFeedUrlVariable: string = "INTERNAL_FEED_URL";
  public static readonly updateFeedVariable: string = "UPDATE_FEED";
  public static readonly packageVersionVariable: string = "PACKAGE_VERSION";
  public static readonly releaseVersionVariable: string = "RELEASE_VERSION";
  public static readonly runNumberVariable: string = "RUN_NUMBER";
  public static readonly runAttemptVariable: string = "RUN_ATTEMPT";
  public static readonly signingVariable: string = "SIGNING";
  public static readonly internalFeedBuildKind: string = "build";
  public static readonly internalFeedCopyKind: string = "copy";
  public static readonly internalFeedKinds: readonly string[] = [String.empty, Resources.internalFeedBuildKind, Resources.internalFeedCopyKind];
  public static readonly internalFeedSignedTargets: readonly string[] = [Resources.windowsTarget, Resources.macosTarget];
  public static readonly firstRunAttempt: string = "1";
  public static readonly chooseFeedNoOutputFile: string = `${Resources.githubOutputVariable} names no file for the step's update-feed and package-version outputs.`;
  public static readonly chooseFeedInternalWithTest: string = "A release for the internal update feed takes no update-feed or package-version of a test of updating.";
  public static readonly chooseFeedNoInternalUrl: string = `The variable ${Resources.internalFeedUrlVariable} names no internal update feed.`;
  public static readonly chooseFeedNotSigned: string = "Only the app's release repository, which signs Windows and macOS, builds for the internal update feed.";
  public static readonly targetCellSeparator: string = "|";
  public static readonly targetEachNight: string = "nightly";
  public static readonly targetByHand: string = "manual";
  public static readonly runnerVariablePrefix: string = "RUNS_ON_";
  public static readonly architectureArm64: string = "arm64";
  public static readonly optionalTargetArchitecture: string = Resources.architectureArm64;
  public static readonly publishedVersionsVariable: string = "PUBLISHED_VERSIONS";
  public static readonly moduleRangeNoOutputFile: string = `${Resources.githubOutputVariable} names no file for the step's range and version outputs.`;
  public static readonly moduleRangeNoPin: string = `The root ${Resources.packageManifestFileName} pins no Noldova Desktop package to one exact version, the version a module builds and tests against.`;
  public static readonly moduleRangeNoPublished: string = `${Resources.publishedVersionsVariable} holds no list of versions as npm view's JSON gives it.`;
  public static readonly feedSkipVariable: string = "SKIP_FEED_CHECK";
  public static readonly feedVersionVariable: string = "FEED_VERSION";
  public static readonly feedUrlVariable: string = "FEED_URL";
  public static readonly releaseRepositoryVariable: string = "RELEASE_REPOSITORY";
  public static readonly releaseSourceRepositoryVariable: string = "RELEASE_SOURCE_REPOSITORY";
  public static readonly releaseBuildRepositoryVariable: string = "RELEASE_BUILD_REPOSITORY";
  public static readonly gitHubPrivateField: string = "private";
  public static readonly sourceRepositoryLabel: string = "the source repository";
  public static readonly releaseTagPrefixVariable: string = "RELEASE_TAG_PREFIX";
  public static readonly releaseSetsVersionVariable: string = "RELEASE_SETS_VERSION";
  public static readonly releaseSetsVersionValue: string = "true";
  public static readonly releaseSetsVersionValues: readonly string[] = [String.empty, "false", Resources.releaseSetsVersionValue];
  public static readonly feedWaitVariable: string = "FEED_WAIT_SECONDS";
  public static readonly feedSkipValue: string = "true";
  public static readonly feedSkipValues: readonly string[] = [String.empty, "false", Resources.feedSkipValue];
  public static readonly feedSkipped: string = `${Resources.feedSkipVariable} is true, so the release skips the update feed check, and nothing is checked.\n`;
  public static readonly feedVersionPattern: RegExp = /^(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})(?:-internal\.(?:0|[1-9]\d{0,8}))?$/u;
  public static readonly feedWaitPattern: RegExp = /^(?:0|[1-9]\d{0,3})$/u;
  public static readonly feedDefaultWaitSeconds: number = 600;
  public static readonly feedMaximumWaitSeconds: number = 3600;
  public static readonly millisecondsPerSecond: number = 1000;
  public static readonly feedRetryInterval: number = 15_000;
  public static readonly feedDownloadLimit: number = 600_000;
  public static readonly feedMinimumRequestTimeout: number = 1;
  public static readonly feedMaximumRedirects: number = 5;
  public static readonly feedRedirectMode: "manual" = "manual";
  public static readonly redirectStatuses: readonly number[] = [301, 302, 303, 307, 308];
  public static readonly locationHeader: string = "location";
  public static readonly contentTypeHeader: string = "content-type";
  public static readonly releaseAssetOrigins: readonly string[] = ["https://release-assets.githubusercontent.com", "https://objects.githubusercontent.com"];
  public static readonly commaSeparator: string = ",";
  public static readonly webPageContentType: string = "text/html";
  public static readonly feedFileHash: string = "sha512";
  public static readonly feedFileDigest: "base64" = "base64";
  public static readonly yamlQuote: string = "'";
  public static readonly yamlEscapedQuote: string = "''";
  public static readonly yamlQuotedPattern: RegExp = /^'(.*)'$/u;
  public static readonly feedVersionLinePattern: RegExp = /^version: (.+)$/mu;
  public static readonly feedEntryStartPattern: RegExp = /^ {2}- url: /gmu;
  public static readonly feedFileEntryPattern: RegExp = /^ {2}- url: (.+)\n {4}sha512: (.+)\n {4}size: (\d+)$/gmu;
  public static readonly updateMetadataSignaturePattern: RegExp = /^ {2}- url: (.+)\n {4}sha512: .+\n {4}size: \d+\n {4}signature: (.+)$/gmu;
  public static readonly feedUrlCarriesSecret: string = `${Resources.feedUrlVariable} must not carry user info, a query or a fragment, which could hold a secret, so it is not shown here.`;
  public static readonly releaseRevisionVariable: string = "RELEASE_REVISION";
  public static readonly productUpdateFeedField: string = "updateFeed";
  public static readonly productInstallFolderField: string = "installFolder";
  public static readonly productTitleBarNameField: string = "titleBarName";
  public static readonly productTitleBarIconField: string = "titleBarIcon";
  public static readonly releaseAssetsUsage: string = `Usage: ${Resources.commandName} ${Resources.releaseAssetsCommand} [${Resources.updateFeedOption} <https URL, or http URL of localhost, ending in />]\n`;
  public static readonly mainBranch: string = "main";
  public static readonly onMainStatuses: readonly string[] = ["identical", "ahead"];
  public static readonly buildRunsRoute: string = `/actions/workflows/build-and-test.yml/runs?event=push&branch=${Resources.mainBranch}&per_page=1&head_sha=`;
  public static readonly successConclusion: string = "success";
  public static readonly gitHubStatusField: string = "status";
  public static readonly gitHubConclusionField: string = "conclusion";
  public static readonly gitHubWorkflowRunsField: string = "workflow_runs";
  public static readonly comparisonLabel: string = `the comparison with ${Resources.mainBranch}`;
  public static readonly buildRunsLabel: string = "Build and test runs";
  public static readonly buildRunLabel: string = "the Build and test run";
  public static readonly signedOutput: string = "signed";
  public static readonly productFeedOutput: string = "product-feed";
  public static readonly signedPlatformsSeparator: string = " ";
  public static readonly noSignedPlatforms: string = "none";
  public static readonly releaseFolderVariable: string = "RELEASE_FOLDER";
  public static readonly releaseReportsVariable: string = "RELEASE_REPORTS";
  public static readonly releaseRunVariable: string = "RELEASE_RUN_URL";
  public static readonly releaseLockRunVariable: string = "RELEASE_LOCK_RUN";
  public static readonly releaseLockRevisionVariable: string = "RELEASE_LOCK_REVISION";
  public static readonly releaseLockRunPattern: RegExp = /^[1-9][0-9]{0,19}$/u;
  public static readonly releaseLockReference: string = "refs/locks/release";
  public static readonly releaseLockPath: string = "/git/refs/locks/release";
  public static readonly releaseLockReadPath: string = "/git/ref/locks/release";
  public static readonly releaseLockMessagePattern: RegExp = /^Release lock for run ([1-9][0-9]{0,19})$/u;
  public static readonly releaseLockRetryInterval: number = 15_000;
  public static readonly releaseLockContext: string = "the release lock";
  public static readonly releaseLockRunContext: string = "the run holding the release lock";
  public static readonly githubCommitsPath: string = "/git/commits";
  public static readonly githubMessageField: string = "message";
  public static readonly githubTreeField: string = "tree";
  public static readonly githubParentsField: string = "parents[]";
  public static readonly githubForceField: string = "force";
  public static readonly githubStatusField: string = "status";
  public static readonly githubCompletedStatus: string = "completed";
  public static readonly releaseUpdateFeedVariable: string = "RELEASE_UPDATE_FEED";
  public static readonly releaseInternalVariable: string = "RELEASE_INTERNAL_VERSION";
  public static readonly uploadLabelMark: string = "#";
  public static readonly releaseInternalPattern: RegExp = /^((?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8}))-internal\.(?:0|[1-9]\d{0,8})$/u;
  public static readonly packageSignedOption: string = "--signed";
  public static readonly packageUsage: string = `Usage: ${Resources.commandName} ${Resources.packageCommand} [${Resources.packageSignedOption}] [${Resources.updateFeedOption} <https URL, or http URL of localhost, ending in />]\n`;
  public static readonly commonJsScope: string = `${JSON.stringify({ type: "commonjs" })}\n`;
  public static readonly packageBuilderName: string = "../packaging/package-builder";
  public static readonly builderPublishNever: "never" = "never";
  public static readonly builderRunExport: "build" = "build";
  public static readonly builderRunMissing: string = "electron-builder exports no build function, so the package cannot be built.";
  public static readonly macApplicationsFolder: string = "/Applications";
  public static readonly macInstallerOverwriteAction: string = "upgrade";
  public static readonly debianInstallPrefix: string = "/opt";
  public static readonly debianAppMappingPattern: RegExp = /^(.+\/=)\/opt\/([^/]+)$/;
  public static readonly debianExecPattern: RegExp = /^(Exec="?)\/opt\//m;
  public static readonly fpmPackageOption: string = "--package";
  public static readonly fpmAppMappingSeparator: string = "/=";
  public static readonly packageTypeFile: string = "package-type";
  public static readonly builderModule: string = "electron-builder";
  public static readonly builderLibraryManifest: string = "app-builder-lib/package.json";
  public static readonly builderLinuxTemplatesSegments: readonly string[] = ["templates", "linux"];
  public static readonly packageDebianTemplatesFolder: string = "debian-templates";
  public static readonly debianTemplates: ReadonlyMap<string, string> = new Map([["afterInstall", "after-install.tpl"], ["afterRemove", "after-remove.tpl"],
    ["appArmorProfile", "apparmor-profile.tpl"]]);
  public static readonly debianTemplateProductPath: string = "/opt/${sanitizedProductName}/";
  public static readonly debianCommandTemplates: ReadonlySet<string> = new Set(["after-install.tpl", "after-remove.tpl"]);
  public static readonly debianTemplateProgram: string = "'/opt/${sanitizedProductName}/${executable}'";
  public static readonly debianTemplateCommand: string = "'/opt/${sanitizedProductName}/resources/bin/${executable}'";
  public static readonly diskImageDetachFailure: string = "Unable to detach device cleanly";
  public static readonly builderDetachRetry: string = "electron-builder could not detach the disk image it was making while macOS still held its volume; building the packages again, once.\n";
  public static readonly builderVariables: ReadonlySet<string> = new Set([
    "PATH", "PATHEXT", "COMSPEC", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS",
    "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "USER", "USERNAME", "LOGNAME",
    "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"
  ]);
  public static readonly builderCacheVariable: string = "ELECTRON_BUILDER_CACHE";
  public static readonly builderIdentityDiscoveryOff: string = "false";
  public static readonly builderCompressionFilterVariable: string = "ELECTRON_BUILDER_7Z_FILTER";
  public static readonly builderX86Filter: string = "BCJ";
  public static readonly zipExtension: string = ".zip";
  public static readonly smokeRemoveLeftoverOption: string = "--remove-leftover";
  public static readonly smokeRequireSandboxOption: string = "--require-sandbox";
  public static readonly smokeRequireFallbackOption: string = "--require-fallback";
  public static readonly smokeDebianOption: string = "--deb";
  public static readonly smokeMacInstallerOption: string = "--pkg";
  public static readonly smokeRunningAppOption: string = "--running-app";
  public static readonly smokeSandboxOptions: readonly string[] = [Resources.smokeRequireSandboxOption, Resources.smokeRequireFallbackOption, Resources.chromiumNoSandboxOption];
  public static readonly smokeOptions: readonly string[] = [Resources.smokeRemoveLeftoverOption, Resources.smokeRunningAppOption, ...Resources.smokeSandboxOptions];
  public static readonly smokeUsage: string = `Usage: ${Resources.commandName} ${Resources.packageSmokeCommand} [${Resources.smokeDebianOption}] [${Resources.smokeSandboxOptions.join(" | ")}]\n`
    + `       ${Resources.commandName} ${Resources.packageSmokeCommand} ${Resources.smokeMacInstallerOption}\n`
    + `       ${Resources.commandName} ${Resources.packageSmokeCommand} ${Resources.smokeRunningAppOption}\n`
    + `       ${Resources.commandName} ${Resources.packageSmokeCommand} ${Resources.smokeRemoveLeftoverOption}\n`;
  public static readonly smokeRunningAppNotWindows: string = `${Resources.smokeRunningAppOption} installs over the running app, which only a Windows package's installer does, so it runs on Windows alone.`;
  public static readonly smokeHeldFolder: string = "smoke-held";
  public static readonly smokeHeldScript: string = "setTimeout(() => undefined, 600000)";
  public static readonly smokeHeldArguments: readonly string[] = ["-e", Resources.smokeHeldScript];
  public static readonly smokeHeldLogFile: string = "held.log";
  public static readonly smokeMainProcessName: string = "the main process";
  public static readonly smokeRuntimeName: string = "the runtime";
  public static readonly smokeRunningAppEnded: string = "Installed over the running app: the installer ended its main process, its runtime and another program in its folder, and installed.\n";
  public static readonly smokeOtherUserVariable: string = "NOLDOVA_SMOKE_OTHER_USER";
  public static readonly smokeOtherPasswordVariable: string = "NOLDOVA_SMOKE_OTHER_PASSWORD";
  public static readonly smokeOtherProgramVariable: string = "NOLDOVA_SMOKE_OTHER_PROGRAM";
  public static readonly smokeOtherFolderVariable: string = "NOLDOVA_SMOKE_OTHER_FOLDER";
  public static readonly smokeOtherUserStartLimit: number = 30_000;
  public static readonly smokeOtherUserCommandLimit: number = 120_000;
  public static readonly smokeOtherOutputFile: string = "other-user-output.log";
  public static readonly smokeOtherErrorFile: string = "other-user-errors.log";
  public static readonly smokeOtherUserSkipped: string = `No other user's app was started, since ${Resources.smokeOtherUserVariable} names no account.\n`;
  public static readonly smokeMomentBeforeReinstall: string = "before the installer ran";
  public static readonly smokeMomentAfterReinstall: string = "after the installer refused";
  public static readonly smokeMacInstallerNotFoldered: string = `Only an app that names an install folder makes a macOS installer package, so ${Resources.smokeMacInstallerOption} `
    + "smokes it on macOS alone.";
  public static readonly smokeDebianNotLinux: string = `Only the Linux package is also a Debian package, so ${Resources.smokeDebianOption} smokes it on Linux alone.`;
  public static readonly sudoCommand: string = "sudo";
  public static readonly smokeNeighbourName: string = "Smoke Neighbour";
  public static readonly smokeNeighbourBundle: string = `${Resources.smokeNeighbourName}${Resources.appBundleExtension}`;
  public static readonly mkdirCommand: string = "mkdir";
  public static readonly mkdirParentsOption: string = "-p";
  public static readonly removeCommand: string = "rm";
  public static readonly removeRecursiveOption: string = "-rf";
  public static readonly macInstallerCommand: string = "installer";
  public static readonly macInstallerPackageOption: string = "-pkg";
  public static readonly macInstallerTargetOption: string = "-target";
  public static readonly macInstallerRootTarget: string = "/";
  public static readonly pkgutilForgetOption: string = "--forget";
  public static readonly installerPackageInfoFromApp: readonly string[] = ["..", "..", "PackageInfo"];
  public static readonly sudoNonInteractiveOption: string = "--non-interactive";
  public static readonly aptGetCommand: string = "apt-get";
  public static readonly aptGetLockWaitSeconds: number = 60;
  public static readonly aptGetInstallArguments: readonly string[] = ["-o", `DPkg::Lock::Timeout=${Resources.aptGetLockWaitSeconds}`, "install", "--yes"];
  public static readonly aptGetRemoveArguments: readonly string[] = ["-o", `DPkg::Lock::Timeout=${Resources.aptGetLockWaitSeconds}`, "remove", "--yes"];
  public static readonly aptGetSimulateArguments: readonly string[] = ["--simulate", "install", "--yes"];
  public static readonly aptGetUpdateArguments: readonly string[] = ["update"];
  public static readonly aptGetInstalledPrefix: string = "Inst ";
  public static readonly aptGetInstalledDetails: RegExp = /\s.*$/;
  public static readonly dpkgDebCommand: string = "dpkg-deb";
  public static readonly dpkgQueryCommand: string = "dpkg-query";
  public static readonly dpkgQueryStatusArguments: readonly string[] = ["--show", "--showformat=${db:Status-Status}"];
  public static readonly debianNotInstalledStatus: string = "not-installed";
  public static readonly pkgutilPackagesOption: string = "--pkgs";
  public static readonly dpkgDebFieldOption: string = "--field";
  public static readonly debianPackageField: string = "Package";
  public static readonly readlinkCommand: string = "readlink";
  public static readonly readlinkCanonicalOption: string = "--canonicalize-existing";
  public static readonly linuxCommandFolder: string = "/usr/bin";
  public static readonly bashCommand: string = "bash";
  public static readonly bashCommandOption: string = "-c";
  public static readonly debianNamespaceProbe: string = "[[ -L /proc/self/ns/user ]] && unshare --user true";
  public static readonly statCommand: string = "stat";
  public static readonly statOwnerAndModeOption: string = "--format=%u:%a";
  public static readonly sandboxHelperPlainMode: string = "755";
  public static readonly sandboxHelperSetuidMode: string = "4755";
  public static readonly debianUpdateInstallerMode: string = "755";
  public static readonly apparmorStatusCommand: string = "apparmor_status";
  public static readonly apparmorEnabledOption: string = "--enabled";
  public static readonly apparmorParserCommand: string = "apparmor_parser";
  public static readonly apparmorDryRunOptions: readonly string[] = ["--skip-kernel-load", "--debug"];
  public static readonly apparmorProfileFile: string = "apparmor-profile";
  public static readonly apparmorProfilesFolder: string = "/etc/apparmor.d";
  public static readonly apparmorLoadedProfiles: string = "/sys/kernel/security/apparmor/profiles";
  public static readonly testCommand: string = "test";
  public static readonly testMissingOption: string = "!";
  public static readonly testExistsOption: string = "-e";
  public static readonly testFolderOption: string = "-d";
  public static readonly cmpCommand: string = "cmp";
  public static readonly cmpSilentOption: string = "--silent";
  public static readonly grepCommand: string = "grep";
  public static readonly grepWholeLineOptions: readonly string[] = ["--quiet", "--fixed-strings", "--line-regexp"];
  public static readonly smokeNothingLeft: string = "Nothing an earlier run installed was left.";
  public static readonly smokeNoRuntimeExitCode: number = 3;
  public static readonly smokeCommandLimit: number = 30_000;
  public static readonly timedOutOutputLines: number = 20;
  public static readonly trailingCarriageReturn: RegExp = /\r$/u;
  public static readonly smokeStartLimit: number = 60_000;
  public static readonly smokeQuitLimit: number = 30_000;
  public static readonly smokeStopLimit: number = 90_000;
  public static readonly smokeKillLimit: number = 10_000;
  public static readonly smokeNamespaceProbeLimit: number = 10_000;
  public static readonly smokePollInterval: number = 500;
  public static readonly smokeFolderPrefix: string = "nol-smoke-";
  public static readonly smokeDataFolder: string = "data";
  public static readonly smokeDeviceFolder: string = "device";
  public static readonly logsFolder: string = "logs";
  public static readonly smokeMainLogFile: string = "main.log";
  public static readonly smokeKilledMainLogFile: string = "main-killed.log";
  public static readonly smokeDataLogSegments: readonly string[] = [Resources.logsFolder, Resources.smokeMainLogFile];
  public static readonly smokeRuntimeLogSegments: readonly string[] = [Resources.logsFolder, "runtime.log"];
  public static readonly runtimeDiscoverySegments: readonly string[] = ["discovery", "runtime.json"];
  public static readonly dataDirectoryOption: string = "--data-dir";
  public static readonly deviceDirectoryOption: string = "--device-dir";
  public static readonly discoveryProcessIdField: string = "processId";
  public static readonly statusBuildField: string = "build";
  public static readonly statusVersionField: string = "productVersion";
  public static readonly statusDataDirectoryField: string = "dataDirectory";
  public static readonly smokeJsonOption: string = "--json";
  public static readonly smokeStatusCommand: string = "status";
  public static readonly smokeStatusArguments: readonly string[] = [Resources.smokeStatusCommand, Resources.smokeJsonOption];
  public static readonly smokeQuitArguments: readonly string[] = ["quit", Resources.smokeJsonOption, "--timeout", String(Resources.smokeQuitLimit / Resources.millisecondsPerSecond)];
  public static readonly quitOutcomeField: string = "outcome";
  public static readonly quitOutcome: string = "Quit";
  public static readonly smokeLogTailLength: number = 4_000;
  public static readonly smokeScreenCaptureCommand: string = "screencapture";
  public static readonly smokeSilentCaptureOption: string = "-x";
  public static readonly pngExtension: string = ".png";
  public static readonly githubStepSummaryVariable: string = "GITHUB_STEP_SUMMARY";
  public static readonly killSignal: NodeJS.Signals = "SIGKILL";
  public static readonly probeSignal: 0 = 0;
  public static readonly refusedSignalCode: string = "EPERM";
  public static readonly taskkillCommand: string = "taskkill.exe";
  public static readonly taskkillTreeArguments: readonly string[] = ["/T", "/F", "/PID"];
  public static readonly whoamiSegments: readonly string[] = ["System32", "whoami.exe"];
  public static readonly whoamiPrivilegesArguments: readonly string[] = ["/priv", "/fo", "csv", "/nh"];
  public static readonly debugPrivilegeEnabledLine: string = "\"SeDebugPrivilege\",\"Debug programs\",\"Enabled\"";
  public static readonly taskkillTimeout: number = 10_000;
  public static readonly taskkillEndedPattern: RegExp = /^[^\r\n]*?PID (\d+)/gm;
  public static readonly psCommand: string = "ps";
  public static readonly psProcessGroupArguments: readonly string[] = ["-A", "-o", "pid=,pgid=,lstart="];
  public static readonly psStartTolerance: number = 2_000;
  public static readonly processListEnvironment: Readonly<Record<string, string>> = { LC_ALL: "C" };
  public static readonly processListTimeout: number = 60_000;
  public static readonly processListOutputLimit: number = 16 * 1024 * 1024;
  public static readonly processListArguments: readonly string[] = ["-NoProfile", "-NonInteractive", "-Command"];
  public static readonly processListScript: string = "Get-CimInstance -Query 'SELECT ProcessId, ParentProcessId, CreationDate FROM Win32_Process' | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, " +
    "$_.ParentProcessId, $(if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 'unknown' }) }";
  public static readonly processParentPattern: RegExp = /^[ \t]*(\d+)[ \t]+(\d+)[ \t]+(\S[^\r\n]*?)[ \t]*\r?$/gm;
  public static readonly processExitWait: number = 2_000;
  public static readonly processTreeRounds: number = 10;
  public static readonly processTreeGrace: number = 5_000;
  public static readonly processTreeGracePoll: number = 100;
  public static readonly ignoreStdio: "ignore" = "ignore";
  public static readonly pipeStdio: "pipe" = "pipe";
  public static readonly inheritStdio: "inherit" = "inherit";
  public static readonly dataEvent: "data" = "data";
  public static readonly errorEvent: "error" = "error";
  public static readonly closeEvent: "close" = "close";
  public static readonly exitEvent: "exit" = "exit";
  public static readonly spawnEvent: "spawn" = "spawn";
  public static readonly windowsCommandShell: string = "cmd.exe";
  public static readonly otherUserStartScript: string = [
    Resources.powershellStopLine,
    "$watch = [System.Diagnostics.Stopwatch]::StartNew()",
    `$user = $env:${Resources.smokeOtherUserVariable}`,
    `$null = icacls.exe $env:${Resources.smokeOtherFolderVariable} /grant "\${user}:(OI)(CI)RX"`,
    "if ($LASTEXITCODE -ne 0) { throw \"icacls exited with $LASTEXITCODE.\" }",
    "[Console]::Error.WriteLine(\"Gave $user read access to the app's folder after $($watch.ElapsedMilliseconds) ms.\")",
    `$password = Microsoft.PowerShell.Security\\ConvertTo-SecureString $env:${Resources.smokeOtherPasswordVariable} -AsPlainText -Force`,
    "$credential = Microsoft.PowerShell.Utility\\New-Object System.Management.Automation.PSCredential($user, $password)",
    `$name = [System.IO.Path]::GetFileNameWithoutExtension($env:${Resources.smokeOtherProgramVariable})`,
    "$before = @(Microsoft.PowerShell.Management\\Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })",
    `$hold = 'set ${Resources.runAsNodeVariable}=${Resources.runAsNodeValue}&& "' + $env:${Resources.smokeOtherProgramVariable} + '" -e "${Resources.smokeHeldScript}"'`,
    `$shell = Microsoft.PowerShell.Management\\Start-Process -FilePath ${Resources.windowsCommandShell} -ArgumentList '/c', $hold -WorkingDirectory $env:${Resources.smokeOtherFolderVariable} `
      + `-RedirectStandardOutput ${Resources.smokeOtherOutputFile} -RedirectStandardError ${Resources.smokeOtherErrorFile} -Credential $credential -LoadUserProfile -PassThru`,
    "$null = $shell.Handle",
    `[Console]::Error.WriteLine("Signed $user in, loading their profile, and started ${Resources.windowsCommandShell} after $($watch.ElapsedMilliseconds) ms.")`,
    `$deadline = (Microsoft.PowerShell.Utility\\Get-Date).AddMilliseconds(${String(Resources.smokeOtherUserStartLimit)})`,
    "for (;;) {",
    "  $held = @(Microsoft.PowerShell.Management\\Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id })",
    "  if ($held.Count -gt 0) { break }",
    `  if ($shell.HasExited) { throw "${Resources.windowsCommandShell} exited with $($shell.ExitCode) before the app started." }`,
    `  if ((Microsoft.PowerShell.Utility\\Get-Date) -gt $deadline) { throw "The app did not start within ${String(Resources.smokeOtherUserStartLimit)} ms." }`,
    `  Microsoft.PowerShell.Utility\\Start-Sleep -Milliseconds ${String(Resources.smokePollInterval)}`,
    "}",
    "$held[0].Id"
  ].join(Resources.lineSeparator);
  public static readonly windowsCommandShellOptions: readonly string[] = ["/d", "/c"];
  public static readonly powerShellOptions: readonly string[] = ["-NoProfile", "-NonInteractive", "-Command"];
  public static readonly pathVariable: string = "PATH";
  public static readonly linkCommand: string = "ln";
  public static readonly linkSymbolicOption: string = "-s";
  public static readonly smokeCopyRecordPattern: RegExp = /^copy-[0-9a-f-]{36}\.log$/;
  public static readonly smokeStartLogPattern: RegExp = /^start-[0-9a-f-]{36}\.log$/;
  public static readonly copyRecordExtractionField: string = "extraction";
  public static readonly procFolder: string = "/proc";
  public static readonly procProgramLink: string = "exe";
  public static readonly procInputLinkSegments: readonly string[] = ["fd", "0"];
  public static readonly pipeLinkPrefix: string = "pipe:";
  public static readonly mountTableSegments: readonly string[] = ["self", "mountinfo"];
  public static readonly fuseMountPattern: RegExp = / - fuse[. ]/;
  public static readonly mountFieldSeparator: string = " ";
  public static readonly mountPointField: number = 4;
  public static readonly smokeReplacementSuffix: string = ".replacement";
  public static readonly elfMagic: string = "\x7fELF";
  public static readonly elfMagicEncoding: BufferEncoding = "latin1";
  public static readonly appImageExtractAndRunVariable: string = "APPIMAGE_EXTRACT_AND_RUN";
  public static readonly appImageExtractAndRunValue: string = "1";
  public static readonly bytesPerMebibyte: number = 1_048_576;
  public static readonly electronFuseSentinel: Buffer = Buffer.from("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX");
  public static readonly electronFuseWireVersion: number = 1;
  public static readonly electronFuseHeaderLength: number = 2;
  public static readonly cookieEncryptionFuse: number = 1;
  public static readonly electronFuseEnabled: number = 0x31;
  public static readonly electronFuseDisabled: number = 0x30;
  public static readonly macBundleFromProgram: readonly string[] = ["..", "..", ".."];
  public static readonly macFuseBinarySegments: readonly string[] = ["..", "Frameworks", "Electron Framework.framework", "Electron Framework"];
  public static readonly smokePathHoldsIntro: string = "The user's Path holds";
  public static readonly smokePathHoldsAgainIntro: string = "Installed again over itself, the user's Path still holds";
  public static readonly smokeMomentBeforeStart: string = "before the start";
  public static readonly smokeMomentAfterStart: string = "after the start";
  public static readonly smokeMomentQuit: string = "quit";
  public static readonly smokeMomentAfterRuntimeStopped: string = "after the runtime stopped";
  public static readonly smokeMomentStopped: string = "stopped";
  public static readonly smokeMomentKilled: string = "was killed";
  public static readonly smokeMomentPowerShell: string = "through PowerShell";
  public static readonly smokeMomentLink: string = "through a link to the app's command";
  public static readonly smokeMomentDebianCommand: string = "through the Debian package's command, with no display";
  public static readonly smokeMomentAppImageCommandLine: string = "through the AppImage's --command-line flag, with no display";
  public static readonly displayVariables: readonly string[] = ["DISPLAY", "WAYLAND_DISPLAY"];
  public static readonly commandLineOption: string = "--command-line";
  public static readonly smokeMomentReplaced: string = "after the AppImage was replaced";
  public static readonly smokeMainQuit: string = "The main process quit.\n";
  public static readonly smokeRuntimeStopped: string = "The runtime stopped once idle.\n";
  public static readonly smokeUninstalled: string = "Uninstalled: the program and its command are gone, and the user's Path is as it was before the install.\n";
  public static readonly smokeCookiesOn: string = "on, for the app's web views";
  public static readonly smokeCookiesOff: string = "off, as the app has no web views";
  public static readonly smokeNoSandboxNotice: string = `With ${Resources.chromiumNoSandboxOption}, the app starts without Chromium's sandbox.\n`;
  public static readonly smokeRequireSandboxNotice: string = `With ${Resources.smokeRequireSandboxOption}, the app must start with Chromium's sandbox, as its own processes show, whatever the probe here says.\n`;
  public static readonly smokeRequireFallbackNotice: string = `With ${Resources.smokeRequireFallbackOption}, the AppImage's launcher must start the app with ${Resources.chromiumNoSandboxOption}, `
    + "as its own processes show, whatever the probe here says.\n";
  public static readonly smokeDebianSandboxNotice: string = "The Debian package's after-install script sets Chromium's sandbox up, so the app must start with it, as its own processes show.\n";
  public static readonly smokeMainStillRunning: string = `The main process was still running ${Resources.smokeKillLimit} ms after it was killed.`;
  public static readonly userNamespacesProbeLine: string = `${Resources.userNamespacesProbeCommand} ${Resources.userNamespacesProbeArguments.join(" ")}`;
  public static readonly smokeNoProcRefusal: string = ", though no setting in /proc/sys refuses unprivileged user namespaces";
  public static readonly fieldPathSeparator: string = ".";
  public static readonly packageSegmentSeparator: string = ".";
  public static readonly hashEntrySeparator: string = " ";
  public static readonly problemSeparator: string = " ";
  public static readonly relativeSpecifierPrefix: string = ".";
  public static readonly hiddenEntryPrefix: string = ".";
  public static readonly packageScopeMark: string = "@";
  public static readonly architectureX64: string = "x64";
  public static readonly targetNameWordSeparator: string = " ";
  public static readonly buildTargetLinuxX64: string = "Linux x64";
  public static readonly buildTargetLinuxArm64: string = "Linux ARM64";
  public static readonly buildTargetWindowsX64: string = "Windows x64";
  public static readonly buildTargetWindowsArm64: string = "Windows ARM64";
  public static readonly buildTargetMacosX64: string = "macOS x64";
  public static readonly buildTargetMacosArm64: string = "macOS ARM64";
  public static readonly buildRunnerLinux: string = "LINUX";
  public static readonly buildRunnerLinuxArm64: string = "LINUX_ARM64";
  public static readonly buildRunnerWindows: string = "WINDOWS";
  public static readonly buildRunnerWindowsArm64: string = "WINDOWS_ARM64";
  public static readonly buildRunnerMacos: string = "MACOS";
  public static readonly buildRunnerMacosArm64: string = "MACOS_ARM64";
  public static readonly testsFolder: string = "tests";
  public static readonly scriptsFolder: string = "scripts";
  public static readonly assetsFolder: string = "assets";
  public static readonly gitFolder: string = ".git";
  public static readonly sourceFolderPrefix: string = `${Resources.sourceFolder}${Resources.pathSegmentSeparator}`;
  public static readonly sourceModulesFolder: string = "src/modules";
  public static readonly moduleFixturePrefix: string = `${Resources.moduleFixtureFolder}${Resources.pathSegmentSeparator}`;
  public static readonly projectFile: string = "tsconfig.json";
  public static readonly baseProjectFile: string = "tsconfig-base.json";
  public static readonly licenseFile: string = "LICENSE";
  public static readonly readmeFile: string = "README.md";
  public static readonly modulePackageFiles: readonly string[] = [Resources.moduleDeclarationFileName, Resources.settingsFileName, Resources.menusFileName, Resources.cliFileName, Resources.webViewsFileName];
  public static readonly packageResourcesFile: string = "resources.js";
  public static readonly buildScriptFile: string = "build.ts";
  public static readonly buildScriptSegments: readonly string[] = [Resources.scriptsFolder, Resources.buildScriptFile];
  public static readonly declarationSegments: readonly string[] = ["api", "index.d.ts"];
  public static readonly declarationExtension: string = ".d.ts";
  public static readonly archivePackageFolder: string = "package";
  public static readonly archiveScopePattern: RegExp = /^@([^/]+)\/(.+)$/;
  public static readonly archiveScopeReplacement: string = "$1-$2";
  public static readonly recordExtension: string = ".txt";
  public static readonly testRecordExtension: string = ".tests.txt";
  public static readonly archivesFolder: string = "_packages";
  public static readonly buildPackagesFolder: string = "packages";
  public static readonly recordsFolder: string = "records";
  public static readonly nodeGypFolder: string = "node-gyp";
  public static readonly windowInstallRecordFile: string = "window-install.txt";
  public static readonly productFile: string = "product.json";
  public static readonly productBuildFileSegments: readonly string[] = [Resources.buildFolder, Resources.productFile];
  public static readonly manifestNameField: string = "name";
  public static readonly manifestVersionField: string = "version";
  public static readonly manifestDependenciesField: string = "dependencies";
  public static readonly manifestOptionalDependenciesField: string = "optionalDependencies";
  public static readonly manifestDevDependenciesField: string = "devDependencies";
  public static readonly manifestFilesField: string = "files";
  public static readonly manifestExportsField: string = "exports";
  public static readonly manifestCommitField: string = "gitHead";
  public static readonly manifestNoldovaField: string = "noldova";
  public static readonly manifestDesktopField: "desktop" = "desktop";
  public static readonly manifestOverridesField: string = "overrides";
  public static readonly coverageExclusionsField: string = "coverageExclusions";
  public static readonly windowsAddonsField: string = "windowsAddons";
  public static readonly posixAddonsField: string = "posixAddons";
  public static readonly modulePackagePrefixField: string = "modulePackagePrefix";
  public static readonly protocolVersionField: string = "protocolVersion";
  public static readonly installedDependencyFields: readonly string[] = [Resources.manifestDependenciesField, Resources.manifestOptionalDependenciesField];
  public static readonly stampedDependencyFields: readonly string[] = [Resources.manifestDependenciesField, Resources.peerDependenciesField];
  public static readonly lockIntegrityField: string = "integrity";
  public static readonly windowExportPath: string = "./window";
  public static readonly windowImportFields: readonly string[] = [Resources.manifestDependenciesField, Resources.manifestOptionalDependenciesField, Resources.peerDependenciesField];
  public static readonly nodeSideDependencyFields: readonly string[] = [Resources.manifestDependenciesField, Resources.manifestOptionalDependenciesField, Resources.peerDependenciesField];
  public static readonly windowSideKey: string = "window:";
  public static readonly nodeSideKey: string = "node:";
  public static readonly windowExportConditions: readonly string[] = ["import", "default"];
  public static readonly scopedPackageNameSegments: number = 2;
  public static readonly packageNameSegments: number = 1;
  public static readonly packageVersionPlaceholder: string = "__VERSION__";
  public static readonly packageNextMinorPlaceholder: string = "__NEXT_MINOR__";
  public static readonly packagePeerRangePlaceholder: string = Resources.formatVersionRange(Resources.packageVersionPlaceholder, Resources.packageNextMinorPlaceholder);
  public static readonly protocolVersionPlaceholder: string = ["__PROTOCOL", "VERSION__"].join("_");
  public static readonly packageNoCoverageExclusions: string = "[]";
  public static readonly angularScope: string = "@angular/";
  public static readonly packageAddonNamePattern: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  public static readonly fixturePackageIdPrefix: string = "fixture-";
  public static readonly noldovaScope: string = "@noldova/";
  public static readonly noldovaCompanyScope: string = "@noldova-com/";
  public static readonly lowerCasePackageFolderPattern: RegExp = /^noldova(?:\.[a-z][a-z0-9]*)+$/;
  public static readonly titleCasePackageFolderPattern: RegExp = /^Noldova(?:\.[A-Z][A-Za-z0-9]*)+$/;
  public static readonly desktopLibraryPackage: string = "@noldova/desktop";
  public static readonly companyDesktopLibraryPackage: string = "@noldova-com/desktop";
  public static readonly corePackageParts: readonly string[] = ["build", "cli", "electron", "protocol", "runtime", "window"];
  public static readonly nodeSidePackages: readonly string[] = ["build", "cli", "electron", "protocol", "runtime"].map(t => `${Resources.modulesPrefix}${t}`);
  public static readonly fixturePackagePrefix: string = "@noldova/desktop.fixture.";
  public static readonly contextPackagePrefix: string = "@noldova/context.";
  public static readonly kitPackage: string = "@noldova/ui.components.angular";
  public static readonly windowPackage: string = "@noldova/desktop.window";
  public static readonly windowPackageSuffix: string = ".window";
  public static readonly addonSourceSegments: readonly string[] = [Resources.sourceFolder, Resources.addonOutputFolder];
  public static readonly addonSourceExtension: string = ".c";
  public static readonly addonProjectFile: string = "binding.gyp";
  public static readonly addonBuiltSegments: readonly string[] = ["build", "Release"];
  public static readonly addonNodeApiVersion: number = 8;
  public static readonly addonNodeApiDefine: string = `NAPI_VERSION=${Resources.addonNodeApiVersion}`;
  public static readonly addonRebuildArguments: readonly string[] = ["rebuild", "--loglevel=error", "--enable-lto=false", "--enable-thin-lto=false"];
  public static readonly addonHeadersDownloadOption: string = "--devdir";
  public static readonly addonHeadersInstallArguments: readonly string[] = ["install", "--loglevel=error"];
  public static readonly addonHeadersAttempts: number = 3;
  public static readonly addonHeadersStalledExitCode: number = 6;
  public static readonly addonHeadersStalledText: string = "Completion callback never invoked!";
  public static readonly addonLocalHeadersOption: string = "--nodedir";
  public static readonly addonLocalHeadersSegments: readonly string[] = ["include", "node", "common.gypi"];
  public static readonly addonNoToolchainText: string = "Could not find any Visual Studio installation to use";
  public static readonly addonKindWindows: string = "Windows";
  public static readonly addonKindPosix: string = "POSIX";
  public static readonly addonToolchainWorkload: string = "the \"Desktop development with C++\" workload of Visual Studio or the Visual Studio Build Tools, 2022 or later";
  public static readonly addonToolchainWorkloadArm64: string = `${Resources.addonToolchainWorkload}, with its C++ ARM64 build tools component`;
  public static readonly tarBlockSize: number = 512;
  public static readonly tarNameEnd: number = 100;
  public static readonly tarSizeStart: number = 124;
  public static readonly tarSizeEnd: number = 136;
  public static readonly tarTypeAt: number = 156;
  public static readonly tarPrefixStart: number = 345;
  public static readonly tarPrefixEnd: number = 500;
  public static readonly tarSizeRadix: number = 8;
  public static readonly tarReadFileTypes: readonly string[] = ["0", "\0"];
  public static readonly tarExtendedType: string = "x";
  public static readonly tarTypeEncoding: BufferEncoding = "latin1";
  public static readonly tarPathRecordPattern: RegExp = /^\d+ path=(.*)$/m;
  public static readonly tarFieldEndPattern: RegExp = /\0.*$/s;
  public static readonly hashAlgorithm: string = "sha256";
  public static readonly hashEncoding: "hex" = "hex";
  public static readonly hashPartSeparator: string = "\0";
  public static readonly localUrlProtocol: string = "http:";
  public static readonly updateFeedLocalHosts: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);
  public static readonly updateFeedUnsafePattern: RegExp = /[\s?#]/u;
  public static readonly buildRootInputs: readonly string[] = [Resources.packageManifestFileName, Resources.packageLockFileName, Resources.baseProjectFile];
  public static readonly angularInputs: readonly string[] = [Resources.packageManifestFileName, Resources.projectFile];
  public static readonly buildToolFolderUrl: string = "../../";
  public static readonly angularInstallSubject: string = "the Angular packages";
  public static readonly rootInstallSubject: string = "the packages built on Angular packages";
  public static readonly fixtureTestBuildOnly: string = "left to the test build, since it builds on an Angular package";
  public static readonly fixtureTypeChecked: string = "type-checked";
  public static readonly packageReused: string = "reused";
  public static readonly packageBuilt: string = "built";
  public static readonly packageTestsCompiled: string = "compiled";
  public static readonly staleHash: string = "stale";
  public static readonly absentLockfileHash: string = "none";
  public static readonly missingInputHash: string = "missing";
  public static readonly gitCommitArguments: readonly string[] = ["rev-parse", "--verify", "--quiet", "HEAD"];
  public static readonly gitCommitExitCodes: readonly number[] = [0, 1];
  public static readonly gitStatusArguments: readonly string[] = ["status", "--porcelain"];
  public static readonly buildScriptTimeoutMargin: number = 60_000;
  public static readonly buildScriptTimeout: number = Resources.compileTimeout + Resources.carryTimeout + Resources.buildScriptTimeoutMargin;
  public static readonly compilerProjectOption: string = "--project";
  public static readonly compilerNoEmitOption: string = "--noEmit";
  public static readonly compilerRootOption: string = "--rootDir";
  public static readonly compilerOutputOption: string = "--outDir";
  public static readonly compilerSourceMapOption: string = "--sourceMap";
  public static readonly testSourceLinkType: "junction" = "junction";
  public static readonly alwaysPackedPattern: RegExp = /^(?:readme|license|licence)(?:\.[^/]*)?$/i;
  public static readonly trailingSlashesPattern: RegExp = /\/+$/;
  public static readonly globDescendantsSuffix: string = "/**";
  public static readonly npmPackArguments: readonly string[] = ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination"];
  public static readonly npmInstallArguments: readonly string[] = ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];
  public static readonly buildScriptInputsRule: string = `A build script lists with ${Resources.inputsOption} only what the build copies into the package from outside it, each under its own name.`;
  public static readonly rootVersionPattern: RegExp = /^\d+\.\d+\.\d+(-(0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;
  public static readonly rootVersionInvalid: string = "The root package.json must declare a version of the form major.minor.patch, with an optional prerelease such as -rc.1.";
  public static readonly rootProtocolVersionInvalid: string = "The root package.json's desktop.protocolVersion must be a positive whole number.";
  public static readonly rootModulesPrefixInvalid: string = "The root package.json's desktop.modulePackagePrefix must be a scope and a slash, then optionally a name ending in - or ., such as @example/ or @example/app.";
  public static readonly productAboutField: string = "about";
  public static readonly productNameField: string = "name";
  public static readonly productPublisherField: string = "publisher";
  public static readonly productSlugField: string = "slug";
  public static readonly productApplicationIdField: string = "applicationId";
  public static readonly productDevelopmentApplicationIdField: string = "developmentApplicationId";
  public static readonly productDataFolderField: string = "dataFolder";
  public static readonly productDeviceFoldersField: string = "deviceFolders";
  public static readonly productDataDirectoryVariableField: string = "dataDirectoryVariable";
  public static readonly productIconsField: string = "icons";
  public static readonly productReleaseRepositoryField: string = "releaseRepository";
  public static readonly productCategoriesField: string = "categories";
  public static readonly productWindowsSigningField: string = "windowsSigning";
  public static readonly productPermissionsModuleField: string = "permissionsModule";
  public static readonly productDescriptionField: string = "description";
  public static readonly productWebsiteField: string = "website";
  public static readonly productReleasesField: string = "releases";
  public static readonly productLicensesField: string = "licenses";
  public static readonly productWindowsDeviceFolderPath: string = Resources.formatFieldPath(Resources.productDeviceFoldersField, Resources.windowsTarget);
  public static readonly productMacosDeviceFolderPath: string = Resources.formatFieldPath(Resources.productDeviceFoldersField, Resources.macosTarget);
  public static readonly productLinuxDeviceFolderPath: string = Resources.formatFieldPath(Resources.productDeviceFoldersField, Resources.linuxTarget);
  public static readonly productMacCategoryPath: string = Resources.formatFieldPath(Resources.productCategoriesField, Resources.macosTarget);
  public static readonly productLinuxCategoryPath: string = Resources.formatFieldPath(Resources.productCategoriesField, Resources.linuxTarget);
  public static readonly productDescriptionPath: string = Resources.formatFieldPath(Resources.productAboutField, Resources.productDescriptionField);
  public static readonly productWebsitePath: string = Resources.formatFieldPath(Resources.productAboutField, Resources.productWebsiteField);
  public static readonly productReleasesPath: string = Resources.formatFieldPath(Resources.productAboutField, Resources.productReleasesField);
  public static readonly productLicensesPath: string = Resources.formatFieldPath(Resources.productAboutField, Resources.productLicensesField);
  public static readonly productDefaultMacCategory: string = "public.app-category.developer-tools";
  public static readonly productDefaultLinuxCategory: string = "Development";
  public static readonly productApplicationIdPattern: RegExp = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/;
  public static readonly productSlugPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly productVariablePattern: RegExp = /^[A-Z][A-Z0-9_]*$/;
  public static readonly productRepositoryPattern: RegExp = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;
  public static readonly productUnsafeNamePattern: RegExp = /["\\%!$`#/?<>:*|[\]{}\p{Cc}]|[. ]$|^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\..*)?$/iu;
  public static readonly productUnsafePublisherPattern: RegExp = /["\\\n\r%!$`]/;
  public static readonly productLineBreakPattern: RegExp = /[\n\r]/;
  public static readonly productWhitespacePattern: RegExp = /\s/u;
  public static readonly productMacCategoryPattern: RegExp = /^public\.app-category\.[a-z]+(?:-[a-z]+)*$/;
  public static readonly productLinuxCategoryPattern: RegExp = /^[A-Z][A-Za-z]*$/;
  public static readonly productUnsafeSegmentPattern: RegExp = /[\\:*?"<>|]/;
  public static readonly productTitleBarIconFilePattern: RegExp = /\.(?:png|svg)$/i;
  public static readonly productTitleBarIconDataPattern: RegExp = /^data:image\/(?:png|svg\+xml)(?:;base64)?,\S+$/;
  public static readonly checkoutHashLength: number = 8;
  public static readonly checkoutVariableSuffix: string = "_CHECKOUT";
  public static readonly productNameExpected: string = "a name without quotes, backslashes, % ! $ ` # / ? < > : * | [ ] { } or control characters, with no dot or space at its end, "
    + "and not a name Windows reserves, such as CON";
  public static readonly productPublisherExpected: string = "a name without quotes, backslashes, % ! $ ` or line breaks";
  public static readonly productSlugExpected: string = "lowercase kebab-case";
  public static readonly productApplicationIdExpected: string = "a lowercase reverse-DNS ID";
  public static readonly productDevelopmentApplicationIdExpected: string = "a lowercase reverse-DNS ID other than applicationId";
  public static readonly productFolderExpected: string = "a relative folder whose segments are separated by /";
  public static readonly productVariableExpected: string = "an uppercase environment variable name";
  public static readonly productRepositoryExpected: string = "a GitHub repository written as owner/name";
  public static readonly productMacCategoryExpected: string = "a macOS app category such as public.app-category.developer-tools";
  public static readonly productLinuxCategoryExpected: string = "a freedesktop.org main category such as Development";
  public static readonly productDescriptionExpected: string = "one line of text";
  public static readonly productAddressExpected: string = "an https address";
  public static readonly productLicensesExpected: string = "text";
  public static readonly productUpdateFeedExpected: string = "an https folder URL ending in /, with no user info, query or fragment";
  public static readonly productAboutExpected: string = "an object";
  public static readonly productInstallFolderPattern: RegExp = /^[^\s\\/:*?"<>|'$`.\p{Cc}](?:[^\\/:*?"<>|'$`\p{Cc}]*[^\s\\/:*?"<>|'$`.\p{Cc}])?$/u;
  public static readonly productInstallFolderExpected: string = "one folder name such as Noldova, without / \\ : * ? \" < > | ' $ ` or control characters, "
    + "and with no space or dot at either end";
  public static readonly productTitleBarNameExpected: string = "one line of text";
  public static readonly productTitleBarIconExpected: string = "a PNG or SVG file's path from the app's root, such as assets/title-bar.svg, or a data: URL of a PNG or SVG image";
  public static readonly productMissing: string = `The root ${Resources.packageManifestFileName} must declare ${Resources.formatFieldPath(Resources.manifestDesktopField, Resources.productField)}.`;
  public static readonly productWindowsPublisherRemoved: string = `${Resources.formatFieldPath(Resources.manifestDesktopField, Resources.productField, Resources.productWindowsPublisherField)} no longer goes in ${Resources.packageManifestFileName}; remove it. A signed Windows package takes its publisher from the release's ${Resources.windowsPublisherVariable} secret.`;
  public static readonly manifestPackagingField: string = "packaging";
  public static readonly rootManifestUnreadable: string = `The root ${Resources.packageManifestFileName} could not be read as JSON.`;
  public static readonly acceptedLicensesField: string = "acceptedLicenses";
  public static readonly licenseField: string = "license";
  public static readonly packagingReasonField: string = "reason";
  public static readonly acceptedLicensesShape: string =
    `The root package.json's ${Resources.acceptedLicensesSection} must map each package, as <name>@<version>, to { "license": "<the exact license in its package.json>", "reason": "<why the app may ship it>" }.`;
  public static readonly packageVersionSeparator: string = "@";
  public static readonly packageIdPattern: RegExp = /^(?:@[^@/\s]+\/)?[^@/\s]+@[^@/\s]+$/;
  public static readonly companyPackageSourcesFolder: string = "sources";
  public static readonly companyPackageUnsafeSegments: readonly string[] = [String.empty, ".", ".."];
  public static readonly windowsUnsafeSegment: RegExp = /[\\:*?"<>|\p{Cc}]|[. ]$|^(?:con|conin\$|conout\$|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\..*)?$/iu;
  public static readonly tarPackagePath: RegExp = /^[^/]+\/(.+)$/;
  public static readonly unicodeNormalForm: "NFC" = "NFC";
  public static readonly filePermissionsMask: number = 0o777;
  public static readonly allowedLicenses: readonly string[] = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "BlueOak-1.0.0", "Python-2.0", "Unlicense"];
  public static readonly licenseGroup: RegExp = /^\((.*)\)$/s;
  public static readonly licenseAlternative: RegExp = /\s+OR\s+/;
  public static readonly licenseIdentifier: RegExp = /^[A-Za-z0-9.-]+$/;
  public static readonly lockedPackageFolder: string = `${Resources.nodeModulesFolder}${Resources.pathSegmentSeparator}`;
  public static readonly secureProtocol: string = "https:";
  public static readonly insecureProtocol: string = "http:";
  public static readonly registrySchemes: readonly string[] = [Resources.secureProtocol, Resources.insecureProtocol];
  public static readonly archiveScheme: string = "file:";
  public static readonly integrityAlgorithm: string = "sha512";
  public static readonly integrityPrefix: string = `${Resources.integrityAlgorithm}-`;
  public static readonly integritySeparator: RegExp = /\s+/;
  public static readonly integrityDigestEncoding: "base64" = "base64";
  public static readonly archiveScopeSeparator: string = "+";
  public static readonly packageArchiveExtension: string = ".tgz";
  public static readonly lockedPackageName: RegExp = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[A-Za-z0-9~-][A-Za-z0-9._~-]*$/;
  public static readonly lockedPackageVersion: RegExp = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/;
  public static readonly lockResolvedField: string = "resolved";
  public static readonly lockInBundleField: string = "inBundle";
  public static readonly lockLinkField: string = "link";
  public static readonly ownArchiveFolder: RegExp = /^(?:\.\.\/)*_packages$/u;
  public static readonly omittedOptionalsField: string = "omittedOptionals";
  public static readonly omittedOptionalsShape: string = `The root package.json's ${Resources.omittedOptionalsSection} must map each package, as <name>@<version>, to `
    + "{ \"dependencies\": [<optional dependency name>, ...], \"reason\": \"<why the app never loads them>\" }.";
  public static readonly typeOnlyPeersField: string = "typeOnlyPeers";
  public static readonly typeOnlyPeersListField: string = "peers";
  public static readonly typeOnlyPeersShape: string = `The root package.json's ${Resources.typeOnlyPeersSection} must map each package, as <name>@<version>, to { "peers": [<peer name>, ...], "reason": "<why the package never loads them>" }.`;
  public static readonly packageReportFieldCount: number = 4;
  public static readonly packageReportTargetField: "target" = "target";
  public static readonly packageReportSignedField: "signed" = "signed";
  public static readonly packageReportCheckedField: "checked" = "checked";
  public static readonly packageReportStartedField: "started" = "started";
  public static readonly zipArchiveTarget: string = "zip";
  public static readonly packagePlatforms: ReadonlyMap<string, string> = new Map([
    [Resources.windowsPlatform, Resources.windowsTarget], [Resources.macPlatform, Resources.macosTarget], [Resources.linuxPlatform, Resources.linuxTarget]
  ]);
  public static readonly packageArchitectures: readonly string[] = [Resources.architectureX64, Resources.architectureArm64];
  public static readonly builderFormatNsis: string = "nsis";
  public static readonly builderFormatDmg: string = "dmg";
  public static readonly builderFormatPkg: string = "pkg";
  public static readonly builderFormatZip: string = "zip";
  public static readonly builderFormatAppImage: string = "AppImage";
  public static readonly builderFormatDeb: string = "deb";
  public static readonly packageFormats: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
    [Resources.windowsTarget, new Map([[Resources.builderFormatNsis, Resources.installerTarget]])],
    [Resources.macosTarget, new Map([[Resources.builderFormatDmg, Resources.diskImageTarget], [Resources.builderFormatZip, Resources.zipArchiveTarget]])],
    [Resources.linuxTarget, new Map([[Resources.builderFormatAppImage, Resources.appImageTarget], [Resources.builderFormatDeb, Resources.debianPackageTarget]])]
  ]);
  public static readonly folderedPackageFormats: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([...Resources.packageFormats,
    [Resources.macosTarget, new Map([[Resources.builderFormatPkg, Resources.macInstallerTarget], [Resources.builderFormatZip, Resources.zipArchiveTarget]])]]);
  public static readonly packageUpdateExtensions: ReadonlyMap<string, string> = new Map([
    [Resources.windowsTarget, Resources.installerTarget], [Resources.macosTarget, Resources.zipArchiveTarget], [Resources.linuxTarget, Resources.appImageTarget]
  ]);
  public static readonly tarModeEnd: number = 108;
  public static readonly tarChecksumStart: number = 148;
  public static readonly tarChecksumEnd: number = 156;
  public static readonly tarTypeStart: number = 156;
  public static readonly tarMagicStart: number = 257;
  public static readonly tarMagicEnd: number = 263;
  public static readonly octalRadix: number = 8;
  public static readonly decimalRadix: number = 10;
  public static readonly tarSpace: number = 0x20;
  public static readonly tarNul: string = String.fromCharCode(0);
  public static readonly tarUstarMagic: string = `ustar${Resources.tarNul}`;
  public static readonly tarGlobalType: string = "g";
  public static readonly tarLongNameType: string = "L";
  public static readonly tarLongLinkType: string = "K";
  public static readonly tarExtendedPath: string = "path=";
  public static readonly tarOctalField: RegExp = /^[0-7]+$/;
  public static readonly tarFieldPadding: RegExp = /^[ \0]+|[ \0]+$/g;
  public static readonly tarEntryKinds: ReadonlyMap<string, string> = new Map([["1", "a hard link"], ["2", "a symbolic link"]]);
  public static readonly tarSizeField: string = "size";
  public static readonly tarModeField: string = "mode";
  public static readonly tarHeaderEncoding: BufferEncoding = "latin1";
  public static readonly thirdPartyDownloadTimeout: number = 120_000;
  public static readonly downloadRetriedStatuses: readonly number[] = [408, 429];
  public static readonly downloadTransientPattern: RegExp = /\b(?:ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|EPIPE|ENETUNREACH|EHOSTUNREACH)\b|socket hang up|fetch failed|TypeError: terminated|server closed connection|Download failed: size mismatch|timed out after \d+ms|\b(?:Response code|server returned code) (?:5\d\d|408|429)\b/;
  public static readonly licenseFilePattern: RegExp = /^(?:(?:licen[cs]e|copying|unlicense)(?:[-_][a-z0-9+-]+(?:\.\d+)*)?|[a-z0-9+-]+(?:\.\d+)*[-_]licen[cs]e)(?:\.(?:md|txt|markdown))?$/i;
  public static readonly scriptFilePattern: RegExp = /\.[cm]?js$/;
  public static readonly regexSpecialCharacters: RegExp = /[.*+?^${}()|[\]\\]/g;
  public static readonly regexEscapeReplacement: string = String.raw`\$&`;
  public static readonly namedLicenseFile: RegExp = /^SEE LICENSE IN (\S+)$/;
  public static readonly paragraphSeparator: string = "\n\n";
  public static readonly reviewedLicenseExtension: string = ".txt";
  public static readonly windowsPublisherPattern: RegExp = /^CN=[^,=+"\\<>;\n\r]+(?:, [A-Z]+=[^,=+"\\<>;\n\r]+)*$/;
  public static readonly windowsSigningEndpointPattern: RegExp = /^https:\/\/[a-z0-9]+(?:[.-][a-z0-9]+)*\/$/;
  public static readonly windowsSigningNamePattern: RegExp = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
  public static readonly windowsSigningEndpointField: string = "endpoint";
  public static readonly windowsSigningAccountField: string = "account";
  public static readonly windowsSigningProfileField: string = "profile";
  public static readonly windowsSigningEndpointExpected: string = "the HTTPS URL of the Artifact Signing endpoint, ending in /";
  public static readonly windowsSigningNameExpected: string = "a name of letters, digits and hyphens that starts and ends with a letter or digit";
  public static readonly windowsSigningMissing: string =
    `Signing Windows packages needs ${Resources.windowsSigningSection} in the root package.json, with the Artifact Signing endpoint, account and certificate profile.`;
  public static readonly checksumAlgorithm: string = "sha256";
  public static readonly checksumDigestEncoding: "hex" = "hex";
  public static readonly checksumSeparator: string = "  ";
  public static readonly releasePlatformNames: ReadonlyMap<string, string> = new Map([
    [Resources.windowsTarget, "Windows"], [Resources.macosTarget, "macOS"], [Resources.linuxTarget, "Linux"]
  ]);
  public static readonly releaseArchitectureNames: ReadonlyMap<string, string> = new Map([[Resources.architectureX64, "x64"], [Resources.architectureArm64, "ARM64"]]);
  public static readonly releaseNoneSupported: string = "No target has passed its native acceptance yet, so every target was accepted by a CI run only.";
  public static readonly releasePackagesSigned: string = "Its packages are signed.";
  public static readonly releasePackagesUnsigned: string = "Its packages are unsigned.";
  public static readonly releaseUploadAttempts: number = 3;
  public static readonly releaseRetryPause: number = 10_000;
  public static readonly assetDigestPrefix: string = `${Resources.checksumAlgorithm}:`;
  public static readonly githubRetriedStatuses: readonly number[] = [408, 429];
  public static readonly httpServerErrorStatus: number = 500;
  public static readonly githubExistingReferenceStatus: number = 422;
  public static readonly releaseMakeLatestValue: string = "true";
  public static readonly tagReferencePrefix: string = "refs/tags/";
  public static readonly githubReleasesPath: string = "/releases";
  public static readonly githubReferencesPath: string = "/git/refs";
  public static readonly httpPatchMethod: string = "PATCH";
  public static readonly httpPostMethod: string = "POST";
  public static readonly githubMakeLatestField: string = "make_latest";
  public static readonly githubDraftField: string = "draft";
  public static readonly githubTagNameField: string = "tag_name";
  public static readonly githubTargetCommitishField: string = "target_commitish";
  public static readonly githubNameField: string = "name";
  public static readonly githubBodyField: string = "body";
  public static readonly githubRefField: string = "ref";
  public static readonly githubShaField: string = "sha";
  public static readonly githubObjectField: string = "object";
  public static readonly githubTypeField: string = "type";
  public static readonly githubCommitType: string = "commit";
  public static readonly publishedReleaseContext: string = "the published release";
  public static readonly newReleaseContext: string = "the new release";
  public static readonly fileNotFoundCode: string = "ENOENT";
  public static readonly missingFileCodes: ReadonlySet<string> = new Set(["ENOENT", "ENOTDIR"]);
  public static readonly unreachableFileCodes: ReadonlySet<string> = new Set(["ENOENT", "ENOTDIR", "EACCES", "EPERM"]);
  public static readonly reportSignedChecked: string = "signed and checked";
  public static readonly reportSignedUnchecked: string = "signed but not checked";
  public static readonly reportUnsignedChecked: string = "unsigned but marked checked";
  public static readonly reportUnsigned: string = "unsigned";
  public static readonly signedPlatformsField: "signedPlatforms" = "signedPlatforms";
  public static readonly signablePlatforms: readonly string[] = [Resources.windowsTarget, Resources.macosTarget, Resources.linuxTarget];
  public static readonly signedPlatformsInvalid: string =
    `The root ${Resources.packageManifestFileName}'s desktop.signedPlatforms must list distinct platforms among ${Resources.signablePlatforms.join(", ")}.`;
  public static readonly releaseTargetsSeparator: string = ",";
  public static readonly releaseAlwaysBuiltTargets: readonly string[] = ["linux-x64", "windows-x64"];
  public static readonly supportedTargetsField: "supportedTargets" = "supportedTargets";
  public static readonly updateMetadataPrefix: string = "latest";
  public static readonly updateMetadataExtension: string = "yml";
  public static readonly updateMetadataReleaseDate: RegExp = /^releaseDate: '([^'\n]+)'$/mu;
  public static readonly githubIdField: string = "id";
  public static readonly githubAssetsField: string = "assets";
  public static readonly githubSizeField: string = "size";
  public static readonly githubStateField: string = "state";
  public static readonly githubDigestField: string = "digest";
  public static readonly githubUploadedState: string = "uploaded";
  public static readonly releaseRepositoryPattern: RegExp = /^[A-Za-z0-9-]+\/(?!\.+$)[A-Za-z0-9._-]+$/u;
  public static readonly releaseRevisionPattern: RegExp = /^[0-9a-f]{40}$/u;
  public static readonly releaseVersionPattern: RegExp = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/u;
  public static readonly releaseTagPrefix: string = "v";
  public static readonly releaseTagPrefixPattern: RegExp = /^(?:v|[a-z0-9]+(?:-[a-z0-9]+)*-)$/u;
  public static readonly gitCommand: string = "git";
  public static readonly gitTimeout: number = 60_000;
  public static readonly successExitCodes: readonly number[] = [0];
  public static readonly githubCommand: string = "gh";
  public static readonly githubTimeout: number = 60_000;
  public static readonly githubUploadTimeout: number = 900_000;
  public static readonly httpNotFoundStatus: number = 404;
  public static readonly githubStatusPattern: RegExp = /\bHTTP (\d{3})\b/u;
  public static readonly githubTagReferencesPath: string = "/git/matching-refs/tags/";
  public static readonly httpDeleteMethod: string = "DELETE";
  public static readonly ghApiCommand: string = "api";
  public static readonly ghPaginateOption: string = "--paginate";
  public static readonly ghSlurpOption: string = "--slurp";
  public static readonly ghMethodOption: string = "--method";
  public static readonly ghRawFieldOption: string = "--raw-field";
  public static readonly ghFieldOption: string = "--field";
  public static readonly ghReleaseCommand: string = "release";
  public static readonly ghUploadCommand: string = "upload";
  public static readonly ghRepoOption: string = "--repo";
  public static readonly processOutputLimit: number = 16 * 1024 * 1024;
  public static readonly missingProcessCode: string = "ESRCH";
  public static readonly logFileFlag: string = "w";
  public static readonly processWithoutId: string = "The process has no process ID, because it never started.";
  public static readonly downloadAttempts: number = 4;
  public static readonly downloadRetryPause: number = 15_000;
  public static readonly shortTemporaryRoot: string = "/tmp";
  public static readonly scannerLineFeed: string = "\n";
  public static readonly scannerBackslash: string = "\\";
  public static readonly scannerBacktick: string = "`";
  public static readonly scannerSubstitutionStart: string = "${";
  public static readonly scannerLineCommentStart: string = "//";
  public static readonly scannerBlockCommentStart: string = "/*";
  public static readonly scannerBlockCommentEnd: string = "*/";
  public static readonly scannerSlash: string = "/";
  public static readonly scannerOpeningBrace: string = "{";
  public static readonly scannerClosingBrace: string = "}";
  public static readonly scannerOpeningBracket: string = "[";
  public static readonly scannerClosingBracket: string = "]";
  public static readonly scannerOpeningParenthesis: string = "(";
  public static readonly scannerColon: string = ":";
  public static readonly scannerClosingParenthesis: string = ")";
  public static readonly scannerEquals: string = "=";
  public static readonly scannerGreaterThan: string = ">";
  public static readonly scannerPropertyAccess: string = ".";
  public static readonly scannerFunctionKeyword: string = "function";
  public static readonly scannerOperand: string = "0";
  public static readonly scannerQuotes: ReadonlySet<string> = new Set(["\"", "'"]);
  public static readonly scannerWhitespace: RegExp = /\s/;
  public static readonly scannerIdentifierStart: RegExp = /[A-Za-z_$]/;
  public static readonly scannerWordPart: RegExp = /[\w$]/;
  public static readonly scannerDigit: RegExp = /\d/;
  public static readonly scannerOperandEnd: RegExp = /[\w$)\]]$/;
  public static readonly scannerRegularExpressionKeywords: ReadonlySet<string> = new Set([
    "await", "case", "delete", "do", "else", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"
  ]);
  public static readonly scannerImportKeywords: ReadonlySet<string> = new Set(["from", "import"]);
  public static readonly scannerImportCalls: ReadonlySet<string> = new Set(["import", "require"]);
  public static readonly scannerSelectorKey: string = "selector";
  public static readonly scannerEscapeLength: number = 2;
  public static readonly commandArgumentsOffset: number = 2;

  public static formatAppleSignatureLacks(subject: string, failed: readonly string[], outputs: readonly string[]): string {
    return `${subject} lacks ${failed.join(Resources.listSeparator)}:\n${outputs.join(Resources.lineSeparator)}`;
  }

  public static formatAsarEntryNotFile(archive: string, segments: readonly string[]): string {
    return `${archive} holds ${segments.join(Resources.pathSegmentSeparator)} as no file of its own.`;
  }

  public static formatAuthenticodeRefused(refused: readonly string[]): string {
    return `Not every program and addon is signed by the publisher in ${Resources.windowsPublisherVariable}, every library by it or `
      + `${Resources.authenticodeLibraryVendors.join(Resources.listSeparator)}, and every program a package brings by it or ${Resources.authenticodeProgramVendors.join(Resources.listSeparator)}, `
      + `with a valid, timestamped signature. Refused:\n${refused.join(Resources.lineSeparator)}`;
  }

  public static formatMacInstallerCredentialsMissing(missing: readonly string[]): string {
    return `Signing the macOS installer package of an app that names an install folder needs ${missing.join(Resources.listSeparator)}, the Developer ID Installer certificate.`;
  }

  public static formatMacSigningCredentialsMissing(missing: readonly string[]): string {
    return `Signing macOS packages needs ${missing.join(Resources.listSeparator)}, the Developer ID Application certificate and the App Store Connect key that notarizes.`;
  }

  public static formatMacUpdateUnlinked(archive: string, frameworks: readonly string[]): string {
    return `The app in ${archive} extracts with Versions/Current as no link in ${frameworks.join(Resources.listSeparator)}, so its signature would not hold.`;
  }

  public static formatMacUpdateDifferences(archive: string, count: number, shown: readonly string[]): string {
    return `The app in ${archive} extracts unlike the packaged app in ${count} entries:\n` + shown.join(Resources.lineSeparator);
  }

  public static formatPackageAssetMissing(segments: readonly string[], role: string): string {
    return `The app has no ${segments.join(Resources.pathSegmentSeparator)}, ${role}; Noldova Desktop brings no default for it, so the package cannot be built.`;
  }

  public static formatUninstallerLeft(names: readonly string[], folder: string, holders: string | null): string {
    return `The uninstaller left ${names.join(Resources.listSeparator)} in ${folder}.${Object.isNull(holders) ? String.empty : `\n${holders}`}`;
  }

  public static formatLeftoverRemoved(removed: readonly string[]): string {
    return `Removed what an earlier run left installed: ${removed.join(" and ")}.`;
  }

  public static formatInstallerStoppedFiles(folder: string, count: number, lines: readonly string[]): string {
    return [`${folder} held ${count} files when the installer was stopped:`, ...lines].join(Resources.lineSeparator);
  }

  public static formatInstalledFilesMissing(missing: readonly string[]): string {
    return `The installed package has no ${missing.join(Resources.listSeparator)}.`;
  }

  public static formatStageOptionalsLeftOut(leftOut: ReadonlyMap<string, readonly string[]>): string {
    return `Optional dependencies left out: ${[...leftOut].map(([id, names]) => `${id}'s ${names.join(Resources.listSeparator)}`).join("; ") || Resources.noneLabel}.\n`;
  }

  public static formatStagePackages(names: readonly string[]): string {
    return `Packages in the stage: ${names.join(Resources.listSeparator) || Resources.noneLabel}.\n`;
  }

  public static formatStageForeignAddons(addons: readonly string[]): string {
    return `Addons for other targets left out: ${addons.join(Resources.listSeparator) || Resources.noneLabel}.\n`;
  }

  public static formatStageCompanyPackages(ids: readonly string[]): string {
    return `The company's packages in the stage: ${ids.join(Resources.listSeparator) || Resources.noneLabel}.\n`;
  }

  public static formatStageWindowPackages(names: readonly string[]): string {
    return `Window packages left to the window build: ${names.join(Resources.listSeparator) || Resources.noneLabel}.\n`;
  }

  public static formatStageAcceptedLicenses(packages: readonly string[]): string {
    return `Licenses the app accepted: ${packages.join(Resources.listSeparator) || Resources.noneLabel}.\n`;
  }

  public static formatStageThirdPartyPackages(packages: readonly string[]): string {
    return `Third-party packages in the stage: ${packages.join(Resources.listSeparator) || Resources.noneLabel}.\n`;
  }

  public static formatStagePartsMissing(missing: readonly string[]): string {
    return `The stage needs ${missing.join(Resources.listSeparator)}, which is not a package under src/.`;
  }

  public static formatNativeArchitectureUnknown(architecture: string, known: readonly string[]): string {
    return `The package's architecture ${architecture} is none of ${known.join(Resources.listSeparator)}.`;
  }

  public static formatPackagedModulesNotActive(problems: readonly string[]): string {
    return `The installed app's modules are not all active: ${problems.join("; ")}.`;
  }

  public static formatPackagedModulesActive(active: readonly string[], unavailable: readonly string[], blocked: readonly string[], off: readonly string[], platform: string): string {
    return `The installed app's modules are active: ${active.length === 0 ? Resources.noneLabel : active.join(Resources.listSeparator)}`
      + `${unavailable.length === 0 ? String.empty : `; ${unavailable.join(Resources.listSeparator)} unavailable on ${platform}, which ${unavailable.length === 1 ? "it leaves" : "they leave"} out`}`
      + `${blocked.length === 0 ? String.empty : `; ${blocked.join(Resources.listSeparator)} blocked by a dependency ${platform} leaves out`}`
      + `${off.length === 0 ? String.empty : `; ${off.join(Resources.listSeparator)} off by ${off.length === 1 ? "its" : "their"} switch setting`}.`;
  }

  public static formatSandboxMainProcesses(started: number, count: number, family: readonly string[]): string {
    return `The started process ${started} has ${count} Electron main processes among its descendants instead of one, so its sandbox cannot be checked; they are ${family.join(Resources.listSeparator)}.`;
  }

  public static formatSandboxModes(modes: readonly (readonly [string | null, number])[]): string {
    return modes.map(([type, seccomp]) => `${type} ${seccomp}`).join(Resources.listSeparator);
  }

  public static formatUnpackedVerified(files: readonly string[]): string {
    return `The installed package keeps outside app.asar, each marked unpacked and readable: ${files.join(Resources.listSeparator)}.`;
  }

  public static formatClosurePeerMissing(id: string, location: string, missing: string, others: readonly string[]): string {
    return `${id} at ${location} needs the peer dependency ${missing}, which no shipped package brings and Electron does not provide, so it would fail at runtime.`
      + (others.length === 0 ? String.empty : ` The app names types-only peers only for ${others.join(Resources.listSeparator)}.`);
  }

  public static formatTrustedSigningAccountMissing(missing: readonly string[]): string {
    return `Signing a Windows file needs ${missing.join(Resources.listSeparator)}, which packaging sets from ${Resources.windowsSigningSection}.`;
  }

  public static formatWindowsSigningCredentialsMissing(missing: readonly string[]): string {
    return `Signing Windows packages needs ${missing.join(Resources.listSeparator)}, the Azure service principal for the signing account in ${Resources.windowsSigningSection}.`;
  }

  public static formatUnknownFields(fields: readonly string[]): string {
    return `has unknown fields: ${fields.join(", ")}`;
  }

  public static formatModulePartsWithoutFolder(missing: readonly string[]): string {
    return `declares parts without a folder: ${missing.join(", ")}`;
  }

  public static formatModuleDependencyRepeated(both: readonly string[]): string {
    return `names ${both.join(", ")} as both a dependency and an optional dependency`;
  }

  public static formatModulePartsNotExported(packageName: string, missing: readonly string[]): string {
    return `declares parts its package does not export at ${packageName}/<part>: ${missing.join(", ")}`;
  }

  public static formatModulePartsNotDeclared(undeclared: readonly string[]): string {
    return `does not declare parts its package exports: ${undeclared.join(", ")}`;
  }

  public static formatModuleToolPrefixes(id: string): readonly string[] {
    return [
      `${id.replaceAll(Resources.kebabSeparator, Resources.snakeSeparator)}${Resources.snakeSeparator}`,
      `${id.split(Resources.kebabSeparator)[0]}${Resources.snakeSeparator}`
    ];
  }

  public static formatModuleToolNamesExpected(prefixes: readonly string[]): string {
    return `snake_case names of at most ${Resources.moduleToolNameLimit} characters starting with ${[...new Set(prefixes)].join(" or ")}`;
  }

  public static formatWindowPartTail(lists: readonly (readonly unknown[])[]): string {
    const length = lists.findLastIndex(t => t.length > 0) + 1;
    return lists.slice(0, length).map(t => `, ${JSON.stringify(t)}`).join(String.empty);
  }

  public static formatWindowPartList(lines: readonly string[]): string {
    return lines.length === 0 ? "[]" : `[\n${lines.join(",\n")}\n]`;
  }

  public static formatWindowPartsFile(sources: readonly string[], menus: readonly string[]): string {
    return `${Resources.licenseHeaderBlock}\n${Resources.windowPartsSourceImport}\n`
      + `export const windowPartSources: readonly WindowPartSource[] = ${Resources.formatWindowPartList(sources)};\n\n`
      + `export const moduleMenus: IWindowInputs["menus"] = ${menus.length === 0 ? "{}" : `{\n${menus.join(",\n")}\n}`};\n`;
  }

  public static formatCliGlobalOptions(options: readonly string[]): string {
    return `must not have options the command line has itself: ${options.map(t => `--${t}`).join(", ")}`;
  }

  public static formatCliFieldsExpected(fields: readonly string[], optional: readonly string[]): string {
    const optionalText = optional.length > 0 ? `, and optionally ${optional.join(", ")}` : String.empty;
    return `must be an object with the fields ${fields.filter(t => !optional.includes(t)).join(", ")}${optionalText}`;
  }

  public static formatMenusPlacesUndescribed(undescribed: readonly string[]): string {
    return `does not describe the declared places ${undescribed.join(", ")}`;
  }

  public static formatMenusCycle(place: string, path: readonly string[]): string {
    return `opens ${place} inside itself: ${[...path, place].join(" > ")}`;
  }

  public static formatCatalogIdsRepeated(folders: readonly string[]): string {
    return `Module ids repeat in the build: ${folders.join(", ")}.`;
  }

  public static formatCatalogExcludedAbsent(absent: readonly string[]): string {
    return `The build has no module ${absent.join(", ")} to leave out.`;
  }

  public static formatCatalogDependenciesMissing(id: string, missing: readonly string[]): string {
    return `${id} ${Resources.moduleDependsOn} ${missing.join(", ")}, which the build does not include.`;
  }

  public static formatCatalogCycle(names: readonly string[]): string {
    return `The dependencies of ${names.join(", ")} form a cycle.`;
  }

  public static formatCatalogPlaceholdersRepeated(placeholders: readonly string[]): string {
    return `Placeholders repeat in the build, which shows one: ${placeholders.join(", ")}.`;
  }

  public static formatCatalogSettingsPagesRepeated(pages: readonly (readonly [string, string])[]): string {
    return `Settings page titles repeat in the build, and a title names one page: ${pages.map(([title, owner]) => `${title} for ${owner}`).join(", ")}.`;
  }

  public static formatCatalogNamesRepeated(repeated: readonly (readonly [string, readonly string[]])[]): string {
    return `Contributed names repeat in the build: ${repeated.map(([name, files]) => Resources.formatNameInFile(name, files.join(", "))).join("; ")}.`;
  }

  public static formatCatalogNoldovaDesktopOutside(outside: readonly string[], version: string | null): string {
    return `${outside.join("; ")}, but the app has ${Object.isNull(version) ? "no Noldova Desktop" : `Noldova Desktop ${version}`}, as ${Resources.desktopRuntimePackage} shows.`;
  }

  public static formatAngularCopies(name: string, copies: readonly string[]): string {
    return `More than one copy of ${name} is installed in the app, so the kit and Noldova Desktop would each run their own overlay container and focus handling: ${copies.join("; ")}.`;
  }

  public static formatWindowAppsClash(folders: readonly string[]): string {
    return `${Resources.sourceFolder}/ holds more than one window app, a folder whose name ends in ${Resources.windowAppSuffix}: ${folders.join(", ")}; an app has one.`;
  }

  public static formatInstalledCopy(version: string, trail: readonly string[]): string {
    return `${version} (${trail.join(Resources.installedCopiesTrailSeparator)})`;
  }

  public static formatCommandFailed(command: string, commandArguments: readonly string[], exitCode: number | null, errorOutput: string): string {
    return `"${command} ${commandArguments.join(" ")}" failed with ${exitCode}: ${errorOutput.trim()}`;
  }

  public static formatCopyLine(fields: readonly string[]): string {
    return `${fields.join("\t")}\n`;
  }

  public static formatOptionalDependenciesAbsent(id: string, absent: readonly string[]): string {
    return `${id} runs without ${absent.join(", ")}, optional for it and left out of the build.\n`;
  }

  public static formatTargetRow(cells: readonly string[]): string {
    return `${cells.join(Resources.targetCellSeparator)}\n`;
  }

  public static formatFeedServes(feed: string, version: string, targetIds: readonly string[]): string {
    return `The update feed ${feed} serves ${version} for ${targetIds.join(", ")}.\n`;
  }

  public static formatFeedFilesMatch(targetId: string, metadata: string, version: string, names: readonly string[], isSigned: boolean): string {
    return `${targetId}: ${metadata} names ${version}, and ${names.join(", ")} match its SHA-512 and size${isSigned ? " and carry a valid signature by a key the app ships" : String.empty}.`;
  }

  public static formatFeedSignatureInvalid(name: string, feed: string, metadata: string): string {
    return `${name} at ${feed} carries no valid signature by a key in ${Resources.linuxUpdateKeysVariable} in ${metadata}, so the app would refuse it.`;
  }

  public static formatFeedTargetsInvalid(targetIds: readonly string[], text: string): string {
    return `${Resources.releaseTargetsVariable} must list the targets the feed serves, distinct and among ${targetIds.join(", ")}, separated by commas, not "${text}".`;
  }

  public static formatReleaseFiles(platform: string, architecture: string, version: string, names: readonly string[]): string {
    return `The release files of ${platform} ${architecture} for ${version}:\n${names.join("\n")}\n`;
  }

  public static formatReleaseCheckOutputs(signed: readonly string[], feed: string): string {
    return `${Resources.signedOutput}=${signed.join(Resources.signedPlatformsSeparator)}\n${Resources.productFeedOutput}=${feed}\n`;
  }

  public static formatReleaseChecked(tag: string, repository: string, revision: string, signed: readonly string[]): string {
    return `${tag} of ${repository} from ${revision}: the version is new, the revision is on ${Resources.mainBranch} `
      + `and its Build and test run there passed. Signed platforms: ${signed.length === 0 ? Resources.noSignedPlatforms : signed.join(", ")}.\n`;
  }

  public static formatBuilderMissingFiles(missing: readonly string[]): string {
    return `electron-builder finished without making ${missing.join(", ")}.`;
  }

  public static formatPackagesMade(files: readonly string[]): string {
    return `Packages made:\n${files.map(t => `  ${t}\n`).join(String.empty)}`;
  }

  public static formatSmokeMountedCopyRecords(logs: string, count: number, texts: readonly string[]): string {
    return `While the main process ran, ${logs} held ${count} copy records of the runtime's AppImage, although its mounted copy needs none:\n${texts.join(Resources.lineSeparator)}`;
  }

  public static formatSmokeCopyLingered(moment: string, entries: readonly string[], tail: string): string {
    return `The runtime's copy of the AppImage was still there ${Resources.smokeKillLimit} ms after the runtime ${moment}: ${entries.join(" ")}\n${tail}`;
  }

  public static formatSmokeCleanUpFailed(problems: readonly string[]): string {
    return `Cleaning up failed:\n${problems.join(Resources.lineSeparator)}\n`;
  }

  public static formatFieldPath(...fields: readonly string[]): string {
    return fields.join(Resources.fieldPathSeparator);
  }

  public static formatFolderPath(...segments: readonly string[]): string {
    return segments.join(Resources.pathSegmentSeparator);
  }

  public static formatLines(lines: readonly string[]): string {
    return lines.join(Resources.lineSeparator);
  }

  public static formatBuildRecord(inputs: string, outputs: readonly string[]): string {
    return `inputs ${inputs}\n${outputs.map(t => `output ${t}\n`).join(String.empty)}`;
  }

  public static formatManifestUnpinned(file: string, names: readonly string[]): string {
    return `${file} must pin ${names.join(Resources.listSeparator)} to an exact version.`;
  }

  public static formatManifestOwnUnstamped(file: string, names: readonly string[]): string {
    return `${file} must depend on ${names.join(Resources.listSeparator)} at version "${Resources.packageVersionPlaceholder}".`;
  }

  public static formatManifestOwnPeerUnranged(file: string, names: readonly string[]): string {
    return `${file} must take ${names.join(Resources.listSeparator)} as a peer at "${Resources.packagePeerRangePlaceholder}"; the build stamps the version and its next minor.`;
  }

  public static formatModuleVersionsUnreadable(problems: readonly string[]): string {
    return `The build cannot version the module packages: ${problems.join(Resources.problemSeparator)}`;
  }

  public static formatPackageNamesClash(directories: readonly string[]): string {
    return `Package paths produce the same name: ${directories.join(Resources.listSeparator)}.`;
  }

  public static formatPackageDependsOnUnknown(directory: string, names: readonly string[]): string {
    return `${directory} depends on ${names.join(Resources.listSeparator)}, which is not a package under src/.`;
  }

  public static formatPackageCycle(names: readonly string[]): string {
    return `The dependencies of ${names.join(Resources.listSeparator)} form a cycle.`;
  }

  public static formatArtifactsStale(names: readonly string[]): string {
    return `The built artifacts of ${names.join(Resources.listSeparator)} are missing or stale; run npm run build.`;
  }

  public static formatLicenseRefused(packageId: string, expression: string, otherAccepted: readonly string[]): string {
    return `${packageId} is licensed under "${expression}"; a third-party runtime package needs ${Resources.formatAllowedLicenses()}.`
      + (otherAccepted.length === 0 ? String.empty : ` The app accepts another license only for ${otherAccepted.join(", ")}, so this version's terms need accepting again.`);
  }

  public static formatReviewedLicenseMissing(id: string, files: readonly string[]): string {
    return `${id} has no license file in its tarball, such as LICENSE, LICENCE or COPYING, and neither ${files.join(" nor ")} holds a reviewed license text for it, so its license cannot ship.`;
  }

  public static formatReleaseFilesDiffer(folder: string, missing: readonly string[], unexpected: readonly string[]): string {
    return `The release's files in ${folder} differ from the files a release has. Missing: ${missing.join(", ") || "none"}. Not part of a release: ${unexpected.join(", ") || "none"}.`;
  }

  public static formatUpdateMetadataMismatch(metadata: string, version: string, names: readonly string[]): string {
    return `${metadata} does not describe version ${version} with ${names.join(" and ")} as they are.`;
  }

  public static formatReleasePartlySigned(signed: readonly (string | undefined)[], unsigned: readonly (string | undefined)[]): string {
    return `The ${signed.join(" and ")} packages are signed; the ${unsigned.join(" and ")} packages are unsigned.`;
  }

  public static formatReleaseTargetNames(names: readonly string[]): string {
    return names.length < 2 ? names.join(String.empty) : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  }

  public static formatReleaseAssetsDiffer(tag: string, missing: readonly string[], unexpected: readonly string[]): string {
    return `${tag} on GitHub differs from the built files. Missing: ${missing.join(Resources.listSeparator) || Resources.noneLabel}. Not part of the release: ${unexpected.join(Resources.listSeparator) || Resources.noneLabel}.`;
  }

  public static formatReportsMismatch(problems: readonly string[]): string {
    return `The package reports do not match the release's signing, so nothing was published:\n${problems.join("\n")}`;
  }

  public static formatReportsVerified(signedPlatforms: readonly string[]): string {
    return `Every target of the release has one package report, and the signed ones were signed and checked: ${signedPlatforms.length === 0 ? "none" : signedPlatforms.join(", ")}.`;
  }

  public static formatUpdateFeedNeedsSigning(repository: string, productName: string, unsigned: readonly string[]): string {
    return `${repository} is ${productName}'s update feed, which gets only signed Windows, macOS and Linux packages, `
      + `but desktop.signedPlatforms leaves out ${unsigned.join(" and ")}.`;
  }

  public static formatReleaseTargetsInvalid(ids: readonly string[], text: string): string {
    return `${Resources.releaseTargetsVariable} must list the targets the release built, distinct and among ${ids.join(", ")}, separated by commas, not "${text}".`;
  }

  public static formatReleaseTargetsMissing(required: readonly string[], missing: readonly string[]): string {
    return `This release builds ${required.join(", ")}, but ${Resources.releaseTargetsVariable} leaves out ${missing.join(", ")}.`;
  }

  public static formatReleaseTargetsUnbuilt(unbuilt: readonly string[]): string {
    return `The root package.json's desktop.supportedTargets lists ${unbuilt.join(", ")}, which this release did not build, so it cannot call them supported.`;
  }

  public static formatSupportedTargetsInvalid(ids: readonly string[]): string {
    return `The root ${Resources.packageManifestFileName}'s desktop.supportedTargets must list distinct targets among `
      + `${ids.join(", ")}.`;
  }

  public static formatUpdateMetadataEntry(name: string, sha512: string, size: number, signature: string | null): readonly string[] {
    return [`  - url: ${Resources.formatYamlQuoted(name)}`, `    sha512: ${sha512}`, `    size: ${size}`, ...Object.isNull(signature) ? [] : [`    signature: ${signature}`]];
  }

  public static formatUpdateMetadata(version: string, entries: readonly string[], updateName: string, sha512: string, releaseDate: string): string {
    return [
      `version: ${version}`,
      "files:",
      ...entries,
      `path: ${Resources.formatYamlQuoted(updateName)}`,
      `sha512: ${sha512}`,
      `releaseDate: ${Resources.formatYamlQuoted(releaseDate)}`,
      String.empty
    ].join("\n");
  }

  public static formatGitFailed(gitArguments: readonly string[], exitCode: number | null, errorOutput: string): string {
    return `"git ${gitArguments.join(" ")}" failed with exit code ${exitCode}: ${errorOutput.trim()}`;
  }

  public static formatGhFailed(gitHubArguments: readonly string[], exitCode: number | null, errorOutput: string): string {
    return `"gh ${gitHubArguments.join(" ")}" failed with exit code ${exitCode}: ${errorOutput.trim()}`;
  }

  public static formatProcessFailed(commandName: string, commandArguments: readonly string[], exitCode: number | null, text: string): string {
    return `${commandName} ${commandArguments.join(" ")} failed with exit code ${exitCode}:\n${text}`;
  }

  public static formatAppleDiskImageSubject(image: string): string {
    return `The disk image ${image}`;
  }

  public static formatAppleAppSubject(container: string): string {
    return `The app in ${container}`;
  }

  public static formatAppleDiskImageVerified(image: string): string {
    return `${image}: the disk image and its app each have a valid Developer ID Application signature, notarized and stapled.`;
  }

  public static formatAppleInstallerSubject(installer: string): string {
    return `The installer package ${installer}`;
  }

  public static formatAppleInstallerVerified(installer: string): string {
    return `${installer}: the installer package has a valid Developer ID Installer signature and its app a valid Developer ID Application signature, each notarized and stapled.`;
  }

  public static formatAppleInstallerAppMissing(expanded: string, bundle: string): string {
    return `The installer package expanded into ${expanded} holds no ${bundle} in a component's payload.`;
  }

  public static formatAppleArchiveVerified(archive: string): string {
    return `${archive}: a valid Developer ID Application signature, notarized and stapled.`;
  }

  public static formatAsarTruncated(archive: string, length: number, position: number): string {
    return `${archive} ends before the ${length} bytes at ${position} that its header names.`;
  }

  public static formatAuthenticodeReadFailed(exitCode: number | null, output: string): string {
    return `${Resources.powershellCommand} failed reading the Windows signatures with exit code ${exitCode}:\n${output}`;
  }

  public static formatAuthenticodeReportIncomplete(count: number): string {
    return `${Resources.powershellCommand} did not report one signature for each of the ${count} files it checked.`;
  }

  public static formatAuthenticodeLine(file: string, status: string, timestamped: string, signer: string): string {
    return `${file}: ${status}, timestamped: ${timestamped}, signed by: ${signer}`;
  }

  public static formatAuthenticodeRefusedLine(line: string): string {
    return `  ${line}`;
  }

  public static formatElectronVersionMissing(manifest: string): string {
    return `${manifest} has no version for Electron.`;
  }

  public static formatFileHoldersReadFailed(exitCode: number | null, output: string): string {
    return `What holds them could not be read: ${Resources.windowsPowershellCommand} exited with ${exitCode}:\n${output}`;
  }

  public static formatFileHolders(output: string): string {
    return `What holds them now:\n${output}`;
  }

  public static formatMacNotarizationRefused(image: string, output: string): string {
    return `Apple did not notarize the disk image ${image}:\n${output}`;
  }

  public static formatMacStapleFailed(image: string, isOffline: boolean, output: string): string {
    return `The notarization ticket could not be stapled to the disk image ${image}${isOffline
      ? `, as stapler staple lost its network connection on all ${Resources.staplerAttempts} attempts` : String.empty}:\n${output}`;
  }

  public static formatMacNotarized(image: string, submission: string): string {
    return `${image}: Apple accepted notarization submission ${submission}, and its ticket is stapled.\n`;
  }

  public static formatMacUpdateCopies(count: number, bundle: string, output: string, archive: string): string {
    return `electron-builder left ${count} copies of ${bundle} in ${output}, so ${archive} has no one app to match.`;
  }

  public static formatMacUpdateDifference(entry: string, expected: string, actual: string): string {
    return `  ${entry}: ${expected} in the app, ${actual} in the archive`;
  }

  public static formatMacUpdateVerified(archive: string, entries: number, frameworks: number): string {
    return `${archive}: the app extracts with ditto as packaged, ${entries} entries, with Versions/Current a link in each of its ${frameworks} frameworks.`;
  }

  public static formatMacUpdateLink(target: string): string {
    return `${Resources.macUpdateLinkPrefix}${target}`;
  }

  public static formatMacUpdateFileEntry(size: number): string {
    return `file of ${size} bytes`;
  }

  public static formatNativeBinaryWildcard(relative: string): string {
    return `${relative} is a native program or library the app must keep outside app.asar, but its path holds a character a file pattern reads as a wildcard.`;
  }

  public static formatJsonFile(value: unknown): string {
    return `${JSON.stringify(value, null, Resources.jsonIndent)}\n`;
  }

  public static formatPackageCopyright(publisher: string): string {
    return `Copyright (c) ${publisher}`;
  }

  public static formatPackagedCommandPath(name: string): string {
    return `${Resources.commandFolder}${Resources.pathSegmentSeparator}${name}`;
  }

  public static formatPackagedLicensePath(name: string): string {
    return `${Resources.packagedLicensesFolder}${Resources.pathSegmentSeparator}${name}`;
  }

  public static formatWindowsCommandScript(program: string, entry: string): string {
    return [
      "@echo off",
      "setlocal",
      `set ${Resources.runAsNodeVariable}=${Resources.runAsNodeValue}`,
      `"${program}" "${entry}" %*`,
      "exit /b %ERRORLEVEL%"
    ].map(t => `${t}${Resources.windowsLineSeparator}`).join(String.empty);
  }

  public static formatPosixCommandScript(program: string, entry: string): string {
    return [
      "#!/bin/sh",
      "link=\"$0\"",
      "while [ -h \"$link\" ]; do",
      "  target=$(readlink \"$link\")",
      "  case \"$target\" in",
      "    /*) link=\"$target\" ;;",
      "    *) link=\"$(dirname \"$link\")/$target\" ;;",
      "  esac",
      "done",
      "resources=$(cd -P \"$(dirname \"$link\")/..\" && pwd)",
      `export ${Resources.runAsNodeVariable}=${Resources.runAsNodeValue}`,
      `exec "${program}" "${entry}" "$@"`
    ].map(t => `${t}\n`).join(String.empty);
  }

  public static formatWindowsNeighbourRemoved(neighbour: string): string {
    return `Uninstalling the app removed ${neighbour}, which belongs to another app in its install folder.`;
  }

  public static formatWindowsNeighbourMoved(neighbour: string): string {
    return `Moving the app into its install folder removed ${neighbour}, which belongs to another app there.`;
  }

  public static formatWindowsOldInstallKept(folder: string): string {
    return `The update left the old install in ${folder}, which it should have moved into the app's install folder.`;
  }

  public static formatShortcutElsewhere(shortcut: string, target: string, program: string): string {
    return `${shortcut} starts "${target}", not ${program}.`;
  }

  public static formatShortcutReadFailed(shortcut: string, exitCode: number | null, output: string): string {
    return `${shortcut} could not be read: ${Resources.windowsPowershellCommand} exited with ${exitCode}:${Resources.lineSeparator}${output}`;
  }

  public static formatInstallFolderKept(folder: string, names: readonly string[], holders: string | null): string {
    return `Uninstalling the app left its install folder ${folder}${Resources.formatKeptEntries(names, holders)}`;
  }

  public static formatSharedFolderKept(folder: string, names: readonly string[], holders: string | null): string {
    return `Uninstalling the app left ${folder}, the shared folder its install folder was in, which held nothing else${Resources.formatKeptEntries(names, holders)}`;
  }

  public static formatKeptEntries(names: readonly string[], holders: string | null): string {
    const left = names.length === 0 ? ", empty" : `, with ${names.join(Resources.listSeparator)} in it`;
    return `${left}.${Object.isNull(holders) ? String.empty : `\n${holders}`}`;
  }

  public static formatSharedFolderChanged(folder: string, before: readonly string[], after: readonly string[]): string {
    const now = after.length === 0 ? "nothing" : after.join(Resources.listSeparator);
    return `Uninstalling the app changed what else ${folder} holds: ${before.join(Resources.listSeparator)} before, ${now} after.`;
  }

  public static formatCopiedUninstallerHeld(uninstaller: string, error: unknown, holders: string): string {
    return `The copy of the uninstaller ${uninstaller} could not be removed after it and every process it started had exited: ${String(error)}${Resources.lineSeparator}${holders}`;
  }

  public static formatUninstallerNotRemoved(uninstaller: string, error: unknown): string {
    return `The uninstaller ${uninstaller} could not be removed after it ran: ${String(error)}`;
  }

  public static formatUserPathEntry(entry: string): string {
    return `${entry} on the user's Path`;
  }

  public static formatInstallerCreatedNothing(folder: string): string {
    return `The installer had not created ${folder}.`;
  }

  public static formatInstalledFileSize(file: string, size: number): string {
    return `${file}: ${size} bytes`;
  }

  public static formatInstallerTemporaryNone(temporary: string): string {
    return `${temporary} held no temporary folder the installer had made.`;
  }

  public static formatInstallerPathUnreadable(target: string, error: unknown): string {
    return `${target} could not be read: ${String(error)}`;
  }

  public static formatInstallerTemporaryFolder(folder: string): string {
    return `The installer's temporary folder ${folder} held:`;
  }

  public static formatInstallerTemporaryContent(name: string, count: number, size: number): string {
    return `${name}: ${count} files, ${size} bytes`;
  }

  public static formatInstallerProcesses(processId: number, processes: string): string {
    return `What the installer, process ${processId}, had started and was still running after it was stopped:\n${processes}`;
  }

  public static formatInstallerProcessesNone(processId: number): string {
    return `Nothing the installer, process ${processId}, had started was still running after it was stopped.`;
  }

  public static formatInstallerProcessesReadFailed(processId: number, reason: string): string {
    return `What the installer, process ${processId}, had started could not be listed: ${reason}`;
  }

  public static formatInstallerTimedOut(message: string, description: string): string {
    return `${message}\n${description}`;
  }

  public static formatDetachAfterCopyFailed(error: unknown, detachError: unknown): string {
    return `${String(error)}\nDetaching the disk image after the failed copy failed too: ${String(detachError)}`;
  }

  public static formatInstallPlatformArguments(system: string, architecture: string, library: string | null): readonly string[] {
    return [`--os=${system}`, `--cpu=${architecture}`, ...Object.isNull(library) ? [] : [`--libc=${library}`]];
  }

  public static formatStageArchivesLeftOut(names: readonly string[]): string {
    return `Installing the packages into the stage left out ${names.join(", ")}, which the stage ships for this target.`;
  }

  public static formatStageInstallFailed(exitCode: number | null, output: string): string {
    return `Installing the packages into the stage failed with exit code ${exitCode}; it uses only the build's archives and never the registry:\n${output}`;
  }

  public static formatStageUnshippedWarning(section: string, id: string): string {
    return `Warning: ${section} names ${id}, which the app does not ship; remove it.\n`;
  }

  public static formatStageSkippedEntryWarning(id: string, entry: string): string {
    return `Warning: The tarball of ${id} holds ${entry}, which the stage's checks of its scripts and license do not read.\n`;
  }

  public static formatStageTypeOnlyPeers(description: string): string {
    return `Peers passed over as types-only: ${description || Resources.noneLabel}.\n`;
  }

  public static formatStageLicensedPackage(id: string, license: string): string {
    return `${id} (${license})`;
  }

  public static formatNativeArchitectureMismatch(file: string, found: string, kind: string, architecture: string): string {
    return `The file ${file} is ${found}, not an ${architecture}-only ${kind} file, so it would not run natively on ${architecture}.`;
  }

  public static formatNativeArchitectureVerified(folder: string, count: number, architecture: string): string {
    return `Every Mach-O, PE and ELF file in ${folder}, ${count} in all, is ${architecture} alone.`;
  }

  public static formatWindowsMachineMismatch(file: string, found: string, architecture: string, accepted: readonly string[]): string {
    return `The file ${file} is ${found}, not a PE file that Windows runs on ${architecture}, which runs ${accepted.join(Resources.listSeparator)}.`;
  }

  public static formatWindowsMachinesVerified(folder: string, architecture: string, accepted: readonly string[], held: readonly (readonly [string, number])[]): string {
    const count = held.reduce((total, [, files]) => total + files, 0);
    const kinds = held.filter(([, files]) => files > 0).map(([machine, files]) => `${files} ${machine}`);
    return `Every Mach-O, PE and ELF file in ${folder}, ${count} in all, is one Windows runs on ${architecture}, which runs ${accepted.join(Resources.listSeparator)}: `
      + `${kinds.length === 0 ? "none" : kinds.join(Resources.listSeparator)}.`;
  }

  public static formatMachCpuType(type: number): string {
    return `a Mach-O file for CPU type 0x${type.toString(16)}`;
  }

  public static formatPeMachine(machine: number): string {
    return `a PE file for machine 0x${machine.toString(16)}`;
  }

  public static formatElfMachine(machine: number): string {
    return `an ELF file for machine ${String(machine)}`;
  }

  public static formatPackagedBuildFailed(exitCode: number | null): string {
    return `The packaged build failed with exit code ${exitCode}.`;
  }

  public static formatPackagedModulesUnlisted(status: unknown): string {
    return `The installed app's status --json answered without its modules: ${JSON.stringify(status)}`;
  }

  public static formatPackagedModuleMissing(id: string): string {
    return `${id} is missing from status`;
  }

  public static formatPackagedModuleInactive(id: string, state: string, cause: string): string {
    return `${id.length === 0 ? Resources.packagedModuleWithoutId : id} is ${state.length === 0 ? Resources.packagedModuleWithoutState : state}${cause.length === 0 ? String.empty : ` (${cause})`}`;
  }

  public static formatPublisherFieldMissing(product: string): string {
    return `The installed ${product} has no ${Resources.productWindowsPublisherField} field to check against ${Resources.windowsPublisherVariable}.`;
  }

  public static formatPublisherNotText(product: string): string {
    return `The installed ${product}'s Windows publisher is not a string, so it can't be checked against ${Resources.windowsPublisherVariable}.`;
  }

  public static formatPublisherUnexpected(product: string): string {
    return `The installed ${product} has a Windows publisher set, but ${Resources.windowsPublisherVariable} is not set.`;
  }

  public static formatPublisherMissing(product: string): string {
    return `The installed ${product} is missing its Windows publisher, but ${Resources.windowsPublisherVariable} is set.`;
  }

  public static formatPublisherDiffers(product: string): string {
    return `The installed ${product}'s Windows publisher differs from ${Resources.windowsPublisherVariable}.`;
  }

  public static formatSandboxProcess(id: number, type: string): string {
    return `${id} ${type}`;
  }

  public static formatSandboxNoRenderer(main: number): string {
    return `The main process ${main} has no renderer, so its sandbox cannot be checked.`;
  }

  public static formatSandboxMustBeOn(main: number, isOff: boolean, modes: string): string {
    return `Chromium's sandbox must be on, but the main process ${main} runs ${isOff ? Resources.sandboxWithOption : Resources.sandboxWithoutOption} --no-sandbox, and its processes' seccomp modes are: ${modes}.`;
  }

  public static formatSandboxOn(modes: string): string {
    return `Chromium's sandbox is on: the main process runs without --no-sandbox, and every renderer runs under a seccomp filter, mode 2 (${modes}).`;
  }

  public static formatSandboxMustBeOff(main: number, modes: string): string {
    return `Chromium's sandbox must be off here, but the main process ${main} runs without --no-sandbox, and its processes' seccomp modes are: ${modes}.`;
  }

  public static formatSandboxOff(modes: string): string {
    return `Chromium's sandbox is off: the main process runs with --no-sandbox (${modes}).`;
  }

  public static formatUnpackedPatternUnmatched(archive: string, pattern: string): string {
    return `The installed ${archive} has no entry that ${pattern} matches, which the package's configuration keeps outside app.asar.`;
  }

  public static formatUnpackedEntryMissing(archive: string, file: string): string {
    return `The installed ${archive} has no entry for ${file}, which the package's configuration keeps outside app.asar.`;
  }

  public static formatUnpackedEntryPacked(archive: string, file: string): string {
    return `The installed ${archive} holds ${file} inside it, though the package's configuration keeps it outside app.asar.`;
  }

  public static formatUnpackedFileUnreadable(file: string, unpacked: string): string {
    return `The installed package's ${file} can't be read in ${unpacked}, though the package's configuration keeps it outside app.asar.`;
  }

  public static formatUnpackedListMissing(configuration: string): string {
    return `${configuration} gives no ${Resources.builderUnpackField} list of paths and patterns.`;
  }

  public static formatWindowUnreported(window: unknown): string {
    return `The installed app's status --json reported no main window: ${JSON.stringify(window ?? null)}`;
  }

  public static formatWindowPageSuffix(productName: string): string {
    return `${Resources.windowTitlePageSeparator}${productName}`;
  }

  public static formatWindowMistitled(title: string, productName: string, pageSuffix: string): string {
    return `The installed app's main window is titled ${JSON.stringify(title)} instead of ${JSON.stringify(productName)} or a page's title and ${JSON.stringify(pageSuffix)}.`;
  }

  public static formatWindowHidden(title: string): string {
    return `The installed app's main window ${JSON.stringify(title)} is not shown.`;
  }

  public static formatWindowUnpainted(title: string): string {
    return `The installed app's main window ${JSON.stringify(title)} is shown, but its page hasn't painted.`;
  }

  public static formatWindowShown(title: string): string {
    return `The installed app's main window is shown, titled ${JSON.stringify(title)}.`;
  }

  public static formatWindowMainEnded(ending: string, failure: string, tail: string): string {
    return `The main process ${ending} before its main window was shown. ${failure}\n${tail}`;
  }

  public static formatWindowTimedOut(limit: number, failure: string, exitCode: number | null, output: string, tail: string): string {
    return `The installed app's main window was not shown within ${limit} ms. ${failure}\nThe last status --json exited with ${exitCode}:\n${output}\n${tail}`;
  }

  public static formatMountOutlived(moment: string): string {
    return `The runtime's mount of the AppImage outlived the main process, which ${moment}.\n`;
  }

  public static formatMountEndedEarly(mount: string, moment: string, runtime: number): string {
    return `The runtime's mount of the AppImage at ${mount} ended once the main process ${moment}, while the runtime, process ${runtime}, still ran and still named itself in its discovery file.`;
  }

  public static formatMountEndedAfterRuntime(runtime: number, moment: string): string {
    return `The runtime's mount of the AppImage ended after the runtime, process ${runtime}, withdrew its discovery file to stop once the main process ${moment}.\n`;
  }

  public static formatShippedIgnoredName(name: string): string {
    return `it leaves out every file and folder named ${name}.`;
  }

  public static formatShippedIgnoredExtension(extension: string): string {
    return `it leaves out every ${extension} file.`;
  }

  public static formatShippedTopIgnored(name: string): string {
    return `it leaves out the app's top-level ${name}.`;
  }

  public static formatShippedAppConfiguration(name: string): string {
    return `it leaves out every file and folder named ${name} outside the packages.`;
  }

  public static formatShippedPackageIgnoredName(name: string): string {
    return `it leaves out every file and folder named ${name} in a package.`;
  }

  public static formatShippedPackageTopIgnored(name: string): string {
    return `it leaves out a package's top-level ${name}.`;
  }

  public static formatShippedModuleTopIgnored(module: string, name: string): string {
    return `it leaves out ${module}'s top-level ${name}.`;
  }

  public static formatShippedGypOutput(name: string, end: string): string {
    return `it leaves out gyp's ${name} in a package's folders whose names end in ${end}.`;
  }

  public static formatShippedPackageFolderIgnored(name: string, end: string): string {
    return `it leaves out ${name} in a package's folders whose names end in ${end}.`;
  }

  public static formatClosureManifestUnlocked(directory: string, name: string): string {
    return `${directory}/package.json needs ${name}, which the root ${Resources.packageLockFileName} does not lock; pin it in the root package.json and run npm install.`;
  }

  public static formatClosureRootUnlocked(name: string): string {
    return `The build ships ${name}, which the root ${Resources.packageLockFileName} does not lock; pin it in the root package.json and run npm install.`;
  }

  public static formatClosureVersionConflict(otherId: string, otherLocation: string, id: string, location: string): string {
    return `The stage installs one version of each third-party package, but the shipped packages need ${otherId} at ${otherLocation} and ${id} at ${location}.`;
  }

  public static formatClosureNotOptional(notOptional: string, id: string): string {
    return `${Resources.omittedOptionalsSection} leaves out ${notOptional} of ${id}, which is not one of its optional dependencies; an app leaves out only an optional dependency it never loads.`;
  }

  public static formatLockfileUnreadable(title: string): string {
    return `${title} could not be read as JSON.`;
  }

  public static formatLockfileVersionInvalid(title: string): string {
    return `${title} must be a lockfile of version ${Resources.lockfileVersion} with its packages.`;
  }

  public static formatClosureDependencyUnlocked(from: string, name: string): string {
    return `${from} needs ${name}, which ${Resources.packageLockFileName} does not lock.`;
  }

  public static formatClosureUnfit(location: string, target: string): string {
    return `${location} in ${Resources.packageLockFileName} does not run on ${target}, yet a shipped package needs it.`;
  }

  public static formatTrustedSigningFolderInvalid(folder: string): string {
    return `${Resources.trustedSigningFolderVariable} must name the folder that holds the prepared ${Resources.trustedSigningModuleName} module, not "${folder}".`;
  }

  public static formatPinnedPackageHashMismatch(url: string, hash: string, recorded: string): string {
    return `The package from ${url} has the SHA-512 ${hash}, not the recorded ${recorded}, so no signing package was expanded.`;
  }

  public static formatTrustedSigningFileListed(file: string): string {
    return `${Resources.trustedSigningModuleName} takes a comma-separated list of files, so it cannot sign ${file}.`;
  }

  public static formatTrustedSigningSignAction(file: string): string {
    return `signing ${file} with`;
  }

  public static formatNugetPackageUrl(id: string, release: string): string {
    return `${Resources.nugetFlatContainerUrl}/${id}/${release}/${id}.${release}${Resources.nugetPackageExtension}`;
  }

  public static formatTrustedSigningToolFolder(name: string, version: string): string {
    return [Resources.trustedSigningToolsFolder, Resources.trustedSigningModuleName, name, `${name}.${version}`].join(Resources.pathSegmentSeparator);
  }

  public static formatSigningPackageDownloadFailed(url: string, error: unknown): string {
    return `A signing package could not be downloaded from ${url}: ${String(error)}`;
  }

  public static formatSigningPackageHttpFailed(url: string, status: number): string {
    return `A signing package could not be downloaded from ${url}: HTTP ${status}.`;
  }

  public static formatTrustedSigningRunFailed(action: string, exitCode: number | null, output: string): string {
    return `${Resources.powershellCommand} failed ${action} the ${Resources.trustedSigningModuleName} module with exit code ${exitCode}:\n${output}`;
  }

  public static formatUnpackedFieldInvalid(name: string): string {
    return `${name}'s package.json must give ${Resources.noldovaDesktopField}.${Resources.desktopUnpackedField} as a list of paths of the package's own files, with / between folders.`;
  }

  public static formatUnpackedNeverShipped(omission: string | null | undefined): string {
    return `electron-builder never ships it, since ${omission}`;
  }

  public static formatUnpackedWrongCase(other: string, segment: string): string {
    return `the package holds ${other}, not ${segment}; name each folder and file in its own case.`;
  }

  public static formatUnpackedRefused(name: string, file: string, reason: string): string {
    return `${name} names ${file} to keep outside app.asar, but ${reason}`;
  }

  public static formatUserPathUnreadable(exitCode: number | null, output: string): string {
    return `${Resources.registryCommand} ${Resources.userPathQueryArguments.join(" ")} did not answer with the user's Path; it exited with ${exitCode}:\n${output}`;
  }

  public static formatWindowsUnpackedProgramMissing(program: string): string {
    return `electron-builder finished without the unpacked program ${program}, whose signature the check reads.`;
  }

  public static formatFunctionKey(ordinal: number): string {
    return `F${ordinal}`;
  }

  public static formatFolderFile(folder: string, file: string): string {
    return `${folder}${Resources.pathSegmentSeparator}${file}`;
  }

  public static formatPackageSubpath(packageName: string, part: string): string {
    return `${packageName}${Resources.pathSegmentSeparator}${part}`;
  }

  public static formatPackageExportPath(part: string): string {
    return `./${part}`;
  }

  public static formatModuleFileProblem(file: string, problem: string): string {
    return `${file} ${problem}.`;
  }

  public static formatJsonFileUnreadable(file: string): string {
    return `${file} could not be read as JSON.`;
  }

  public static formatJsonDocument(document: unknown): string {
    return `${JSON.stringify(document, null, Resources.jsonIndent)}\n`;
  }

  public static formatMemberPath(owner: string, member: string): string {
    return `${owner}${Resources.qualifiedNameSeparator}${member}`;
  }

  public static formatQualifiedPrefix(id: string): string {
    return `${id}${Resources.qualifiedNameSeparator}`;
  }

  public static formatIndexedProblem(field: string, index: number, problem: string): string {
    return `${field}[${index}] ${problem}`;
  }

  public static formatModuleListMissing(field: string): string {
    return `must list its ${field}`;
  }

  public static formatNameInFile(name: string, file: string): string {
    return `${name} in ${file}`;
  }

  public static formatModuleIdInvalid(listedId: string, isListedPackage: boolean): string {
    const owner = isListedPackage ? `as ${Resources.modulesListSection} lists it` : "its folder's name";
    return `must have the id "${listedId}", ${owner}: lowercase kebab-case and none of ${Resources.moduleReservedIds.join(", ")}`;
  }

  public static formatModuleIdWindowsDevice(id: string): string {
    return `has the id "${id}", which names a device on Windows, so it is refused on every platform; a module id is none of ${Resources.windowsDeviceNames.join(", ")}`;
  }

  public static formatModuleUnknownKind(kind: string): string {
    return `contributes an unknown kind: ${kind}`;
  }

  public static formatModuleSwitchSettingNotBoolean(value: string): string {
    return `has the ${Resources.switchSettingField} ${value}, which must be a ${Resources.booleanType} setting`;
  }

  public static formatModuleSwitchSettingNotShared(value: string): string {
    return `has the ${Resources.switchSettingField} ${value}, which must have the locality ${Resources.sharedLocality} and no scopes, so one value holds for the whole app`;
  }

  public static formatModuleNoldovaDesktopInvalid(value: unknown): string {
    return `must name the Noldova Desktop versions it accepts as its ${Resources.noldovaDesktopField}, in the one form ${Resources.versionRangeForm}, not ${JSON.stringify(value)}`;
  }

  public static formatModuleVersionsNotObject(field: string): string {
    return `must list its ${field} as an object from each module's id to the one exact version of it that it needs, such as 1.2.3`;
  }

  public static formatModuleDependencyNotModule(relation: string, dependency: string): string {
    return `${relation} "${dependency}", which is not another module's id`;
  }

  public static formatModuleDependencyVersionInvalid(version: unknown, dependency: string): string {
    return `names ${JSON.stringify(version)} for ${dependency}, which is not one exact version such as 1.2.3; a dependency names no range`;
  }

  public static formatModulePackageNameMismatch(file: string, packageName: string, actual: unknown): string {
    return `${file} must have the name ${packageName}, as ${Resources.modulesListSection} lists it, not ${String(actual)}.`;
  }

  public static formatModulePackageVersionMismatch(packageName: string, actual: unknown): string {
    return `must have the version of its package ${packageName}, ${String(actual)}`;
  }

  public static formatModuleListInvalid(field: string, expected: string): string {
    return `must list its ${field} once each as ${expected}`;
  }

  public static formatModuleNamesInvalid(kind: string, id: string): string {
    return `must list its ${kind} as "${id}.<name>", with a camelCase name`;
  }

  public static formatVersion(major: number, minor: number, patch: number): string {
    return [major, minor, patch].map(t => String(t)).join(Resources.versionSeparator);
  }

  public static formatVersionRange(minimum: string, below: string): string {
    return `>=${minimum} <${below}`;
  }

  public static formatWindowPartSource(
    id: string, dependencies: readonly string[], contributions: readonly (readonly string[])[], windowImport: string, tail: readonly (readonly unknown[])[]): string {
    return `  new WindowPartSource(${JSON.stringify(id)}, ${JSON.stringify(dependencies)}, `
      + contributions.map(t => `${JSON.stringify(t)}, `).join(String.empty)
      + `() => import(${JSON.stringify(windowImport)}).then(t => t.windowPart)`
      + `${Resources.formatWindowPartTail(tail)})`;
  }

  public static formatModuleMenusEntry(id: string, menus: unknown): string {
    return `  ${JSON.stringify(id)}: ${JSON.stringify(menus)}`;
  }

  public static formatCliCommandsMissing(folder: string, file: string): string {
    return `${Resources.formatFolderFile(folder, Resources.moduleDeclarationFileName)} declares command-line commands, but ${file} is missing.`;
  }

  public static formatCliFileNotCommands(file: string): string {
    return `${file} must be an object whose only field, "${Resources.commandsKind}", lists the module's command-line commands.`;
  }

  public static formatCliCommandsMismatch(file: string): string {
    return `${file} must define each command-line command that ${Resources.moduleDeclarationFileName} declares, once, and no other.`;
  }

  public static formatKebabSegment(letter: string): string {
    return `${Resources.kebabSeparator}${letter.toLowerCase()}`;
  }

  public static formatMenusMissing(folder: string, file: string): string {
    return `${Resources.formatFolderFile(folder, Resources.moduleDeclarationFileName)} declares menus, but ${file} does not exist.`;
  }

  public static formatMenusOwner(id: string): string {
    return `${id}'s ${Resources.menusFileName}`;
  }

  public static formatMenusToolbarAnchorUnknown(file: string, place: string, anchor: string): string {
    return `${file} puts the toolbar ${place} next to ${anchor}, which is not a toolbar of its own or of a module it depends on.`;
  }

  public static formatMenusGroupPlaceUnknown(file: string, group: string, place: string): string {
    return `${file} adds the group ${group} to ${place}, which is neither the shell's place nor its own or a dependency's.`;
  }

  public static formatMenusCommandUnknown(file: string, command: string): string {
    return `${file} runs ${command}, which neither it nor a module it depends on declares.`;
  }

  public static formatMenusToolbarAsMenu(file: string, opened: string, group: string): string {
    return `${file} opens the toolbar ${opened} as a menu in the group ${group}, which a toolbar cannot be.`;
  }

  public static formatMenusPlaceUndeclared(name: unknown): string {
    return `describes the place ${String(name)}, which ${Resources.moduleDeclarationFileName} does not declare in ${Resources.formatMemberPath(Resources.contributesField, Resources.menusKind)}`;
  }

  public static formatMenusPlaceTitleMissing(name: string): string {
    return `must give the place ${name} a title`;
  }

  public static formatMenusPlaceShowsInvalid(name: string): string {
    return `must give the place ${name} a shows of ${Resources.menuShows.join(", ")}`;
  }

  public static formatMenusToolbarFieldsMisplaced(name: string): string {
    return `must give ${Resources.shownField}, ${Resources.afterField}, ${Resources.beforeField} and ${Resources.newRowField} only to a place that shows as a toolbar, not ${name}`;
  }

  public static formatMenusToolbarShownInvalid(name: string): string {
    return `must give the toolbar ${name} a ${Resources.shownField} of true or false`;
  }

  public static formatMenusToolbarNewRowInvalid(name: string): string {
    return `must give the toolbar ${name} a ${Resources.newRowField} of true or false`;
  }

  public static formatMenusToolbarAnchorsRepeated(name: string): string {
    return `must give the toolbar ${name} at most one of ${Resources.afterField}, ${Resources.beforeField} and ${Resources.newRowField}`;
  }

  public static formatMenusToolbarAnchorInvalid(name: string, field: string): string {
    return `must give the toolbar ${name} an ${field} naming another toolbar as "${Resources.qualifiedNameForm}"`;
  }

  public static formatMenusToolbarBandInvalid(name: string): string {
    return `must give the toolbar ${name} a ${Resources.bandField} naming one of the module's views or documents`;
  }

  public static formatMenusGroupNameInvalid(id: string): string {
    return `must name each group "${id}.<name>", with a camelCase name`;
  }

  public static formatMenusGroupPlaceInvalid(name: string): string {
    return `must put the group ${name} in a place named "${Resources.qualifiedNameForm}"`;
  }

  public static formatMenusGroupExclusiveInvalid(name: string): string {
    return `must give the group ${name} an ${Resources.exclusiveField} of true or false`;
  }

  public static formatMenusGroupDynamicInvalid(name: string): string {
    return `must give the group ${name} a ${Resources.dynamicField} of true or false`;
  }

  public static formatMenusDynamicGroupItems(name: string): string {
    return `must not give the dynamic group ${name} items, since its window part supplies them`;
  }

  public static formatMenusGroupItemsLabel(name: string): string {
    return `items of the group ${name}`;
  }

  public static formatMenusGroupEmpty(name: string): string {
    return `must give the group ${name} at least one item`;
  }

  public static formatMenusItemInvalid(group: string): string {
    return `must make each item of the group ${group} either a command with optional arguments and label, a submenu, or a choice`;
  }

  public static formatMenusChoiceUnknown(choice: unknown, group: string): string {
    return `opens ${String(choice)} as a choice in the group ${group}, which is not one of its own places`;
  }

  public static formatMenusSubmenuUnknown(submenu: unknown, group: string): string {
    return `opens ${String(submenu)} as a submenu in the group ${group}, which is not one of its own places`;
  }

  public static formatMenusItemCommandInvalid(group: string): string {
    return `must name a command "${Resources.qualifiedNameForm}" for each item of the group ${group}`;
  }

  public static formatMenusItemArgumentsInvalid(command: string, group: string): string {
    return `must give the arguments of ${command} in the group ${group} as a JSON object`;
  }

  public static formatMenusItemLabelInvalid(command: string, group: string): string {
    return `must give the label of ${command} in the group ${group} as text that is not blank`;
  }

  public static formatSettingsMissing(folder: string, file: string): string {
    return `${Resources.formatFolderFile(folder, Resources.moduleDeclarationFileName)} declares settings or settings pages, but ${file} is missing.`;
  }

  public static formatSettingsFileInvalid(file: string): string {
    return `${file} must be an object whose field "${Resources.settingsKind}" lists the module's settings, and whose only other field, "${Resources.pagesField}", lists its own pages.`;
  }

  public static formatSettingsMismatch(file: string): string {
    return `${file} must define each setting that ${Resources.moduleDeclarationFileName} declares, once, and no other.`;
  }

  public static formatSettingsPageInvalid(file: string, index: number): string {
    return Resources.formatModuleFileProblem(
      file, Resources.formatIndexedProblem(Resources.pagesField, index, `must have exactly the fields ${Resources.settingsPageFields.join(", ")}, with a title that is not blank`));
  }

  public static formatSettingsPagesMismatch(file: string): string {
    return `${file} must define each settings page that ${Resources.moduleDeclarationFileName} declares, once, and no other.`;
  }

  public static formatWebViewKeyRepeated(platform: string): string {
    return `gives a key more than once on ${platform}`;
  }

  public static formatWebViewKeyInvalid(field: string, index: number): string {
    return `must describe ${field}[${index}] with a name, its keys and optionally its macOS keys`;
  }

  public static formatWebViewKeyNameInvalid(field: string, index: number): string {
    return `must name ${field}[${index}] with a lowercase letter followed by letters and digits`;
  }

  public static formatWebViewChordsInvalid(where: string): string {
    return `must give ${where} one to ${Resources.webViewChordsLimit} keys`;
  }

  public static formatWebViewKeyUnknown(where: string, text: string): string {
    return `gives ${where} ${text}, which is not a key in Noldova Desktop's format, such as Mod+R or F5`;
  }

  public static formatWebViewKeyRefused(where: string, text: string, platform: string): string {
    return `gives ${where} ${text}, which cannot be declared on ${platform}: it needs Mod, Ctrl or Alt, or a function key, or is Escape among the loading keys, and it must not be a key that editing, the operating system or Noldova Desktop holds`;
  }

  public static formatWebViewMethodInvalid(index: number): string {
    return `must describe ${Resources.methodsKind}[${index}] with a name and optionally parameters`;
  }

  public static formatWebViewMethodNameInvalid(index: number): string {
    return `must name ${Resources.methodsKind}[${index}] as a debugging protocol domain, a dot and a name, such as Page.captureScreenshot`;
  }

  public static formatWebViewMethodRefused(name: string): string {
    return `declares ${name}, which is refused in a web view: it loads or replaces a document, which only a navigation the origin check sees may do, or it undoes what the host holds for the view`;
  }

  public static formatWebViewParametersNotObject(where: string): string {
    return `must give the parameters of ${where} as an object from each name to its rule`;
  }

  public static formatWebViewParameterInvalid(where: string, name: string): string {
    return `names the parameter ${Resources.formatMemberPath(where, name)}, which is not a lowercase letter followed by letters and digits`;
  }

  public static formatWebViewRuleInvalid(where: string): string {
    return `must give ${where} a rule of only ${Resources.webViewRuleFields.join(", ")}`;
  }

  public static formatWebViewRuleKindsRepeated(where: string): string {
    return `must give ${where} at most one of values, a minimum and maximum, a maxLength and fields`;
  }

  public static formatWebViewRuleRequiredInvalid(where: string): string {
    return `must give ${where} a required of true or false`;
  }

  public static formatWebViewRuleValuesInvalid(where: string): string {
    return `must give ${where} values that are distinct texts, numbers or booleans, at least one`;
  }

  public static formatWebViewRuleRangeInvalid(where: string): string {
    return `must give ${where} a minimum and maximum that are numbers, the minimum no greater than the maximum`;
  }

  public static formatWebViewRuleMaxLengthInvalid(where: string): string {
    return `must give ${where} a maxLength that is a positive whole number`;
  }

  public static formatWebViewListNotArray(field: string): string {
    return `must list its ${field} as an array`;
  }

  public static formatCatalogDependencyVersion(id: string, dependency: string, needed: string, version: string): string {
    return `${id} ${Resources.moduleDependsOn} ${dependency} ${needed}, but the build includes ${dependency} ${version}.`;
  }

  public static formatCatalogOptionalDependencyVersion(id: string, dependency: string, needed: string, version: string): string {
    return `${id} ${Resources.moduleOptionallyDependsOn} ${dependency} ${needed}, but the build includes ${dependency} ${version}.`;
  }

  public static formatCatalogDeclarationMissing(id: string, folder: string, isPackage: boolean): string {
    return `The build lists the module ${id}, but ${folder} has no ${Resources.moduleDeclarationFileName}${isPackage ? " at its package's root" : String.empty}.`;
  }

  public static formatCatalogFixtureVersionMissing(file: string): string {
    return `${file} must have a version, which its package takes.`;
  }

  public static formatCatalogPermissionsModuleInvalid(name: unknown): string {
    return `The root ${Resources.packageManifestFileName}'s ${Resources.desktopField}.${Resources.productField}.${Resources.permissionsModuleField} must be the id of a module in ${Resources.modulesListSection}, not ${JSON.stringify(name)}.`;
  }

  public static formatModuleFormerNamesUndeclared(name: string): string {
    return `gives former names for "${name}", which isn't one of its commands or documents`;
  }

  public static formatModuleFormerNamesInvalid(name: string): string {
    return `must give "${name}" its former names as a list of different qualified names, such as "notes.add", none of them its own name`;
  }

  public static formatModuleFormerNamesReserved(name: string, former: string): string {
    return `gives "${name}" the former name "${former}", which belongs to the shell or a reserved id: ${Resources.moduleReservedIds.join(", ")}`;
  }

  public static formatCatalogFormerNamesRepeated(repeated: readonly (readonly [string, readonly string[]])[]): string {
    return `Former names repeat in the build, and a former name moves to one command or document: ${repeated.map(([name, files]) => Resources.formatNameInFile(name, files.join(", "))).join("; ")}.`;
  }

  public static formatCatalogFormerNamesCurrent(current: readonly (readonly [string, readonly string[]])[]): string {
    return `Former names are names a module contributes in the build: ${current.map(([name, files]) => Resources.formatNameInFile(name, files.join(", "))).join("; ")}.`;
  }

  public static formatContributionPlace(file: string, kind: string): string {
    return `${file} (${kind})`;
  }

  public static formatCatalogPinMissing(id: string, packageName: string): string {
    return `The build lists the module ${id} from ${packageName}, which the root ${Resources.packageManifestFileName}'s ${Resources.dependenciesField} must pin to an exact version.`;
  }

  public static formatCatalogInstalledMismatch(id: string, packageName: string, pin: string, installed: string | null): string {
    return `The build lists the module ${id} from ${packageName} ${pin}, but ${Resources.nodeModulesFolder} holds ${installed ?? "no version of it"}; run npm install.`;
  }

  public static formatCatalogPackageSubject(id: string, packageName: string | null): string {
    return `${id}'s package ${String(packageName)}`;
  }

  public static formatCatalogWindowPeer(id: string, packageName: string | null, peer: string): string {
    return `${Resources.formatCatalogPackageSubject(id, packageName)} names ${peer} as a peer, which a module's package never does: the registry serves no ${Resources.peerDependenciesMetaField}, so npm takes even an optional peer as required and installs ${peer} at the app's root, where its exact Angular peers clash with a newer Angular; the module's window part package names it instead.`;
  }

  public static formatCatalogDependencyListed(holder: string, name: string, installedName: string): string {
    return `${holder} lists ${name} among its dependencies${installedName === name ? String.empty : `, which installs ${installedName}`}`;
  }

  public static formatCatalogAngularDependency(id: string, packageName: string | null, holder: string, name: string, windowPackage: string): string {
    return `${Resources.formatCatalogPackageSubject(id, packageName)} reaches the Angular package ${name} outside its window part: ${holder} lists it among its dependencies; only the module's own window part's package, named ${windowPackage}, and what it depends on may bring Angular, for a module with a window part.`;
  }

  public static formatCatalogOwnCopy(name: string, folder: string): string {
    return `it holds its own copy of ${name} at ${folder}`;
  }

  public static formatCatalogWindowSubject(id: string, name: string): string {
    return `${id}'s window part package ${name}`;
  }

  public static formatCatalogWindowPinInvalid(subject: string, packageName: string | null): string {
    return `${subject} must be pinned to one exact version among ${String(packageName)}'s dependencies, and installed at it; run npm install.`;
  }

  public static formatCatalogWindowNotAngular(subject: string): string {
    return `${subject} must be an Angular package, with ${Resources.angularCorePackage} among its peer dependencies.`;
  }

  public static formatCatalogWindowPeerNotOptional(subject: string, peer: string): string {
    return `${subject} must mark its peer ${peer} optional in ${Resources.peerDependenciesMetaField}, so that installing the module's package adds no second Angular, window package or kit; the app's install meets it.`;
  }

  public static formatCatalogAngularPeerRange(subject: string, peer: string, needed: unknown, minimum: string): string {
    return `${subject} needs ${peer} ${String(needed)}, a range that doesn't end at the next major after ${minimum}; an Angular peer takes ${Resources.angularPeerRangeForm}, since only a new Angular major may break a module.`;
  }

  public static formatCatalogOrganizationPeerRange(subject: string, peer: string, needed: unknown, minimum: string): string {
    return `${subject} needs ${peer} ${String(needed)}, a range that doesn't end at the first version refused after ${minimum}, the next minor below 1.0.0 and the next major from it; a peer on another of the organization's packages takes ${Resources.versionRangeForm}.`;
  }

  public static formatCatalogCoreRangeUnnamed(subject: string, peer: string, needed: unknown, file: string): string {
    return `${subject} needs ${peer} ${String(needed)}, a range, but ${file} names no ${Resources.noldovaDesktopField}; a module that accepts a range of Noldova Desktop versions names it there, and each of Noldova Desktop's packages it peers on takes that same range.`;
  }

  public static formatCatalogCoreRangeMismatch(subject: string, peer: string, needed: unknown, file: string, range: string): string {
    return `${subject} needs ${peer} ${String(needed)}, but ${file} accepts Noldova Desktop ${range}; each of Noldova Desktop's packages it peers on takes that same range.`;
  }

  public static formatCatalogPeerMismatch(subject: string, peer: string, needed: unknown, holder: string, version: string | null): string {
    return `${subject} needs ${peer} ${String(needed)}, but ${holder} ${version ?? "none"}; a peer names one exact version, such as 1.2.3, or, for the organization's packages, a range of the form ${Resources.versionRangeForm}, and, for Angular's packages in a window part, ${Resources.angularPeerRangeForm}.`;
  }

  public static formatCatalogOutsideRange(id: string, version: string, range: string): string {
    return `${id} ${version} accepts Noldova Desktop ${range}`;
  }

  public static formatCatalogSecondCopy(id: string, packageName: string | null, cause: string): string {
    return `${Resources.formatCatalogPackageSubject(id, packageName)} brings a second copy of a package the app holds once: ${cause}; a module's package takes Noldova Desktop's, context's and the kit's packages only as peer dependencies.`;
  }

  public static formatAngularInstallFailed(exitCode: number | null, errorOutput: string): string {
    return `"npm ci" in the app failed with exit code ${exitCode}: ${errorOutput.trim()}`;
  }

  public static formatExitCodeProblem(exitCode: number | null, errorOutput: string): string {
    return `exit code ${exitCode}: ${errorOutput.trim()}`;
  }

  public static formatWindowBuildFailed(exitCode: number | null): string {
    return `Building the window failed with exit code ${exitCode}.`;
  }

  public static formatWindowContainsText(shown: string, found: string, file: string): string {
    return `The window built in ${shown} contains ${JSON.stringify(found)} in ${file}.`;
  }

  public static formatWindowHasNoFiles(shown: string): string {
    return `The window built in ${shown} has no files to check.`;
  }

  public static formatJsonUnreadable(file: string, error: unknown): string {
    return `${file} could not be read as JSON: ${String(error)}.`;
  }

  public static formatPackageLockKey(name: string): string {
    return `${Resources.nodeModulesFolder}/${name}`;
  }

  public static formatScopedPackageName(scope: string, name: string): string {
    return `${scope}/${name}`;
  }

  public static formatAngularInstallRecord(platform: string, arch: string, hash: string): string {
    return `${platform} ${arch} ${hash}\n`;
  }

  public static formatGalleryFileContent(imports: string, isPackaged: boolean): string {
    return `${Resources.licenseHeaderBlock}\n${imports}\nexport const gallery: Type<unknown> | null = ${isPackaged ? "null" : "GalleryComponent"};\n`;
  }

  public static formatProductNameLine(name: string): string {
    return `export const productName: string = ${JSON.stringify(name)};`;
  }

  public static formatProductAboutLine(about: Readonly<Record<string, unknown>>): string {
    return `export const productAbout: IProductAbout = ${JSON.stringify(about)};`;
  }

  public static formatTitleBarIconMissing(icon: string): string {
    return `The root ${Resources.packageManifestFileName}'s ${Resources.formatFieldPath(Resources.manifestDesktopField, Resources.productField, Resources.productTitleBarIconField)} names ${icon}, `
      + "which isn't in the app's tree.";
  }

  public static formatProductTitleBarLine(titleBar: Readonly<Record<string, unknown>>): string {
    return `export const productTitleBar: IProductTitleBar = ${JSON.stringify(titleBar)};`;
  }

  public static formatInstalledCopiesRefusal(name: string, listing: string): string {
    return `"npm ls ${name}" gave no list of copies to check:\n${listing.trim()}`;
  }

  public static formatDevelopmentPreparing(productName: string): string {
    return `Preparing the ${productName} development binary...\n`;
  }

  public static formatDevelopmentCopyright(publisher: string): string {
    return `Copyright (c) ${publisher}.`;
  }

  public static formatMacHelperIdentifier(helperIdentifier: string, role: string): string {
    return `${helperIdentifier}.${role}`;
  }

  public static formatUserNamespaceRefusal(file: string, value: string): string {
    return `${file} is ${value}`;
  }

  public static formatShellQuoted(text: string): string {
    return `'${text.replaceAll("'", "'\\''")}'`;
  }

  public static formatSandboxProblem(helper: string): string {
    const quoted = Resources.formatShellQuoted(helper);
    return [
      "This system restricts unprivileged user namespaces, so Chromium's sandbox needs its helper owned by root with the setuid bit. Set it up once:",
      `  sudo chown root:root ${quoted} && sudo chmod 4755 ${quoted}`,
      "Then run npm start again. Preparing the development app again, after a change to Electron, the version or the icons, needs the step again.",
      String.empty
    ].join(Resources.lineSeparator);
  }

  public static formatOutputLine(text: string): string {
    return `${text}\n`;
  }

  public static formatPackagesBuilt(count: number): string {
    return `Packages built and installed: ${count}.\n`;
  }

  public static formatBuildPart(part: number): string {
    return part === Resources.buildPackageTestsPart
      ? "Part 2 of 2: building the packages and their tests, without the window.\n"
      : "Part 1 of 2: building the packages and the window, without the packages' tests.\n";
  }

  public static formatModulesInBuild(count: number): string {
    return `Modules in the build: ${count}.\n`;
  }

  public static formatNoldovaDesktopRangeUsage(command: string): string {
    return `Usage: ${command} ${Resources.noldovaDesktopRangeCommand} <lowest Noldova Desktop version>\n`;
  }

  public static formatNotOneExactVersion(version: string): string {
    return `${Resources.githubErrorPrefix}${JSON.stringify(version)} is not one exact version, such as 0.0.71.\n`;
  }

  public static formatGithubError(message: string): string {
    return `${Resources.githubErrorPrefix}${message}\n`;
  }

  public static formatChooseFeedUsage(command: string): string {
    return `Usage: ${Resources.internalFeedVariable}=<empty, build or copy> ${Resources.internalFeedUrlVariable}=<URL> ${Resources.updateFeedVariable}=<URL> ${Resources.packageVersionVariable}=<version> `
      + `${Resources.releaseVersionVariable}=<N.N.N> ${Resources.runNumberVariable}=<number> ${Resources.runAttemptVariable}=<number> ${Resources.signingVariable}=<signed platforms> ${command} ${Resources.chooseFeedCommand}\n`;
  }

  public static formatInternalFeedKindInvalid(kind: string): string {
    return `internal-feed must be empty, build or copy, not ${kind}.`;
  }

  public static formatInternalVersion(releaseVersion: string, runNumber: string): string {
    return `${releaseVersion}-internal.${runNumber}`;
  }

  public static formatInternalFeedRerun(version: string): string {
    return `A build for the internal update feed runs once, since a re-run would build other packages as the same ${version}; start a new run.`;
  }

  public static formatInternalFeedChosen(version: string): string {
    return `The packages check the internal update feed as version ${version}.\n`;
  }

  public static formatFeedOutputs(feed: string, version: string): string {
    return `update-feed=${feed}\npackage-version=${version}\n`;
  }

  public static formatListTargetsUsage(command: string): string {
    return `Usage: ${command} ${Resources.listTargetsCommand} [<app folder>]\n`;
  }

  public static formatRunnerVariable(runnerName: string): string {
    return `${Resources.runnerVariablePrefix}${runnerName}`;
  }

  public static formatRunnerMissing(variable: string, targetName: string, runner: string): string {
    return `The variable ${variable} names no runner for ${targetName}, as JSON such as "ubuntu-24.04" or ["a-label","linux"]: ${JSON.stringify(runner)}.\n`;
  }

  public static formatModuleRangeUsage(command: string): string {
    return `Usage: ${Resources.publishedVersionsVariable}=<the versions npm view lists, as JSON> ${command} ${Resources.moduleRangeCommand} <module folder>\n`;
  }

  public static formatDeclarationNotObject(file: string): string {
    return `${file} could not be read as a JSON object.`;
  }

  public static formatModuleRangeMissing(file: string): string {
    return `${file} names no ${Resources.noldovaDesktopField} range, so there is no range to check; a module names one as MODULES.md's "Noldova Desktop versions" says.`;
  }

  public static formatModuleRangeForm(file: string, declared: string): string {
    return `${file}'s ${Resources.noldovaDesktopField} is ${JSON.stringify(declared)}, not of the one form ${Resources.versionRangeForm}.`;
  }

  public static formatModuleRangeNotFollowing(file: string, range: string, minimum: string, following: string): string {
    return `${file}'s ${Resources.noldovaDesktopField} is ${range}, but a range from ${minimum} ends below the next version that may break modules: ${following}.`;
  }

  public static formatModuleRangePinNotExact(name: string, version: string): string {
    return `The root ${Resources.packageManifestFileName} names ${name} at ${version}, not at one exact version; `
      + `a module pins each Noldova Desktop package to the exact version its range starts at, as MODULES.md's "Noldova Desktop versions" says.`;
  }

  public static formatModuleRangeNotPin(file: string, range: string, name: string, pin: string): string {
    return `${file}'s ${Resources.noldovaDesktopField} is ${range}, but the root ${Resources.packageManifestFileName} pins ${name} at ${pin}; `
      + `the range's lowest version is the module's exact development pin, as MODULES.md's "Noldova Desktop versions" says.`;
  }

  public static formatModuleRangeNoneInside(file: string, range: string): string {
    return `No published Noldova Desktop version is inside ${file}'s ${Resources.noldovaDesktopField} range ${range}.`;
  }

  public static formatModuleRangeHolds(range: string, count: number, newest: string): string {
    return `The range ${range} holds ${count.toString()} published Noldova Desktop versions; the newest is ${newest}.\n`;
  }

  public static formatModuleRangeOutputs(range: string, newest: string): string {
    return `range=${range}\nversion=${newest}\n`;
  }

  public static formatFeedCheckUsage(command: string): string {
    return `Usage: [${Resources.feedSkipVariable}=<true or false>] ${Resources.feedVersionVariable}=<version> ${Resources.releaseTargetsVariable}=<target ids> `
      + `{${Resources.releaseRepositoryVariable}=<owner/name> | ${Resources.feedUrlVariable}=<URL>} [${Resources.feedWaitVariable}=<seconds>] ${command} ${Resources.feedCheckCommand}\n`;
  }

  public static formatFeedSkipInvalid(value: string): string {
    return `${Resources.feedSkipVariable} must be true or false, not "${value}".`;
  }

  public static formatFeedVersionInvalid(version: string): string {
    return `${Resources.feedVersionVariable} must be the version the feed serves, such as 0.0.2 or 0.0.2-internal.10, not "${version}".`;
  }

  public static formatFeedHttpProblem(name: string, feed: string, status: number): string {
    return `${name} could not be read from ${feed}: HTTP ${status}.`;
  }

  public static formatFeedReadFailed(name: string, feed: string, error: unknown): string {
    return `${name} could not be read from ${feed}: ${String(error)}`;
  }

  public static formatFeedVersionMismatch(name: string, feed: string, found: string, version: string): string {
    return `${name} in ${feed} names the version "${found}", not ${version}.`;
  }

  public static formatFeedCatchingUp(problem: string): string {
    return `${problem} The feed may still be catching up, so the check tries again.\n`;
  }

  public static formatFeedListsNoFiles(metadata: string, feed: string): string {
    return `${metadata} in ${feed} lists no files.`;
  }

  public static formatFeedFileIncomplete(metadata: string, feed: string): string {
    return `${metadata} in ${feed} lists a file without its url, sha512 and size, one to a line in that order.`;
  }

  public static formatFeedHashMismatch(name: string, feed: string, sha512: string, metadata: string, expected: string): string {
    return `${name} in ${feed} has the SHA-512 ${sha512}, but ${metadata} gives ${expected}.`;
  }

  public static formatFeedSizeMismatch(name: string, feed: string, size: number, metadata: string, expected: number): string {
    return `${name} in ${feed} has ${size} bytes, but ${metadata} gives ${expected}.`;
  }

  public static formatFeedWebPage(name: string, feed: string, origin: string, pathname: string): string {
    return `${name} could not be read from ${feed}: it led to a web page, such as a sign-in page, at ${origin}${pathname}, so the feed is not anonymous.`;
  }

  public static formatFeedRedirectedAway(name: string, feed: string, origin: string): string {
    return `${name} could not be read from ${feed}: it redirected to ${origin}, which is neither the feed's origin nor GitHub's release asset host.`;
  }

  public static formatFeedTooManyRedirects(name: string, feed: string): string {
    return `${name} could not be read from ${feed}: it redirected more than ${Resources.feedMaximumRedirects} times.`;
  }

  public static formatFeedUrlInvalid(feed: string): string {
    return `${Resources.feedUrlVariable} must be an HTTPS folder URL ending in /, or a loopback http one, not "${feed}".`;
  }

  public static formatFeedRepositoryInvalid(repository: string): string {
    return `Without ${Resources.feedUrlVariable}, ${Resources.releaseRepositoryVariable} must name the repository whose latest release is the feed, as owner/name, not "${repository}".`;
  }

  public static formatFeedWaitInvalid(text: string): string {
    return `${Resources.feedWaitVariable} must be the seconds to wait for a feed that is behind, from 0 to ${Resources.feedMaximumWaitSeconds}, not "${text}".`;
  }

  public static formatPackagedProductUnreadable(file: string, error: unknown): string {
    return `The packaged product file ${file} could not be read as JSON, so its update feed is unknown: ${String(error)}`;
  }

  public static formatPackagedFeedMismatch(feed: unknown, expected: string): string {
    return `The packaged product file names the update feed ${JSON.stringify(feed ?? null)}, not ${expected}, so its packages cannot be released.`;
  }

  public static formatReleaseCheckUsage(command: string): string {
    return `Usage: ${Resources.releaseRepositoryVariable}=<owner/name> ${Resources.releaseVersionVariable}=<N.N.N> ${Resources.releaseRevisionVariable}=<commit> `
      + `${Resources.formatReleaseSourceOptions()} [${Resources.releaseSetsVersionVariable}=true] ${command} ${Resources.releaseCheckCommand}\n`;
  }

  public static formatReleaseSourceOptions(): string {
    return `[${Resources.releaseSourceRepositoryVariable}=<owner/name>] [${Resources.releaseBuildRepositoryVariable}=<owner/name>] [${Resources.releaseTagPrefixVariable}=<prefix>]`;
  }

  public static formatRootVersionMismatch(rootVersion: string, version: string): string {
    return `The root manifest's version is ${rootVersion}, not ${version}; raise it on ${Resources.mainBranch} first, or let the release set it.`;
  }

  public static formatReleaseSetsVersionInvalid(value: string): string {
    return `${Resources.releaseSetsVersionVariable} must be true or false, not "${value}".`;
  }

  public static formatReleaseLabel(index: number): string {
    return `releases[${index}]`;
  }

  public static formatReleaseTagLabel(id: number): string {
    return `The tag of release ${id}`;
  }

  public static formatReleaseNotNewer(version: string, highest: string): string {
    return `${version} is not newer than the highest release, ${highest}.`;
  }

  public static formatReleaseOvertaken(version: string, highest: string): string {
    return `${version} is not newer than the highest release, ${highest}, which another run published after this one's check, so ${version} is not published; release a version newer than ${highest}.`;
  }

  public static formatCompareRoute(revision: string): string {
    return `/compare/${revision}...${Resources.mainBranch}`;
  }

  public static formatRevisionNotCommit(revision: string, repository: string): string {
    return `${revision} is not a commit of ${repository}.`;
  }

  public static formatRevisionNotOnMain(revision: string, status: string): string {
    return `${revision} is not on ${Resources.mainBranch}; ${Resources.mainBranch} is ${status} compared with it.`;
  }

  public static formatBuildRunsRoute(revision: string): string {
    return `${Resources.buildRunsRoute}${revision}`;
  }

  public static formatNoBuildRun(revision: string): string {
    return `No Build and test run on ${Resources.mainBranch} has checked ${revision}; release a revision whose run on ${Resources.mainBranch} passed.`;
  }

  public static formatBuildRunFailed(revision: string, conclusion: string): string {
    return `The Build and test run on ${Resources.mainBranch} for ${revision} is ${conclusion}, not ${Resources.successConclusion}; `
      + `release a revision whose run on ${Resources.mainBranch} passed.`;
  }

  public static formatReleasePublishUsage(command: string): string {
    return `Usage: ${Resources.releaseRepositoryVariable}=<owner/name> ${Resources.releaseVersionVariable}=<N.N.N> ${Resources.releaseRevisionVariable}=<commit> ${Resources.releaseFolderVariable}=<folder> `
      + `${Resources.formatReleaseSourceOptions()} ${Resources.releaseReportsVariable}=<folder> ${Resources.releaseRunVariable}=<url> [${Resources.releaseUpdateFeedVariable}=<loopback URL> | ${Resources.releaseInternalVariable}=<N.N.N-internal.N>] ${command} ${Resources.releasePublishCommand}\n`;
  }

  public static formatReleaseLockUsage(command: string): string {
    return `Usage: ${Resources.releaseBuildRepositoryVariable}=<owner/name> ${Resources.releaseLockRunVariable}=<run id> ${Resources.releaseLockRevisionVariable}=<commit> ${command} ${Resources.releaseLockCommand}\n`;
  }

  public static formatReleaseUnlockUsage(command: string): string {
    return `Usage: ${Resources.releaseBuildRepositoryVariable}=<owner/name> ${Resources.releaseLockRunVariable}=<run id> ${command} ${Resources.releaseUnlockCommand}\n`;
  }

  public static formatReleaseLockVariableInvalid(variable: string, value: string): string {
    return `${variable} must be set as the release lock needs it, not "${value}".`;
  }

  public static formatReleaseLockMessage(run: string): string {
    return `Release lock for run ${run}`;
  }

  public static formatGitHubCommitPath(commit: string): string {
    return `${Resources.githubCommitsPath}/${commit}`;
  }

  public static formatGitHubRunPath(run: string): string {
    return `/actions/runs/${run}`;
  }

  public static formatReleaseLockTaken(repository: string, run: string): string {
    return `Run ${run} took the release lock of ${repository}.\n`;
  }

  public static formatReleaseLockTakenAgain(repository: string, run: string): string {
    return `Run ${run} already held the release lock of ${repository} from an earlier attempt, and holds it again.\n`;
  }

  public static formatReleaseLockBroken(repository: string, run: string, holder: string | null): string {
    return `${Resources.formatReleaseLockHolder(holder)} held the release lock of ${repository} and has ended without letting go of it, so run ${run} took it over.\n`;
  }

  public static formatReleaseLockWaiting(repository: string, holder: string | null): string {
    return `${Resources.formatReleaseLockHolder(holder)} holds the release lock of ${repository}, so this run tries again every ${Resources.releaseLockRetryInterval / Resources.millisecondsPerSecond} s until that run lets go of it or ends.\n`;
  }

  public static formatReleaseLockLost(repository: string): string {
    return `Another run changed the release lock of ${repository} first, so this run reads it again in ${Resources.releaseLockRetryInterval / Resources.millisecondsPerSecond} s.\n`;
  }

  public static formatReleaseLockFree(repository: string): string {
    return `Nothing holds the release lock of ${repository}, so there is nothing to let go of.\n`;
  }

  public static formatReleaseLockHeldByAnother(repository: string, run: string, holder: string | null): string {
    return `${Resources.formatReleaseLockHolder(holder)} holds the release lock of ${repository}, not run ${run}, so it stays.\n`;
  }

  public static formatReleaseLockLetGo(repository: string, run: string): string {
    return `Run ${run} let go of the release lock of ${repository}.\n`;
  }

  public static formatReleaseLockHolder(holder: string | null): string {
    return Object.isNull(holder) ? "A commit that names no run" : `Run ${holder}`;
  }

  public static formatTestFeedPublishesNothing(feed: string): string {
    return `This run tests updating with the feed ${feed}, so it publishes nothing.\n`;
  }

  public static formatReleaseFolderNotAbsolute(folder: string): string {
    return `${Resources.releaseFolderVariable} must be the absolute path of the folder that holds the release's files, not "${folder}".`;
  }

  public static formatReleaseFolderHasLabelMark(folder: string): string {
    return `${Resources.releaseFolderVariable} must not contain ${Resources.uploadLabelMark}, which gh release upload reads as the start of a file's label: "${folder}".`;
  }

  public static formatReleaseReportsNotAbsolute(reports: string): string {
    return `${Resources.releaseReportsVariable} must be the absolute path of the folder that holds the targets' package reports, not "${reports}".`;
  }

  public static formatInternalFilesChecked(internal: string): string {
    return `The release files of ${internal} are checked for the internal update feed, so this run publishes nothing here.\n`;
  }

  public static formatInternalVersionInvalid(version: string, internal: string): string {
    return `${Resources.releaseInternalVariable} must be ${version}-internal.<run number>, an internal build before the release, not "${internal}".`;
  }

  public static formatInternalUnsigned(repository: string): string {
    return `${repository} is not the app's release repository, so its packages are unsigned and cannot go to the internal update feed.`;
  }

  public static formatLinuxSigningCredentialsMissing(missing: readonly string[]): string {
    return `Signing Linux packages needs ${missing.join(Resources.listSeparator)}, the Ed25519 key that signs the update packages and the public keys the app ships.`;
  }

  public static formatLinuxPackagesSigned(names: readonly string[]): string {
    return `Signed ${names.join(Resources.listSeparator)} for the update feed.\n`;
  }

  public static formatLinuxSignaturesVerified(names: readonly string[]): string {
    return `Each of ${names.join(Resources.listSeparator)} carries a valid signature by a key the app ships.`;
  }

  public static formatLinuxSignatureInvalid(name: string): string {
    return `${name} carries no valid signature by a key the app ships.`;
  }

  public static formatUpdateSignaturesUnreadable(file: string, error: unknown): string {
    return `The update signatures ${file} could not be read as JSON: ${String(error)}`;
  }

  public static formatUpdateSignatureMessage(version: string, targetId: string, name: string, sha512: string): string {
    return `noldova-desktop-update/1\n${version}\n${targetId}\n${name}\n${sha512}\n`;
  }

  public static formatBuilderFailed(exitCode: number | null): string {
    return `electron-builder failed with exit code ${exitCode}.`;
  }

  public static formatSignatures(verification: string): string {
    return `Signatures:\n${verification}\n`;
  }

  public static formatOptionValue(option: string, value: string): string {
    return `${option}=${value}`;
  }

  public static formatFolderPrefix(folder: string): string {
    return `${folder}/`;
  }

  public static formatSmokeInstalled(seconds: number, mainProcess: string): string {
    return `Installed in ${seconds.toFixed(1)} s: ${mainProcess}\n`;
  }

  public static formatSmokeNoRuntimeBeforeStart(slug: string): string {
    return `${slug} status ${Resources.smokeMomentBeforeStart}: no runtime.\n`;
  }

  public static formatSmokeReinstallRefused(exitCode: number | null, output: string): string {
    return `The installer, run over the running app, exited with ${String(exitCode)}:\n${output}`;
  }

  public static formatSmokeLeftProcess(name: string, processId: number): string {
    return `${name}, process ${String(processId)}`;
  }

  public static formatSmokeRunningAppLeft(left: readonly string[]): string {
    return `The installer, run over the running app, left running ${left.join("; ")}.`;
  }

  public static formatSmokeOtherUserNotStarted(user: string, exitCode: number | null, output: string): string {
    return `The app could not be started as ${user}: ${Resources.windowsPowershellCommand} exited with ${String(exitCode)}:\n${output}`;
  }

  public static formatSmokeOtherUserEnded(user: string, processId: number, moment: string): string {
    return `${user}'s app, process ${String(processId)}, no longer ran ${moment}.`;
  }

  public static formatSmokeOtherUserReinstalled(user: string): string {
    return `The installer installed over ${user}'s app while it still ran, rather than ending it or refusing.`;
  }

  public static formatSmokeOtherUserClosed(user: string): string {
    return `Run with SeDebugPrivilege enabled over ${user}'s running app, the installer ended it and installed.\n`;
  }

  public static formatSmokeOtherUserRefused(user: string, exitCode: number | null): string {
    return `Run with SeDebugPrivilege disabled over ${user}'s running app, the installer refused with exit code ${String(exitCode)} and left it running.\n`;
  }

  public static formatSmokeOtherUserNotClosed(user: string, exitCode: number | null): string {
    return `Run with SeDebugPrivilege enabled over ${user}'s running app, the installer refused with exit code ${String(exitCode)} rather than ending it and installing.`;
  }

  public static formatSmokeOtherUserClosedWithoutDebug(user: string): string {
    return `Run with SeDebugPrivilege disabled, the installer ended ${user}'s app and installed, rather than refusing.`;
  }

  public static formatSmokeDebugPrivilegeUnread(exitCode: number | null, output: string): string {
    return `The smoke could not tell whether its SeDebugPrivilege is enabled: whoami exited with ${String(exitCode)}:\n${output}`;
  }

  public static formatSmokeDiscoveryNamesNoProcess(file: string): string {
    return `The runtime's discovery file ${file} names no process.`;
  }

  public static formatSmokeMainDidNotExit(slug: string, tail: string): string {
    return `The main process did not exit within ${Resources.smokeQuitLimit} ms after ${slug} quit said it quit:\n${tail}`;
  }

  public static formatSmokeMainQuitBadly(ending: string, tail: string): string {
    return `The main process quit but ${ending}:\n${tail}`;
  }

  public static formatSmokeRuntimeOutlived(runtime: number, tail: string): string {
    return `The runtime, process ${runtime}, did not stop within ${Resources.smokeStopLimit} ms after the main process quit, although nothing used it:\n${tail}`;
  }

  public static formatSmokePathChanged(after: string | null, before: string | null): string {
    return `After the uninstall the user's Path is ${JSON.stringify(after)} instead of ${JSON.stringify(before)}, as it was before the install.`;
  }

  public static formatSmokeCookiesUnencrypted(binary: string): string {
    return `The installed ${binary} keeps cookies unencrypted, although the app's modules declare web views, whose profiles keep their cookies encrypted.`;
  }

  public static formatSmokeCookiesEncrypted(binary: string): string {
    return `The installed ${binary} encrypts cookies, although no module of the app declares web views, the only reason to turn it on.`;
  }

  public static formatSmokeCookieEncryption(isEncrypted: boolean): string {
    return `Cookie encryption: ${isEncrypted ? Resources.smokeCookiesOn : Resources.smokeCookiesOff}.\n`;
  }

  public static formatSmokePathCount(entry: string, count: number, value: string | null): string {
    return `The user's Path holds ${entry} ${count} times instead of once: ${JSON.stringify(value)}`;
  }

  public static formatSmokePathHolds(intro: string, entry: string): string {
    return `${intro} ${entry} once.\n`;
  }

  public static formatPowerShellStatusLine(commandName: string, deviceFolder: string, data: string): string {
    return ["&", commandName, ...Resources.smokeStatusArguments, Resources.deviceDirectoryOption, `'${deviceFolder}'`,
      Resources.dataDirectoryOption, `'${data}';`, "exit", "$LASTEXITCODE"].join(" ");
  }

  public static formatSmokePowerShellFailed(slug: string, exitCode: number | null, text: string): string {
    return `${slug} status ${Resources.smokeMomentPowerShell} exited with ${exitCode}:\n${text}`;
  }

  public static formatSmokeWindowlessCommandFailed(slug: string, moment: string, exitCode: number | null, text: string): string {
    return `${slug} status ${moment} exited with ${exitCode}:\n${text}`;
  }

  public static formatSmokeLinkFailed(slug: string, command: string, exitCode: number | null, text: string): string {
    return `${slug} status through a link to ${command} exited with ${exitCode}:\n${text}`;
  }

  public static formatSmokeProbeFails(refusal: string | null): string {
    return `\`${Resources.userNamespacesProbeLine}\` fails here${Object.isNull(refusal) ? Resources.smokeNoProcRefusal : `, as ${refusal}`}, so the AppImage's launcher starts it without Chromium's sandbox.\n`;
  }

  public static formatSmokeProbeRuns(refusal: string): string {
    return `\`${Resources.userNamespacesProbeLine}\` runs here though ${refusal}, so the AppImage's launcher starts it with Chromium's sandbox.\n`;
  }

  public static formatSmokeExtractionRecords(logs: string, count: number): string {
    return `While the main process ran, ${logs} held ${count} copy records of the runtime's AppImage instead of one naming an extraction that is still there.`;
  }

  public static formatSmokeExtraction(extraction: string, bytes: number): string {
    return `The runtime holds its own extraction of the AppImage in ${extraction}, ${(bytes / Resources.bytesPerMebibyte).toFixed(1)} MiB.\n`;
  }

  public static formatSmokeNoMount(runtime: number, program: string, input: string): string {
    return `The runtime, process ${runtime}, holds no mount of the AppImage through a pipe: it runs ${program} with the input ${input}.`;
  }

  public static formatSmokeMounted(mount: string): string {
    return `The runtime runs from its own mount of the AppImage at ${mount} and holds it through its input pipe.\n`;
  }

  public static formatSmokeProgramUnreadable(program: string): string {
    return `After the AppImage was replaced, the runtime's program ${program} could no longer be read.`;
  }

  public static formatSmokeStatusAfterReplace(slug: string, exitCode: number | null, text: string): string {
    return `After the AppImage was replaced, ${slug} status exited with ${exitCode}:\n${text}`;
  }

  public static formatSmokeCopyEnded(moment: string): string {
    return `The runtime's copy of the AppImage ended once the runtime ${moment}.\n`;
  }

  public static formatSmokeRuntimeStillRunning(runtime: number): string {
    return `The runtime, process ${runtime}, was still running ${Resources.smokeKillLimit} ms after it was killed.`;
  }

  public static formatSmokeFolderNotRemoved(folder: string | null, error: unknown): string {
    return `The smoke's folder ${folder} could not be removed: ${String(error)}`;
  }

  public static formatDebianInstalledElsewhere(program: string, expected: string): string {
    return `The Debian package installed its program at ${program}, outside a folder of its own in ${expected}.`;
  }

  public static formatMacInstallerElsewhere(installer: string, location: string, information: string): string {
    return `The installer package ${installer} installs elsewhere than ${location}:\n${information}`;
  }

  public static formatMacInstallerDomainsOpen(installer: string, location: string, domains: readonly string[]): string {
    const found = domains.length === 0 ? "it has no <domains> element" : `it has ${domains.join(" and ")}`;
    return `The installer package ${installer} must install only into ${location} on the startup disk, with one `
      + `<domains enable_anywhere="false" enable_currentUserHome="false" enable_localSystem="true"/> in its Distribution, but ${found}.`;
  }

  public static formatMacNeighbourTouched(neighbour: string): string {
    return `Installing the installer package removed or replaced ${neighbour}, which it must leave beside the app.`;
  }

  public static formatMacInstalled(installer: string, application: string, neighbour: string): string {
    return `${installer} installed ${application} and left ${neighbour} beside it.`;
  }

  public static formatMacRemoved(application: string, neighbour: string): string {
    return `Removed ${application} and ${neighbour}.`;
  }

  public static formatSmokeSystemInstallNotRemoved(packageName: string, error: unknown): string {
    return `The smoke's install of ${packageName} could not be removed: ${String(error)}`;
  }

  public static formatSmokeRuntimeNotEnded(runtime: number): string {
    return `The runtime, process ${runtime}, could not be ended: it was still running ${Resources.smokeKillLimit} ms after it was killed.`;
  }

  public static formatSmokeDiscoveryUnreadable(folder: string, error: unknown): string {
    return `The runtime's discovery file in ${folder} could not be read: ${String(error)}`;
  }

  public static formatSmokeRuntimeEndFailed(runtime: number, error: unknown): string {
    return `The runtime, process ${runtime}, could not be ended: ${String(error)}`;
  }

  public static formatSmokeLogTail(log: string, tail: string): string {
    return `${log}:\n${tail.trim()}`;
  }

  public static formatSmokeNoFuseWire(binary: string, fuse: number): string {
    return `${binary} holds no version ${Resources.electronFuseWireVersion} fuse wire with fuse ${fuse} set on or off.`;
  }

  public static formatSmokeStatusNotNoRuntime(slug: string, moment: string, exitCode: number | null, text: string): string {
    return `${slug} status ${moment} exited with ${exitCode} instead of ${Resources.smokeNoRuntimeExitCode}:\n${text}`;
  }

  public static formatSmokeMainEndedBeforeRuntime(ending: string, tail: string): string {
    return `The main process ${ending} before its runtime answered:\n${tail}`;
  }

  public static formatSmokeRuntimeNoAnswer(slug: string, exitCode: number | null, text: string, tail: string): string {
    return `The main process's runtime did not answer ${slug} status within ${Resources.smokeStartLimit} ms; the last answer was exit code ${exitCode}:\n${text}\n${tail}`;
  }

  public static formatSmokeMainEndedBeforeLauncher(ending: string, tail: string): string {
    return `The main process ${ending} before its launcher connected to the runtime:\n${tail}`;
  }

  public static formatSmokeLogsUnwatchable(logs: string): string {
    return `The launcher's logs folder ${logs} can't be watched for its start log.`;
  }

  public static formatSmokeLauncherKeptStartLog(logs: string, tail: string): string {
    return `The main process's launcher still kept its start log in ${logs} ${Resources.smokeStartLimit} ms after the runtime answered, so it never connected:\n${tail}`;
  }

  public static formatSmokeStatusIncomplete(slug: string, answer: string): string {
    return `${slug} status --json answered without a build version and a data directory:\n${answer.trim()}`;
  }

  public static formatSmokeStatusMismatch(slug: string, reportedVersion: string, directory: string, version: string, data: string): string {
    return `${slug} status reported version ${reportedVersion} in ${directory} instead of ${version} in ${data}.`;
  }

  public static formatSmokeStatusReported(slug: string, moment: string, version: string, directory: string): string {
    return `${slug} status ${moment}: version ${version} in ${directory}.\n`;
  }

  public static formatSmokeScreenshotFile(platform: string, architecture: string): string {
    return `window-${platform}-${architecture}${Resources.pngExtension}`;
  }

  public static formatSmokeScreenCaptured(file: string): string {
    return `The screen with the window: ${file}\n`;
  }

  public static formatSmokeScreenNotCaptured(exitCode: number | null, text: string): string {
    return `The screen could not be captured, so the run keeps no picture of the window; ${Resources.smokeScreenCaptureCommand} exited with ${exitCode}:\n${text}\n`;
  }

  public static formatSmokeQuitOutcomeWrong(slug: string, exitCode: number | null, text: string): string {
    return `${slug} quit did not answer the outcome ${Resources.quitOutcome}; it exited with ${exitCode}:\n${text}`;
  }

  public static formatHashEntry(name: string, hash: string | undefined): string {
    return `${name}${Resources.hashEntrySeparator}${hash}`;
  }

  public static formatArchiveName(baseName: string, version: string): string {
    return `${baseName}${Resources.kebabSeparator}${version}${Resources.packageArchiveExtension}`;
  }

  public static formatRecordFile(name: string): string {
    return `${name}${Resources.recordExtension}`;
  }

  public static formatTestRecordFile(name: string): string {
    return `${name}${Resources.testRecordExtension}`;
  }

  public static formatAddonFile(addon: string): string {
    return `${addon}${Resources.addonExtension}`;
  }

  public static formatAddonTarget(platform: string, architecture: string): string {
    return `${platform}${Resources.kebabSeparator}${architecture}`;
  }

  public static formatAddonToolchainMissing(packageName: string, addon: string, toolchain: string): string {
    return `Building ${packageName}'s Windows addon ${addon} needs ${toolchain}, and node-gyp found no Visual Studio with it. Install it and run npm run build again.`;
  }

  public static formatAddonHeadersRetried(folder: string, attempt: number, pause: number, text: string): string {
    return `Downloading Node.js's headers into ${folder} stalled with exit code ${Resources.addonHeadersStalledExitCode} on try ${attempt} of ${Resources.addonHeadersAttempts}, `
      + `so the build tries again in ${pause / Resources.millisecondsPerSecond} seconds:\n${text}\n`;
  }

  public static formatAddonHeadersFailed(folder: string, attempt: number, exitCode: number | null, text: string): string {
    return `Downloading Node.js's headers into ${folder} for the addons failed with exit code ${exitCode} on try ${attempt} of ${Resources.addonHeadersAttempts}:\n${text}`;
  }

  public static formatAddonBuildFailed(packageName: string, kind: string, addon: string, exitCode: number | null, text: string): string {
    return `Building ${packageName}'s ${kind} addon ${addon} failed with exit code ${exitCode}:\n${text}`;
  }

  public static formatAddonArchitectureRefused(packageName: string, architecture: string, machineArchitecture: string): string {
    return `${packageName}'s addons can't be built for ${architecture} on this ${machineArchitecture} machine, since node-gyp builds for the machine's own processor. Build on a ${architecture} machine, or name a folder of release builds in ${Resources.releaseAddonsVariable}.`;
  }

  public static formatReleaseAddonMissing(target: string, packageName: string, addon: string, directory: string, build: string): string {
    return `${Resources.releaseAddonsVariable} lacks the ${target} build of ${packageName}'s addon ${addon}, ${directory}/${build}.`;
  }

  public static formatArchiveUnreadable(archive: string): string {
    return `${archive} could not be read as a gzipped archive.`;
  }

  public static formatArchiveEntryMalformed(archive: string, offset: number): string {
    return `${archive} has a malformed or truncated entry at offset ${offset}.`;
  }

  public static formatFixturePackageMisnamed(directory: string, expected: string): string {
    return `${directory}/${Resources.packageManifestFileName} must be named "${expected}", the fixture package's path below ${Resources.moduleFixtureFolder}/ joined with dots.`;
  }

  public static formatSourcePackageMisnamed(directory: string, expected: string): string {
    return `${directory}/${Resources.packageManifestFileName} must be named "${expected}", the name its folder gives.`;
  }

  public static formatManifestUnreadable(file: string): string {
    return `${file} could not be read as JSON.`;
  }

  public static formatManifestNameMissing(file: string): string {
    return `${file} must have a name.`;
  }

  public static formatManifestVersionUnstamped(file: string): string {
    return `${file} must have the version "${Resources.packageVersionPlaceholder}"; the build stamps the root package.json's version.`;
  }

  public static formatManifestDependenciesInvalid(file: string): string {
    return `${file} must list its dependencies as an object.`;
  }

  public static formatManifestPeersInvalid(file: string): string {
    return `${file} must list its peer dependencies as an object.`;
  }

  public static formatManifestPeersMetaInvalid(file: string): string {
    return `${file} must describe each peer dependency in ${Resources.peerDependenciesMetaField} as an object, with ${Resources.optionalField}, when given, true or false.`;
  }

  public static formatManifestSettingsInvalid(file: string): string {
    return `${file} must keep its noldova settings in an object.`;
  }

  public static formatManifestExclusionsInvalid(file: string): string {
    return `${file} must list its coverage exclusions in an array.`;
  }

  public static formatManifestAddonsInvalid(file: string, kind: string): string {
    return `${file} must list its ${kind} addons in an array of kebab-case names.`;
  }

  public static formatManifestFilesInvalid(file: string): string {
    return `${file} must list its files in an array of patterns.`;
  }

  public static formatInstallLocationAttribute(location: string): string {
    return `install-location="${location.replaceAll("&", "&amp;")}"`;
  }

  public static formatMacInstallLocation(installFolder: string): string {
    return `${Resources.macApplicationsFolder}/${installFolder}`;
  }

  public static formatDebianUpdateActionId(applicationId: string): string {
    return `${applicationId.toLowerCase().replaceAll(Resources.polkitActionIdUnsafe, Resources.polkitActionIdReplacement)}.update`;
  }

  public static formatDebianUpdatePolicyFile(applicationId: string): string {
    return `${Resources.polkitActionsFolder}/${Resources.formatDebianUpdateActionId(applicationId)}.policy`;
  }

  public static formatDebianUpdatePolicy(applicationId: string, name: string): string {
    const escaped = name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<!DOCTYPE policyconfig PUBLIC \"-//freedesktop//DTD PolicyKit Policy Configuration 1.0//EN\" \"http://www.freedesktop.org/standards/PolicyKit/1/policyconfig.dtd\">",
      "<policyconfig>",
      `  <action id="${Resources.formatDebianUpdateActionId(applicationId)}">`,
      `    <description>Install an update of ${escaped}</description>`,
      `    <message>Installing the ${escaped} update needs an administrator's permission.</message>`,
      "    <defaults>",
      "      <allow_any>auth_admin</allow_any>",
      "      <allow_inactive>auth_admin</allow_inactive>",
      "      <allow_active>auth_admin</allow_active>",
      "    </defaults>",
      Resources.formatDebianUpdateExecPath(`${Resources.debianTemplateProductPath}resources/${Resources.debianUpdateInstallerFile}`),
      "  </action>",
      "</policyconfig>"
    ].join(Resources.lineSeparator);
  }

  public static formatDebianUpdateExecPath(installer: string): string {
    return `    <annotate key="org.freedesktop.policykit.exec.path">${installer}</annotate>`;
  }

  public static formatDebianUpdatePolicyChecked(policy: string, installer: string): string {
    return `${policy} names ${installer} as its program, so polkit asks for the update installer in the package's own words.`;
  }

  public static formatDebianUpdatePolicyWrong(policy: string, installer: string): string {
    return `${policy} doesn't name ${installer} as its program, so pkexec would ask for the update installer with its command line in place of the package's message.`;
  }

  public static formatDebianUpdatePolicySkipped(folder: string): string {
    return `${folder} doesn't exist, so the package wrote no polkit action and pkexec asks for the update installer in its own words.`;
  }

  public static formatDebianUpdatePolicyInstall(applicationId: string, name: string): string {
    const file = Resources.formatDebianUpdatePolicyFile(applicationId);
    return [
      String.empty,
      `if [ -d '${Resources.polkitActionsFolder}' ]; then`,
      `  cat > '${file}' <<'${Resources.polkitPolicyEnd}'`,
      Resources.formatDebianUpdatePolicy(applicationId, name),
      Resources.polkitPolicyEnd,
      `  chmod 0644 '${file}'`,
      "fi",
      String.empty
    ].join(Resources.lineSeparator);
  }

  public static formatDebianUpdatePolicyRemove(applicationId: string): string {
    return [String.empty, `rm -f '${Resources.formatDebianUpdatePolicyFile(applicationId)}'`, String.empty].join(Resources.lineSeparator);
  }

  public static formatDebianInstallFolder(installFolder: string): string {
    return `${Resources.debianInstallPrefix}/${installFolder}`;
  }

  public static formatPackageTypeSource(desktopFile: string): string {
    return `${desktopFile}.${Resources.packageTypeFile}`;
  }

  public static formatPackageTypeMapping(source: string, app: string): string {
    return `${source}=${app}/${Resources.packagedResourcesFolder}/${Resources.packageTypeFile}`;
  }

  public static formatDebianInstallFolderUnplaced(installFolder: string, desktopFile: string): string {
    return `electron-builder's Debian package arguments map no app folder into ${Resources.debianInstallPrefix}, or its desktop entry ${desktopFile} runs no program there, `
      + `so the package can't move them into ${Resources.formatDebianInstallFolder(installFolder)}.`;
  }

  public static formatDebianTemplateProgramUnlinked(template: string): string {
    return `electron-builder's Debian template ${template} links no ${Resources.debianTemplateProgram}, so the package can't link /usr/bin to its command line in its place.`;
  }

  public static formatDebianTemplateUnplaced(template: string, installFolder: string): string {
    return `electron-builder's Debian template ${template} names no ${Resources.debianTemplateProductPath}, so the package can't move its paths into `
      + `${Resources.formatDebianInstallFolder(installFolder)}.`;
  }

  public static formatProductFieldInvalid(field: string, expected: string): string {
    return `The root ${Resources.packageManifestFileName}'s ${Resources.formatFieldPath(Resources.manifestDesktopField, Resources.productField, field)} must be ${expected}.`;
  }

  public static formatCheckoutApplicationId(applicationId: string, hash: string): string {
    return `${applicationId}${Resources.packageSegmentSeparator}${hash}`;
  }

  public static formatRepositoryUpdateFeed(repository: string): string {
    return `https://github.com/${repository}/releases/latest/download/`;
  }

  public static formatRepositoryPage(repository: string): string {
    return `https://github.com/${repository}`;
  }

  public static formatDebianAlreadyInstalled(packageName: string, status: string): string {
    return `The Debian package ${packageName} is already on this machine, ${status}; the smoke installs and removes it, so remove it first or smoke on another machine.`;
  }

  public static formatMacAlreadyInstalled(found: string): string {
    return `${found} is already on this machine; the smoke installs the app and removes it and its receipt, so remove it first or smoke on another machine.`;
  }

  public static formatSystemInstallNotUndone(failure: string, removal: string): string {
    return `${failure} Removing what the install placed failed too, so it may be left on this machine: ${removal}`;
  }

  public static formatDebianPackageUnnamed(file: string, exitCode: number | null, text: string): string {
    return `dpkg-deb found no package name in ${file}, ${Resources.formatExitCodeProblem(exitCode, text)}`;
  }

  public static formatDebianDependenciesMissing(file: string, missing: readonly string[], simulation: string, exitCode: number | null, text: string): string {
    const lacking = missing.length > 0 ? `needs ${missing.join(Resources.listSeparator)}, which this runner lacks` : `has dependencies apt-get could not resolve here: ${simulation.trim()}`;
    return `${file} ${lacking}, and sudo --non-interactive apt-get update could not run to find them, ${Resources.formatExitCodeProblem(exitCode, text)}. `
      + "The Debian package's smoke needs the runner's user to run apt-get as root without a password, as it installs and removes the package with sudo.";
  }

  public static formatDebianCommandNotCommandLine(command: string, target: string): string {
    return `The Debian package's command ${command} leads to ${target}, not to the command line in its resources' ${Resources.commandFolder} folder, so it would start the app.`;
  }

  public static formatDebianCommandUnresolved(command: string, exitCode: number | null, text: string): string {
    return `The Debian package left no command at ${command} that leads to its program, ${Resources.formatExitCodeProblem(exitCode, text)}`;
  }

  public static formatOwnerAndMode(owner: number, mode: string): string {
    return `${owner}:${mode}`;
  }

  public static formatDebianSandboxHelperWrong(helper: string, actual: string, expected: string, canCreate: boolean): string {
    return `${helper} is ${actual}, not ${expected} as the package's after-install script leaves it where root ${canCreate ? "can" : "cannot"} create user namespaces.`;
  }

  public static formatDebianUpdateInstallerWrong(installer: string, actual: string, expected: string): string {
    return `${installer} is ${actual}, not ${expected}: the app only runs an update installer that only root can change, so this package could never install an update.`;
  }

  public static formatDebianUpdateInstallerChecked(installer: string, expected: string): string {
    return `${installer} is ${expected}, so only root can change the update installer the app runs.`;
  }

  public static formatDebianSandboxHelperChecked(helper: string, expected: string, canCreate: boolean): string {
    return `${helper} is ${expected}, as the package's after-install script leaves it where root ${canCreate ? "can" : "cannot"} create user namespaces.`;
  }

  public static formatDebianProfileUnexpected(profile: string, isEnabled: boolean): string {
    return `${profile} is installed, though ${isEnabled ? "AppArmor here refuses the package's profile" : "AppArmor is not enabled here"}, so the after-install script should have left it out.`;
  }

  public static formatDebianProfileSkipped(profile: string, isEnabled: boolean): string {
    return `${profile} is not installed, as the after-install script leaves it out where ${isEnabled ? "AppArmor refuses the package's profile" : "AppArmor is not enabled"}.`;
  }

  public static formatDebianProfileNotCopied(profile: string, source: string): string {
    return `${profile} is missing or differs from ${source}, which the after-install script copies there where AppArmor takes the profile.`;
  }

  public static formatLoadedProfile(slug: string): string {
    return `${slug} (unconfined)`;
  }

  public static formatDebianProfileNotLoaded(slug: string, loaded: string): string {
    return `${loaded} lists no profile ${Resources.formatLoadedProfile(slug)}, which the after-install script loads.`;
  }

  public static formatDebianProfileInstalled(profile: string): string {
    return `${profile} is the package's AppArmor profile, which allows the program user namespaces, and it is loaded.`;
  }

  public static formatDebianPackageTypeChecked(file: string): string {
    return `${file} holds ${Resources.debianPackageTarget}, so the installed copy updates as a Debian package.`;
  }

  public static formatDebianPackageTypeMissing(file: string): string {
    return `${file} doesn't hold ${Resources.debianPackageTarget}, so the installed copy can't tell it came from the Debian package and would update as an AppImage.`;
  }

  public static formatDebianRemoved(packageName: string, folder: string, profile: string): string {
    return `Removing the Debian package ${packageName} left neither ${folder} nor ${profile}.`;
  }

  public static formatDebianRemovalLeft(packageName: string, left: readonly string[]): string {
    return `Removing the Debian package ${packageName} left ${left.join(" and ")}.`;
  }

  public static formatPackageFolderInvalid(directory: string): string {
    return `${directory} is neither a package folder directly under src/, named noldova and its package's segments such as src/noldova.desktop.protocol, nor a module part under ${Resources.sourceModulesFolder}/.`;
  }

  public static formatWindowExportMissing(name: string): string {
    return `${name} has no file at its ${Resources.windowExportPath} export; the build reads the window part's entry there to check the packages it imports.`;
  }

  public static formatWindowEntry(name: string): string {
    return `${name}${Resources.windowExportPath.slice(1)}`;
  }

  public static formatWindowImportUnlisted(name: string, specifier: string, imported: string): string {
    return `${name}'s window part imports ${specifier}, but ${name} doesn't list ${imported} among its dependencies, optional dependencies or peer dependencies; a window part imports by name only what its module's package lists.`;
  }

  public static formatWindowImportOtherModule(name: string, specifier: string, entry: string): string {
    return `${name}'s window part imports ${specifier}, another module's package; a window part reaches another module only through its window entry, ${entry}.`;
  }

  public static formatWalkKey(folder: string, isWindowSide: boolean): string {
    return `${isWindowSide ? Resources.windowSideKey : Resources.nodeSideKey}${folder}`;
  }

  public static formatPackageBuilt(name: string, isCurrent: boolean): string {
    return `${name}: ${isCurrent ? Resources.packageReused : Resources.packageBuilt}\n`;
  }

  public static formatTestsSubject(name: string): string {
    return `${name} tests`;
  }

  public static formatPackageTestsCompiled(name: string, isCurrent: boolean): string {
    return `${Resources.formatTestsSubject(name)}: ${isCurrent ? Resources.packageReused : Resources.packageTestsCompiled}\n`;
  }

  public static formatFixtureChecked(name: string, buildsOnAngular: boolean): string {
    return `${name}: ${buildsOnAngular ? Resources.fixtureTestBuildOnly : Resources.fixtureTypeChecked}\n`;
  }

  public static formatAngularPackagesInstalled(count: number, isCurrent: boolean): string {
    return isCurrent
      ? `Angular packages built: ${count}; the app's install already holds them, unchanged since the last build.\n`
      : `Angular packages built and installed: ${count}.\n`;
  }

  public static formatRootPackagesInstalled(count: number): string {
    return `Packages built on Angular packages and installed: ${count}.\n`;
  }

  public static formatLockedSpec(name: string, version: string): string {
    return `${name}@${version}`;
  }

  public static formatUnlockedInstall(location: string, version: string, held: string | null): string {
    return `Installing the built packages put ${location} at ${version}, `
      + (Object.isNull(held) ? "which package-lock.json doesn't hold" : `where package-lock.json holds ${held}`)
      + "; the install takes only the lockfile's versions, so lock it there with npm install and commit the lockfile.";
  }

  public static formatInstalledLockfileMissing(file: string): string {
    return `Installing the built packages left no ${file} beside package-lock.json, so the installed versions can't be checked against the lockfile; `
      + "install with an npm that writes it and build again.";
  }

  public static formatSecondCopy(name: string, location: string): string {
    return `The app's install holds a second copy of ${name}, at ${location}; the app holds one copy of each Angular, Noldova Desktop, context and kit package, at the top of its node_modules, so a package takes them only as peer dependencies.`;
  }

  public static formatNodeSideAngular(name: string, trail: readonly string[]): string {
    return `${name} reaches the Angular package ${trail.at(-1)} through ${trail.join(" -> ")}; Angular belongs to the window alone, so no package of the runtime, the main process, the command line or the build depends on it.`;
  }

  public static formatPackingOperation(name: string): string {
    return `Packing ${name}`;
  }

  public static formatInstallingOperation(subject: string): string {
    return `Installing ${subject}`;
  }

  public static formatTypeCheckOperation(directory: string): string {
    return `Type-checking ${directory}/${Resources.sourceFolder}`;
  }

  public static formatCompilingOperation(directory: string, folder: string): string {
    return `Compiling ${directory}/${folder}`;
  }

  public static formatListingInputsOperation(directory: string): string {
    return `Listing the inputs of ${directory} with its ${Resources.buildScriptSegments.join(Resources.pathSegmentSeparator)}`;
  }

  public static formatBuildScriptOperation(directory: string): string {
    return `Building ${directory} with its ${Resources.buildScriptSegments.join(Resources.pathSegmentSeparator)}`;
  }

  public static formatOperationFailed(operation: string, exitCode: number | null, text: string): string {
    return `${operation} failed with exit code ${exitCode}:\n${text}`;
  }

  public static formatProtocolVersionUndeclared(directory: string): string {
    return `${directory} uses ${Resources.protocolVersionPlaceholder}, but the root package.json declares no desktop.protocolVersion.`;
  }

  public static formatDeclarationsMissing(directory: string): string {
    return `${directory} has no ${Resources.sourceFolder}/${Resources.declarationSegments.join(Resources.pathSegmentSeparator)}.`;
  }

  public static formatArchiveCopyMissing(archive: string, entry: string, origin: string): string {
    return `${archive} lacks ${entry}, the copy of ${origin}.`;
  }

  public static formatArchiveCopyDiffers(archive: string, entry: string, origin: string): string {
    return `${archive} holds a ${entry} that differs from ${origin}.`;
  }

  public static formatCompanyPackageUnreadable(id: string, location: string): string {
    return `${id} could not be read at ${location}, where npm ci installs it after checking it against package-lock.json; the stage takes the company's packages only from there.`;
  }

  public static formatCompanyPackageUnreadableOrUnfetched(id: string, location: string, archive: string): string {
    return `${id} could not be read at ${location}, where npm ci installs it after checking it against package-lock.json, or at ${archive}, `
      + `where the install packs a company package that npm ci leaves out for another processor or system; the stage takes the company's packages only from there.`;
  }

  public static formatFetchedCompanyArchiveMismatch(archive: string, id: string): string {
    return `${archive} does not match the integrity package-lock.json locks for ${id}, so it cannot ship.`;
  }

  public static formatCompanyPackageMismatch(location: string, id: string): string {
    return `${location} does not hold ${id}, which package-lock.json locks; run npm ci, so the stage takes the locked package.`;
  }

  public static formatCompanyPackFailed(id: string, location: string, exitCode: number | null, text: string): string {
    return `Packing ${id} from ${location} failed with exit code ${exitCode}:\n${text}`;
  }

  public static formatCompanyArchiveUnreadable(id: string, archive: string): string {
    return `${id} was installed from ${archive}, which can no longer be read; build the app's packages and install the app again.`;
  }

  public static formatCompanyArchiveMismatch(archive: string, id: string): string {
    return `${archive} no longer matches the integrity npm recorded when it installed ${id}; build the app's packages and install the app again.`;
  }

  public static formatTarEntryTypeRefused(archive: string, name: string, description: string): string {
    return `${archive} holds ${name} as ${description}, `
      + "and packaging takes only files and folders, so it cannot ship.";
  }

  public static formatTarEntryOutside(archive: string, name: string, id: string): string {
    return `${archive} holds ${name}, which would be written outside ${id}'s folder, so it cannot ship.`;
  }

  public static formatTarEntryWindowsUnsafe(archive: string, name: string): string {
    return `${archive} holds ${name}, a path that Windows reads as another file or refuses, so it cannot ship.`;
  }

  public static formatTarEntryCaseClash(archive: string, other: string, prefix: string): string {
    return `${archive} holds ${other} and ${prefix}, which differ only in case or Unicode form and are one name on Windows or macOS, so they cannot ship.`;
  }

  public static formatCompanyManifestMissing(origin: string, id: string): string {
    return `${origin} holds no package.json for ${id}, so it cannot ship.`;
  }

  public static formatLicenseMissing(packageId: string): string {
    return `${packageId} names no license in its package.json; a third-party runtime package needs ${Resources.formatAllowedLicenses()}.`;
  }

  public static formatAllowedLicenses(): string {
    return `one of ${Resources.allowedLicenses.join(", ")}, or an OR expression with one of them`;
  }

  public static formatLicenseAccepted(expression: string): string {
    return `${expression}, accepted by the app`;
  }

  public static formatLicenseChosen(chosen: string, expression: string): string {
    return `${chosen}, chosen from "${expression}"`;
  }

  public static formatPackageId(name: string, version: string): string {
    return `${name}${Resources.packageVersionSeparator}${version}`;
  }

  public static formatLockedArchiveName(name: string, version: string): string {
    return `${name.split(Resources.pathSegmentSeparator).join(Resources.archiveScopeSeparator)}-${version}${Resources.packageArchiveExtension}`;
  }

  public static formatLockedPackageInvalid(location: string): string {
    return `${location} in package-lock.json has no valid package name and version.`;
  }

  public static formatLockedPackageBundled(name: string, version: string, location: string): string {
    return `${name}@${version} at ${location} in package-lock.json is bundled inside its parent's tarball; bundled dependencies are not supported, so it cannot ship.`;
  }

  public static formatLockedPackageAlias(location: string, installed: string, name: string): string {
    return `${location} in package-lock.json installs ${installed} under the alias ${name}; aliases are not supported, so it cannot ship.`;
  }

  public static formatLockedPackageUnlocked(name: string, version: string, location: string): string {
    return `${name}@${version} at ${location} is installed but not locked in package-lock.json, and only a package installed from the app's own archive may ship unlocked.`;
  }

  public static formatLockedPackageLinked(location: string, resolved: string): string {
    return `${location} in package-lock.json links to the folder ${resolved}; a linked folder cannot ship, so lock the package to its archive in the repository's own ${Resources.archivesFolder} folder.`;
  }

  public static formatLockedArchiveRefused(name: string, version: string, location: string, resolved: string): string {
    return `${name}@${version} at ${location} in package-lock.json is locked to ${resolved}; a locked file ships only as a ${Resources.packageArchiveExtension} archive of a Noldova package `
      + `directly in the ${Resources.archivesFolder} folder of the app's folder or of a folder above it.`;
  }

  public static formatLockedArchiveMisnamed(name: string, version: string, location: string, resolved: string, expected: string): string {
    return `${name}@${version} at ${location} in package-lock.json is locked to ${resolved}; its archive must be named ${expected}, the name npm pack gives ${name}@${version}.`;
  }

  public static formatLockedArchiveOutside(id: string, archive: string, repository: string): string {
    return `${id} is locked to ${archive}, which is outside the repository at ${repository}; an app ships only the archives in its own repository's ${Resources.archivesFolder} folders.`;
  }

  public static formatLockedArchiveThroughLink(id: string, archive: string, real: string): string {
    return `${id} is locked to ${archive}, which a link leads to ${real}; an app ships an archive only from its repository's own ${Resources.archivesFolder} folder, not through a link.`;
  }

  public static formatLockedArchiveNoIntegrity(name: string, version: string, location: string, resolved: string): string {
    return `${name}@${version} at ${location} in package-lock.json is locked to ${resolved} with an integrity that holds no SHA-512, so its archive cannot be verified; `
      + `write "integrity": "sha512-<the archive's SHA-512 digest in base64>" beside its "resolved", or leave the integrity out to ship the archive as it is.`;
  }

  public static formatLockedPackageUnresolved(name: string, version: string, location: string): string {
    return `${name}@${version} at ${location} in package-lock.json is not resolved to a registry tarball, so it cannot ship.`;
  }

  public static formatLockedPackageNoIntegrity(name: string, version: string, location: string): string {
    return `${name}@${version} at ${location} in package-lock.json has no SHA-512 integrity, so its tarball cannot be verified.`;
  }

  public static formatTypeOnlyPeers(peers: ReadonlyMap<string, ReadonlySet<string>>): string {
    return [...peers].map(([id, names]) => `${id}'s ${[...names].join(", ")}`).join("; ");
  }

  public static formatPackageTargetUnsupported(platform: string, architecture: string): string {
    return `Packages are made for windows, macos and linux on x64 and arm64, not for ${platform} on ${architecture}.`;
  }

  public static formatTargetId(platform: string, architecture: string): string {
    return `${platform}-${architecture}`;
  }

  public static formatTargetFileName(productName: string, version: string, platform: string, architecture: string, extension: string): string {
    return `${productName}-${version}-${platform}-${architecture}.${extension}`;
  }

  public static formatTarEntryType(type: string): string {
    return `a tar entry of type ${type}`;
  }

  public static formatTarUnclosed(source: string): string {
    return `${source} ends without the empty block that closes a tar archive, so it cannot ship.`;
  }

  public static formatTarChecksumMismatch(source: string, offset: number): string {
    return `${source} has a tar header at byte ${offset} whose checksum does not match, so it cannot ship.`;
  }

  public static formatTarEntryOverrun(source: string, offset: number): string {
    return `${source} has a tar entry at byte ${offset} that runs past the archive's end, so it cannot ship.`;
  }

  public static formatTarLongLink(source: string, offset: number): string {
    return `${source} has a GNU long link name at byte ${offset}, which packaging does not read, so it cannot ship.`;
  }

  public static formatTarPaxUnreadable(source: string, header: number): string {
    return `${source} has a pax header at byte ${header} whose records cannot be read, so it cannot ship.`;
  }

  public static formatTarFieldNotOctal(source: string, field: string): string {
    return `${source} has a tar header whose ${field} is not an octal number, so it cannot ship.`;
  }

  public static formatTarballSource(id: string, resolved: string): string {
    return `The tarball of ${id} from ${resolved}`;
  }

  public static formatTarballHoldsOther(id: string, resolved: string, name: string, version: string): string {
    return `The tarball of ${id} from ${resolved} holds ${name}@${version} instead, so it cannot ship.`;
  }

  public static formatTypeOnlyPeerLoaded(id: string, peer: string, loader: string): string {
    return `${id} loads ${peer} in ${loader}, so it would fail at runtime without it, but the app names ${peer} as a types-only peer of ${id}.`;
  }

  public static formatNamedLicenseMissing(id: string, named: string): string {
    return `${id} names its license in ${named}, which its tarball does not hold, so its license cannot ship.`;
  }

  public static formatSkippedEntry(name: string, description: string): string {
    return `${name} as ${description}`;
  }

  public static formatThirdPartyNotice(id: string, license: string, text: string): string {
    return `${id}\nLicense: ${license}\n\n${text}\n`;
  }

  public static formatPackageLoadPattern(peer: string): RegExp {
    const name = peer.replace(Resources.regexSpecialCharacters, Resources.regexEscapeReplacement);
    return new RegExp(String.raw`(?:\brequire\s*\(\s*|\bimport\s*\(\s*|\bfrom\s*|\bimport\s*)(["'${"`"}])${name}(?:/[^"'${"`"}]*)?\1`);
  }

  public static formatTarballNoManifest(id: string, resolved: string): string {
    return `The tarball of ${id} from ${resolved} has no package.json, so it cannot ship.`;
  }

  public static formatTarballManifestUnreadable(id: string): string {
    return `The package.json in the tarball of ${id} could not be read as a JSON object, so it cannot ship.`;
  }

  public static formatDownloadFailed(id: string, resolved: string, error: string): string {
    return `${id} could not be downloaded from ${resolved}: ${error}`;
  }

  public static formatDownloadSubject(id: string, resolved: string): string {
    return `${id} from ${resolved}`;
  }

  public static formatHttpStatus(status: number): string {
    return `HTTP ${status}`;
  }

  public static formatNetworkFailure(error: string, code: string): string {
    return `${error} (${code})`;
  }

  public static formatDownloadStatus(id: string, resolved: string, status: number): string {
    return `${id} could not be downloaded from ${resolved}: HTTP ${status}.`;
  }

  public static formatTarballIntegrityMismatch(id: string, resolved: string): string {
    return `The tarball of ${id} from ${resolved} does not match the SHA-512 integrity in package-lock.json, so it cannot ship.`;
  }

  public static formatWindowsPublisherInvalid(publisher: string): string {
    return `Signing Windows packages needs ${Resources.windowsPublisherVariable}, the distinguished name of the signing certificate's subject, starting with CN= and with its fields separated by ", "; ${publisher.length === 0 ? "it is not set" : "it is set to something else"}.`;
  }

  public static formatWindowsSigningInvalid(field: string, expected: string): string {
    return `${Resources.windowsSigningSection}.${field} in the root package.json must be ${expected}.`;
  }

  public static formatChecksumName(packageName: string): string {
    return `${packageName}.${Resources.checksumAlgorithm}`;
  }

  public static formatChecksumLine(sha256: string, name: string): string {
    return `${sha256}${Resources.checksumSeparator}${name}\n`;
  }

  public static formatReleaseFileMissing(file: string): string {
    return `${file} is missing; npm run package makes it.`;
  }

  public static formatReleaseFolderMissing(folder: string): string {
    return `The release's folder ${folder} does not exist.`;
  }

  public static formatChecksumMismatch(checksum: string, name: string): string {
    return `${checksum} does not match ${name}.`;
  }

  public static formatReleaseRunInvalid(runUrl: string): string {
    return `${Resources.releaseRunVariable} must be the https address of the run that built the release, not "${runUrl}".`;
  }

  public static formatReleaseSummary(name: string, version: string, targets: string, signing: string): string {
    return `${name} ${version} for ${targets}. ${signing}`;
  }

  public static formatReleaseRunCheckExcept(runUrl: string, unstarted: string): string {
    return `Each target's package passed its install check on that target's own runner in the run that built it, except ${unstarted}, whose packages that run built `
      + `but didn't install or start: ${runUrl}`;
  }

  public static formatReleaseCiOnly(ciOnly: string): string {
    return `Accepted by a CI run only: ${ciOnly}.`;
  }

  public static formatReleaseRunCheck(runUrl: string): string {
    return `Each target's package passed its install check on that target's own runner in the run that built it: ${runUrl}`;
  }

  public static formatReleaseSource(repository: string, revision: string): string {
    return `Built from ${repository} at ${revision}.`;
  }

  public static formatUnsignedTestRelease(name: string, repository: string): string {
    return `Unsigned test release of ${name}, published in ${repository}; an installed ${name} never updates from it.`;
  }

  public static formatReleaseTargetName(platform: string | undefined, architecture: string | undefined): string {
    return `${platform} ${architecture}`;
  }

  public static formatAssetDigest(sha256: string): string {
    return `${Resources.assetDigestPrefix}${sha256}`;
  }

  public static formatAssetMismatch(name: string, size: number, digest: string | null, builtSize: number, expected: string): string {
    return `${name} on GitHub has ${size} bytes and ${digest ?? "no digest"}, but the built file has ${builtSize} bytes and ${expected}. `
      + "Only a draft's file from an earlier run is ever replaced.";
  }

  public static formatGitHubReleasesContext(index: number): string {
    return `releases[${index}]`;
  }

  public static formatReleaseTagShared(count: number, tag: string): string {
    return `${count} releases use the tag ${tag}; delete all but one by hand before publishing.`;
  }

  public static formatReleaseAlreadyPublished(tag: string): string {
    return `${tag} is already published with every file as built; nothing changed.\n`;
  }

  public static formatDraftForOtherRevision(tag: string, target: string, revision: string): string {
    return `The draft release ${tag} is for ${target}, not for ${revision}; delete the draft by hand to publish ${revision}.`;
  }

  public static formatGitHubReleasePath(id: number): string {
    return `${Resources.githubReleasesPath}/${id}`;
  }

  public static formatGitHubAssetPath(id: number): string {
    return `${Resources.githubReleasesPath}/assets/${id}`;
  }

  public static formatReleaseKeptDraft(tag: string): string {
    return `GitHub kept ${tag} as a draft when it was published.`;
  }

  public static formatReleaseCheckFailed(tag: string, error: string): string {
    return `${tag} is public now, but checking it after publishing failed: ${error} Check it by hand; a published release is never replaced.`;
  }

  public static formatReleasePublished(tag: string, revision: string, count: number): string {
    return `Published ${tag} from ${revision} with ${count} files.\n`;
  }

  public static formatDraftCreating(tag: string, revision: string): string {
    return `Creating the draft release ${tag} for ${revision}.\n`;
  }

  public static formatUploadRetry(name: string, attempt: number, message: string): string {
    return `Uploading ${name} failed on attempt ${attempt} of ${Resources.releaseUploadAttempts}: ${message}\n`;
  }

  public static formatUploadFailed(name: string): string {
    return `${name} is still not uploaded after ${Resources.releaseUploadAttempts} attempts.`;
  }

  public static formatIncompleteUploadDeleting(name: string): string {
    return `Deleting the incomplete upload of ${name}.\n`;
  }

  public static formatDifferentUploadReplacing(name: string): string {
    return `Replacing ${name}, which the draft holds from an earlier run and which differs from the built file.\n`;
  }

  public static formatGitHubReleaseContext(id: number): string {
    return `release ${id}`;
  }

  public static formatTagReference(tag: string): string {
    return `${Resources.tagReferencePrefix}${tag}`;
  }

  public static formatTagAppearedElsewhere(tag: string, commit: string, revision: string): string {
    return `The tag ${tag} appeared on ${commit}, not on ${revision}, so the draft stays unpublished.`;
  }

  public static formatTagPointsElsewhere(tag: string, commit: string | null, revision: string): string {
    return `The tag ${tag} points at ${commit ?? "nothing"}, not at ${revision}.`;
  }

  public static formatReportsUnreadable(folder: string): string {
    return `The package reports in ${folder} cannot be read.`;
  }

  public static formatReportForeignTarget(target: string): string {
    return `A package report covers ${target}, which is not a target of this release.`;
  }

  public static formatReportMissing(target: string): string {
    return `No package report covers ${target}.`;
  }

  public static formatReportsDuplicated(count: number, target: string): string {
    return `${count} package reports cover ${target}.`;
  }

  public static formatReportSigningMismatch(target: string, description: string, isSigned: boolean, platform: string): string {
    return `The ${target} package was ${description}, but the release ${isSigned ? "signs" : "does not sign"} ${platform} packages.`;
  }

  public static formatReportFolderEmpty(name: string): string {
    return `${name} holds no package report.`;
  }

  public static formatReportUnreadable(name: string): string {
    return `${name}'s package report cannot be read.`;
  }

  public static formatTagContext(tag: string): string {
    return `the tag ${tag}`;
  }

  public static formatTagAnnotated(tag: string): string {
    return `The tag ${tag} is annotated; a release's tag points straight at its commit.`;
  }

  public static formatReleaseTagTaken(tag: string, repository: string): string {
    return `The tag ${tag} already exists in ${repository}, which isn't the source repository, so it can't be this release's own; this release needs a new version.`;
  }

  public static formatReleaseTagMissing(tag: string, repository: string): string {
    return `The tag ${tag} doesn't exist in ${repository}, though its release is published.`;
  }

  public static formatReleaseTagPrefixNeeded(repository: string, sourceRepository: string): string {
    return `${Resources.releaseTagPrefixVariable} must name the app, such as app-, for a release in ${repository}, which isn't its source repository ${sourceRepository}: `
      + `a v tag there can't say which app it belongs to.`;
  }

  public static formatReleaseSourceNotPublic(sourceRepository: string, buildRepository: string): string {
    return `The release runs in ${buildRepository} and reads its source ${sourceRepository} with the run's own token, which reads no other private repository, so ${sourceRepository} must be public; it is private or doesn't exist.`;
  }

  public static formatSeparateReleaseNeedsFeed(repository: string, sourceRepository: string): string {
    return `The release publishes in ${repository}, not in its source repository ${sourceRepository}, so product.json must name its updateFeed: `
      + `the latest release of ${repository} may be another app's.`;
  }

  public static formatTagMoved(tag: string, commit: string, revision: string): string {
    return `The tag ${tag} already points at ${commit}, not at ${revision}; a tag is never moved, so this release needs a new version.`;
  }

  public static formatUpdateFileMissing(version: string, updateName: string): string {
    return `The update metadata of ${version} needs its update file ${updateName} among its files.`;
  }

  public static formatUpdateMetadataFileName(platform: string, architecture: string): string {
    return `${Resources.updateMetadataPrefix}-${platform}-${architecture}.${Resources.updateMetadataExtension}`;
  }

  public static formatReleaseDateMissing(file: string): string {
    return `${file} names no release date.`;
  }

  public static formatYamlQuoted(text: string): string {
    return `'${text.replaceAll("'", "''")}'`;
  }

  public static formatReleaseRepositoryInvalid(repository: string, variable: string = Resources.releaseRepositoryVariable): string {
    return `${variable} must name a repository as owner/name, not "${repository}".`;
  }

  public static formatReleaseTagPrefixInvalid(prefix: string): string {
    return `${Resources.releaseTagPrefixVariable} must be v, or lowercase words joined by dashes and ending in a dash, such as app-, not "${prefix}".`;
  }

  public static formatReleaseRevisionInvalid(revision: string): string {
    return `${Resources.releaseRevisionVariable} must be a full commit SHA of 40 lowercase hexadecimal digits, not "${revision}".`;
  }

  public static formatReleaseVersionInvalid(source: string, text: string): string {
    return `${source} must be a plain version such as 0.0.2, not "${text}".`;
  }

  public static formatReleaseTagInvalid(source: string, tag: string, prefix: string): string {
    return `${source} must be a tag such as ${prefix}0.0.2, not "${tag}".`;
  }

  public static formatTagReferencesContext(tag: string): string {
    return `the references of the tag ${tag}`;
  }

  public static formatGitHubTagReferencesPath(tag: string): string {
    return `${Resources.githubTagReferencesPath}${tag}`;
  }

  public static formatGhField(name: string, value: string | boolean | number): string {
    return `${name}=${value}`;
  }

  public static formatGitHubRepositoryPath(repository: string, resource: string): string {
    return `repos/${repository}${resource}`;
  }

  public static formatGitHubNotJson(resource: string): string {
    return `GitHub's answer for ${resource} is not JSON.`;
  }

  public static formatJsonNotObject(context: string): string {
    return `${context} must be an object.`;
  }

  public static formatJsonNotArray(context: string): string {
    return `${context} must be an array.`;
  }

  public static formatJsonChildContext(context: string, key: string): string {
    return `${context}.${key}`;
  }

  public static formatJsonItemContext(context: string, key: string, index: number): string {
    return `${context}.${key}[${index}]`;
  }

  public static formatJsonNotText(context: string, key: string): string {
    return `${context}.${key} must be text.`;
  }

  public static formatJsonNotWholeNumber(context: string, key: string): string {
    return `${context}.${key} must be a whole number.`;
  }

  public static formatJsonNotFlag(context: string, key: string): string {
    return `${context}.${key} must be true or false.`;
  }

  public static formatProcessOutputTooLarge(command: string): string {
    return `"${command}" wrote more than ${Resources.processOutputLimit} bytes.`;
  }

  public static formatProcessTimedOut(command: string, timeout: number, output: string | null): string {
    const message = `"${command}" did not finish within ${timeout} ms.`;
    if (Object.isNull(output))
      return message;
    const lines = output.split(Resources.lineSeparator).map(t => t.replace(Resources.trailingCarriageReturn, String.empty)).filter(t => t.trim().length > 0)
      .slice(-Resources.timedOutOutputLines);
    return lines.length === 0 ? `${message} It wrote nothing before it was stopped.`
      : `${message} Its last output before it was stopped:${Resources.lineSeparator}${lines.join(Resources.lineSeparator)}`;
  }

  public static formatPackagingLimitReached(limit: number, command: string): string {
    return `Signed macOS packaging did not finish within its limit of ${limit / Resources.millisecondsPerMinute} minutes, so ${command} was stopped; a notarization that waits long in Apple's queue is the usual cause.`;
  }

  public static formatProcessNotStarted(command: string): string {
    return `"${command}" could not start.`;
  }

  public static formatProcessTreeNotEnded(command: string): string {
    return `"${command}" did not finish within its limit, and its process tree could not be ended.`;
  }

  public static formatProcessEndScript(processIds: readonly number[], starts: readonly number[]): string {
    return `$ids = @(${processIds.join(", ")}); $starts = @(${starts.join(", ")}); ` +
      `$deadline = [DateTime]::UtcNow.AddMilliseconds(${String(Resources.processExitWait)}); ` +
      "for ($i = 0; $i -lt $ids.Count; $i++) { try { $p = [System.Diagnostics.Process]::GetProcessById($ids[$i]); $null = $p.Handle; " +
      "if ([Math]::Abs(([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds() - $starts[$i]) -le 1) { $p.Kill(); " +
      "$null = $p.WaitForExit([int][Math]::Max(0, ($deadline - [DateTime]::UtcNow).TotalMilliseconds)) } } catch { } }; " +
      Resources.processListScript;
  }

  public static formatProcessExited(exitCode: number | null): string {
    return `exited with code ${exitCode}`;
  }

  public static formatProcessSignalled(signal: string): string {
    return `ended by ${signal}`;
  }

  public static formatDownloadRetry(subject: string, attempt: number): string {
    return `${subject} could not be installed (attempt ${attempt} of ${Resources.downloadAttempts}); trying again in ${Resources.downloadRetryPause / Resources.millisecondsPerSecond} seconds.\n`;
  }

  public static formatDownloadNotRetried(subject: string, failure: string): string {
    return `${subject} could not be installed; it failed with ${failure}, which isn't a network failure that trying again could fix.`;
  }

  public static formatDownloadGaveUp(subject: string, failure: string): string {
    return `${subject} could not be installed in ${Resources.downloadAttempts} attempts; the last failed with ${failure}.`;
  }

  private static indentNoticeLine(line: string): string {
    return line === String.empty ? String.empty : ` ${line}`;
  }
}
