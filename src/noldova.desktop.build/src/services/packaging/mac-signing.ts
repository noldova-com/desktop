/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { AppleSignatureCheck } from "./apple-signature-check.ts";
import type { IPackageSigning } from "../../interfaces/i-package-signing.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { FolderCreation } from "../files/folder-creation.ts";
import { Resources } from "../../resources.ts";

export class MacSigning implements IPackageSigning {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly key: string;
  private readonly keyId: string;
  private readonly issuer: string;

  public readonly builderEnvironment: NodeJS.ProcessEnv;
  public readonly windowsPublisher: string | null = null;
  public readonly updateKeys: readonly string[] = [];

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv, credentials: NodeJS.ProcessEnv, hasInstaller: boolean = false) {
    const missing = Resources.macSigningCredentials.filter(t => (credentials[t] ?? String.empty).length === 0);
    if (missing.length > 0)
      throw new BuildException(Resources.formatMacSigningCredentialsMissing(missing));
    const installerMissing = hasInstaller ? Resources.macInstallerSigningCredentials.filter(t => (credentials[t] ?? String.empty).length === 0) : [];
    if (installerMissing.length > 0)
      throw new BuildException(Resources.formatMacInstallerCredentialsMissing(installerMissing));
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
    this.key = String(credentials[Resources.appleApiKeyVariable]);
    this.keyId = String(credentials[Resources.appleApiKeyIdVariable]);
    this.issuer = String(credentials[Resources.appleApiIssuerVariable]);
    this.builderEnvironment = {
      [Resources.builderIdentityDiscoveryVariable]: Resources.builderIdentityDiscoveryValue,
      [Resources.builderCertificateVariable]: credentials[Resources.macCertificateVariable],
      [Resources.builderCertificatePasswordVariable]: credentials[Resources.macCertificatePasswordVariable],
      [Resources.builderAppleKeyVariable]: path.join(folder, Resources.macNotarizationKeyFile),
      [Resources.appleApiKeyIdVariable]: credentials[Resources.appleApiKeyIdVariable],
      [Resources.appleApiIssuerVariable]: credentials[Resources.appleApiIssuerVariable],
      ...(hasInstaller ? {
        [Resources.builderInstallerCertificateVariable]: credentials[Resources.macInstallerCertificateVariable],
        [Resources.builderInstallerCertificatePasswordVariable]: credentials[Resources.macInstallerCertificatePasswordVariable]
      } : {})
    };
  }

  public async prepareAsync(): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
    await FolderCreation.createAsync(this.folder, Resources.privateFolderMode);
    await writeFile(path.join(this.folder, Resources.macNotarizationKeyFile), this.key, { mode: Resources.privateFileMode });
  }

  public async finishAsync(packages: readonly string[]): Promise<string> {
    const lines: string[] = [];
    for (const image of packages.filter(t => path.extname(t) === Resources.diskImageExtension)) {
      const submitted = await this.runner.captureAsync(Resources.xcrunCommand, [
        ...Resources.notarytoolSubmitArguments, image, Resources.notarytoolKeyOption, path.join(this.folder, Resources.macNotarizationKeyFile),
        Resources.notarytoolKeyIdOption, this.keyId, Resources.notarytoolIssuerOption, this.issuer,
        ...Resources.notarytoolWaitArguments, Resources.macNotarizationWait, ...Resources.notarytoolOutputArguments
      ], this.folder, Resources.macNotarizationTimeout, this.environment);
      const submission = Resources.macNotarizationSubmissionPattern.exec(submitted.text)?.[1];
      if (!submitted.isSuccessful || !Resources.macNotarizationAcceptedPattern.test(submitted.text) || Object.isUndefined(submission))
        throw new BuildException(Resources.formatMacNotarizationRefused(image, submitted.text));
      const stapled = await AppleSignatureCheck.runStaplerAsync(() => this.runner.captureAsync(Resources.xcrunCommand, [...Resources.staplerStapleArguments, image], this.folder,
        Resources.macStapleTimeout, this.environment));
      if (!stapled.isSuccessful)
        throw new BuildException(Resources.formatMacStapleFailed(image, AppleSignatureCheck.isNetworkError(stapled), stapled.text));
      lines.push(Resources.formatMacNotarized(image, submission));
    }
    return lines.join(String.empty);
  }

  public verifyAsync(packages: readonly string[], product: ProductIdentity): Promise<string> {
    return new AppleSignatureCheck(this.runner, path.join(this.folder, Resources.macSigningCheckFolder), this.environment).verifyAsync(packages, product.name);
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
