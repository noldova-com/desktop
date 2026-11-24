/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import type { ProcessRunner } from "../processes/process-runner.ts";
import { PackageConfiguration } from "./package-configuration.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { PinnedPackage } from "../../models/packaging/pinned-package.ts";
import { ResponseBody } from "../../models/response-body.ts";
import { WindowsSigningAccount } from "../../models/packaging/windows-signing-account.ts";
import { FolderCreation } from "../files/folder-creation.ts";
import { Resources } from "../../resources.ts";

export class TrustedSigningModule {
  public static readonly PACKAGES: readonly PinnedPackage[] = [
    new PinnedPackage(Resources.trustedSigningModuleUrl, Resources.trustedSigningModuleSha512, Resources.trustedSigningModuleFolder),
    TrustedSigningModule.createTool(Resources.buildToolsPackageName, Resources.buildToolsPackageVersion, Resources.buildToolsPackageSha512),
    TrustedSigningModule.createTool(Resources.signingClientPackageName, Resources.signingClientPackageVersion, Resources.signingClientPackageSha512),
    TrustedSigningModule.createTool(Resources.signToolPackageName, Resources.signToolPackageVersion, Resources.signToolPackageSha512)
  ];

  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly account: WindowsSigningAccount;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, account: WindowsSigningAccount, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.account = account;
    this.environment = environment;
  }

  public static fromEnvironment(runner: ProcessRunner, environment: NodeJS.ProcessEnv): TrustedSigningModule {
    const folder = environment[Resources.trustedSigningFolderVariable] ?? String.empty;
    if (!path.isAbsolute(folder))
      throw new BuildException(Resources.formatTrustedSigningFolderInvalid(folder));
    const account = new WindowsSigningAccount(environment[Resources.trustedSigningEndpointVariable] ?? String.empty, environment[Resources.trustedSigningAccountVariable] ?? String.empty,
      environment[Resources.trustedSigningProfileVariable] ?? String.empty);
    const missing = Resources.trustedSigningAccountVariables.filter(t => (environment[t] ?? String.empty).length === 0);
    if (missing.length > 0)
      throw new BuildException(Resources.formatTrustedSigningAccountMissing(missing));
    return new TrustedSigningModule(runner, folder, account, environment);
  }

  public describeEnvironment(credentials: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const missing = Resources.windowsSigningCredentials.filter(t => (credentials[t] ?? String.empty).length === 0);
    if (missing.length > 0)
      throw new BuildException(Resources.formatWindowsSigningCredentialsMissing(missing));
    return { ...Object.fromEntries(Resources.windowsSigningCredentials.map(t => [t, credentials[t]])), [Resources.trustedSigningFolderVariable]: this.folder, ...this.accountVariables };
  }

  public async prepareAsync(sources: readonly PinnedPackage[]): Promise<void> {
    const downloads: (readonly [archive: string, destination: string, bytes: Buffer])[] = [];
    for (const source of sources) {
      const bytes = await TrustedSigningModule.downloadAsync(source.url);
      const hash = createHash(Resources.pinnedPackageHashAlgorithm).update(bytes).digest(Resources.hashDigestEncoding);
      if (hash !== source.sha512)
        throw new BuildException(Resources.formatPinnedPackageHashMismatch(source.url, hash, source.sha512));
      downloads.push([path.join(this.folder, `${path.basename(source.folder)}${Resources.zipExtension}`),
        path.join(this.folder, ...source.folder.split(Resources.pathSegmentSeparator)), bytes]);
    }
    await rm(this.folder, { recursive: true, force: true });
    await FolderCreation.createAsync(this.folder);
    try {
      for (const [archive, , bytes] of downloads)
        await writeFile(archive, bytes);
      await this.runAsync(Resources.trustedSigningExpandScript, {
        [Resources.trustedSigningArchivesVariable]: downloads.map(([archive]) => archive).join(Resources.lineSeparator),
        [Resources.trustedSigningDestinationsVariable]: downloads.map(([, destination]) => destination).join(Resources.lineSeparator)
      }, this.folder, Resources.trustedSigningExpandAction);
    }
    finally {
      await Promise.all(downloads.map(([archive]) => rm(archive, { force: true })));
    }
  }

  public async signAsync(file: string): Promise<void> {
    if (file.includes(Resources.trustedSigningFileSeparator))
      throw new BuildException(Resources.formatTrustedSigningFileListed(file));
    const script = PackageConfiguration.isLibrary(file) ? Resources.trustedSigningLibrarySignScript : Resources.trustedSigningSignScript;
    await this.runAsync(script, {
      ...this.accountVariables,
      [Resources.trustedSigningFileVariable]: path.resolve(file),
      [Resources.localAppDataVariable]: path.join(this.folder, Resources.trustedSigningToolsFolder)
    }, path.dirname(path.resolve(file)), Resources.formatTrustedSigningSignAction(file));
  }

  private get accountVariables(): NodeJS.ProcessEnv {
    return {
      [Resources.trustedSigningEndpointVariable]: this.account.endpoint,
      [Resources.trustedSigningAccountVariable]: this.account.account,
      [Resources.trustedSigningProfileVariable]: this.account.profile
    };
  }

  private static createTool(name: string, version: string, sha512: string): PinnedPackage {
    const id = name.toLowerCase();
    const release = version.toLowerCase();
    return new PinnedPackage(Resources.formatNugetPackageUrl(id, release), sha512, Resources.formatTrustedSigningToolFolder(name, version));
  }

  private static async downloadAsync(url: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(Resources.trustedSigningDownloadTimeout) });
    }
    catch (error) {
      throw new BuildException(Resources.formatSigningPackageDownloadFailed(url, error), new ExceptionOptions(error));
    }
    if (!response.ok) {
      await ResponseBody.letGoAsync(response);
      throw new BuildException(Resources.formatSigningPackageHttpFailed(url, response.status));
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async runAsync(script: string, variables: NodeJS.ProcessEnv, directory: string, action: string): Promise<void> {
    const command = Buffer.from(script, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding);
    const names = new Set(Object.keys(variables).map(t => t.toUpperCase()));
    const inherited = Object.fromEntries(Object.entries(this.environment).filter(([name]) => !names.has(name.toUpperCase())));
    const result = await this.runner.captureAsync(Resources.powershellCommand, [...Resources.powershellOptions, command], directory, Resources.trustedSigningTimeout,
      { ...inherited, [Resources.trustedSigningFolderVariable]: this.folder, ...variables });
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatTrustedSigningRunFailed(action, result.exitCode, result.text));
  }
}
