/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { AuthenticodeCheck } from "./authenticode-check.ts";
import type { IPackageSigning } from "../../interfaces/i-package-signing.ts";
import { PackageConfiguration } from "./package-configuration.ts";
import type { PackageTarget } from "../../models/packaging/package-target.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { PinnedPackage } from "../../models/packaging/pinned-package.ts";
import { TrustedSigningModule } from "./trusted-signing-module.ts";
import { WindowsPublisher } from "../../models/packaging/windows-publisher.ts";
import { WindowsSigningAccount } from "../../models/packaging/windows-signing-account.ts";
import { Resources } from "../../resources.ts";

export class WindowsSigning implements IPackageSigning {
  private readonly runner: ProcessRunner;
  private readonly root: string;
  private readonly output: string;
  private readonly target: PackageTarget;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly module: TrustedSigningModule;
  private readonly packages: readonly PinnedPackage[];

  public readonly builderEnvironment: NodeJS.ProcessEnv;
  public readonly windowsPublisher: string;

  public constructor(runner: ProcessRunner, root: string, folder: string, output: string, target: PackageTarget, environment: NodeJS.ProcessEnv, credentials: NodeJS.ProcessEnv,
    packages: readonly PinnedPackage[], product: ProductIdentity) {
    this.runner = runner;
    this.root = root;
    this.output = output;
    this.target = target;
    this.environment = environment;
    this.module = new TrustedSigningModule(runner, folder, WindowsSigningAccount.fromProduct(product.windowsSigning), environment);
    this.packages = packages;
    this.builderEnvironment = this.module.describeEnvironment(credentials);
    this.windowsPublisher = WindowsPublisher.take(credentials);
  }

  public prepareAsync(): Promise<void> {
    return this.module.prepareAsync(this.packages);
  }

  public finishAsync(): Promise<string> {
    return Promise.resolve(String.empty);
  }

  public async verifyAsync(packages: readonly string[], product: ProductIdentity): Promise<string> {
    const folder = [Resources.windowsUnpackedFolderPrefix, ...(this.target.architecture === Resources.windowsDefaultArchitecture ? [] : [this.target.architecture]),
      Resources.windowsUnpackedFolderSuffix].join(Resources.windowsUnpackedFolderSeparator);
    const program = path.join(this.output, folder, `${product.name}${Resources.windowsProgramExtension}`);
    if (!existsSync(program))
      throw new BuildException(Resources.formatWindowsUnpackedProgramMissing(program));
    const unpacked = (await readdir(path.join(this.output, folder), { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.join(t.parentPath, t.name))
      .sort();
    const libraries = unpacked.filter(t => PackageConfiguration.isLibrary(t));
    const own = unpacked.filter(t => PackageConfiguration.hasExtension(t, [Resources.windowsProgramExtension, Resources.addonExtension]) && !PackageConfiguration.isLibrary(t));
    return new AuthenticodeCheck(this.runner, this.root, this.environment).verifyAsync([...packages, ...own], libraries, this.windowsPublisher);
  }

  public disposeAsync(): Promise<void> {
    return Promise.resolve();
  }
}
