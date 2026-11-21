/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ModuleCatalog } from "../modules/module-catalog.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import { UpdateFeed } from "../packages/update-feed.ts";
import { ElectronDistribution } from "../packaging/electron-distribution.ts";
import type { IPackageSigning } from "../../interfaces/i-package-signing.ts";
import { LinuxSigning } from "../packaging/linux-signing.ts";
import { MacSigning } from "../packaging/mac-signing.ts";
import { MacUpdateArchiveCheck } from "../packaging/mac-update-archive-check.ts";
import { NativeBinaries } from "../packaging/native-binaries.ts";
import { PackageConfiguration } from "../packaging/package-configuration.ts";
import { PackageLayout } from "../packaging/package-layout.ts";
import { PackageReport } from "../../models/packaging/package-report.ts";
import { PackageStage } from "../packaging/package-stage.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { PackagedArchitecture } from "../packaging/packaged-architecture.ts";
import { PackagedUnpackedFiles } from "../packaging/packaged-unpacked-files.ts";
import type { PinnedPackage } from "../../models/packaging/pinned-package.ts";
import { SigningCredentials } from "../packaging/signing-credentials.ts";
import { ShippedFiles } from "../packaging/shipped-files.ts";
import { UnpackedFiles } from "../packaging/unpacked-files.ts";
import { WindowsSigning } from "../packaging/windows-signing.ts";
import { DeadlineRunner } from "../processes/deadline-runner.ts";
import { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class Package {
  private static readonly BUILDER: string = fileURLToPath(new URL(`${Resources.packageBuilderName}${path.extname(import.meta.filename)}`, import.meta.url));

  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly stage: PackageStage;
  private readonly runner: DeadlineRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly signingPackages: readonly PinnedPackage[];

  public constructor(root: string, platform: string, architecture: string, stage: PackageStage, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable,
    signingPackages: readonly PinnedPackage[]) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.stage = stage;
    this.runner = new DeadlineRunner(runner, new Map([[Package.BUILDER, Resources.builderModule]]));
    this.environment = environment;
    this.output = output;
    this.signingPackages = signingPackages;
  }

  public async runAsync(packageArguments: readonly string[]): Promise<number> {
    const credentials = SigningCredentials.take(this.environment);
    const layout = new PackageLayout(this.root, this.environment);
    await rm(layout.report, { force: true });
    await rm(layout.updateSignatures, { force: true });
    const feedIndex = packageArguments.indexOf(Resources.updateFeedOption);
    const updateFeed = feedIndex < 0 ? null : packageArguments[feedIndex + 1] ?? String.empty;
    const options = packageArguments.filter((_, i) => feedIndex < 0 || (i !== feedIndex && i !== feedIndex + 1));
    if (options.length > 1 || options.some(t => t !== Resources.packageSignedOption) || (!Object.isNull(updateFeed) && !UpdateFeed.isValid(updateFeed))) {
      this.output.write(Resources.packageUsage);
      return Resources.usageExitCode;
    }

    try {
      const product = await ProductIdentity.readAsync(this.root);
      const target = PackageTarget.fromProcess(this.platform, this.architecture).withInstallFolder(product.installFolder);
      const version = (await RootManifest.readAsync(this.root)).productVersion;
      const signing = options.length === 0 ? null : this.createSigning(target, layout, credentials, product, version);
      const electron = new ElectronDistribution(this.root, layout.electron);
      const configuration = new PackageConfiguration(this.root, product, version, target, this.stage.folder, layout.output, electron.folder, await electron.readVersionAsync(),
        !Object.isNull(signing), signing?.windowsPublisher ?? null, await new ModuleCatalog(this.root).hasWebViewsAsync());
      await configuration.writeAsync(layout.configuration);
      await this.stage.stageAsync(target, this.output, updateFeed, signing?.windowsPublisher ?? null, signing?.updateKeys);
      const natives = ShippedFiles.filter(await NativeBinaries.listAsync(this.stage.folder), target);
      const unpackedFiles = new Set([...natives, ...await UnpackedFiles.listAsync(this.stage.folder, target)]);
      await configuration.writeAsync(layout.configuration, PackagedUnpackedFiles.toPatterns([...unpackedFiles]));
      await rm(layout.output, { recursive: true, force: true });
      await electron.copyAsync();
      try {
        if (!Object.isNull(signing) && target.platform === Resources.macosTarget)
          this.runner.start(Resources.macPackagingLimit);
        await signing?.prepareAsync();
        await this.buildAsync(target, layout, configuration, signing, product);
      }
      finally {
        this.runner.stop();
        await signing?.disposeAsync();
      }
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(Resources.formatOutputLine(error.message));
      return Resources.failureExitCode;
    }
  }

  private createSigning(target: PackageTarget, layout: PackageLayout, credentials: NodeJS.ProcessEnv, product: ProductIdentity, version: string): IPackageSigning {
    switch (target.platform) {
      case Resources.windowsTarget:
        return new WindowsSigning(this.runner, this.root, layout.signing, layout.output, target, this.environment, credentials, this.signingPackages, product);
      case Resources.macosTarget:
        return new MacSigning(this.runner, layout.signing, this.environment, credentials, target.isFoldered);
      default:
        return new LinuxSigning(credentials, target, version, layout.updateSignatures);
    }
  }

  private async buildAsync(target: PackageTarget, layout: PackageLayout, configuration: PackageConfiguration, signing: IPackageSigning | null, product: ProductIdentity):
    Promise<void> {
    await mkdir(layout.toolCache, { recursive: true });
    await writeFile(path.join(layout.toolCache, Resources.packageManifestFileName), Resources.commonJsScope);
    const exitCode = await this.runBuilderAsync(target, [Package.BUILDER, layout.configuration, ...Object.isNull(product.installFolder) ? [] : [product.installFolder]],
      { ...this.createBuilderEnvironment(layout, target), ...signing?.builderEnvironment });
    if (exitCode !== 0)
      throw new BuildException(Resources.formatBuilderFailed(exitCode));
    const files = configuration.fileNames.map(t => path.join(layout.output, t));
    const missing = files.filter(t => !existsSync(t));
    if (missing.length > 0)
      throw new BuildException(Resources.formatBuilderMissingFiles(missing));
    this.output.write(Resources.formatPackagesMade(files));
    if (!Object.isNull(signing)) {
      this.output.write(await signing.finishAsync(files));
      this.output.write(Resources.formatSignatures(await signing.verifyAsync(files, product)));
    }
    for (const folder of (await readdir(layout.output, { withFileTypes: true })).filter(t => t.isDirectory()))
      this.output.write(Resources.formatOutputLine(await PackagedArchitecture.verifyAsync(path.join(layout.output, folder.name), target.architecture, target.platform)));
    if (target.platform === Resources.macosTarget)
      for (const archive of files.filter(t => path.extname(t) === Resources.zipExtension))
        this.output.write(Resources.formatOutputLine(await new MacUpdateArchiveCheck(this.runner, layout.archiveCheck, this.environment).verifyAsync(archive, layout.output, product.name)));
    await new PackageReport(target.id, !Object.isNull(signing), !Object.isNull(signing)).writeAsync(layout.report);
  }

  private async runBuilderAsync(target: PackageTarget, builderArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<number | null> {
    if (target.platform !== Resources.macosTarget)
      return await this.runner.runAsync(process.execPath, builderArguments, this.root, environment);
    const seen = { tail: String.empty, isDetachFailure: false };
    const exitCode = await this.runner.runAsync(process.execPath, builderArguments, this.root, environment, t => {
      const recent = `${seen.tail}${t}`;
      if (recent.includes(Resources.diskImageDetachFailure))
        seen.isDetachFailure = true;
      seen.tail = recent.slice(-Resources.diskImageDetachFailure.length);
    });
    if (exitCode === 0 || !seen.isDetachFailure)
      return exitCode;
    this.output.write(Resources.builderDetachRetry);
    return await this.runner.runAsync(process.execPath, builderArguments, this.root, environment);
  }

  private createBuilderEnvironment(layout: PackageLayout, target: PackageTarget): NodeJS.ProcessEnv {
    const isWindowsArm64 = target.platform === Resources.windowsTarget && target.architecture === Resources.architectureArm64;
    return {
      ...Object.fromEntries(Object.entries(this.environment).filter(([name]) => Resources.builderVariables.has(name.toUpperCase()))),
      [Resources.builderCacheVariable]: layout.toolCache,
      [Resources.builderIdentityDiscoveryVariable]: Resources.builderIdentityDiscoveryOff,
      ...(isWindowsArm64 ? { [Resources.builderCompressionFilterVariable]: Resources.builderX86Filter } : {})
    };
  }
}
