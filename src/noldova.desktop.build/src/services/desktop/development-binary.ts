/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { cp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { Data, NtExecutable, NtExecutableResource, Resource } from "resedit";

import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { FolderCreation } from "../files/folder-creation.ts";
import { TextFile } from "../files/text-file.ts";
import { Resources } from "../../resources.ts";

export class DevelopmentBinary {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly platform: string;
  private readonly architecture: string;

  public constructor(root: string, runner: ProcessRunner, platform: string = process.platform, architecture: string = process.arch) {
    this.root = root;
    this.runner = runner;
    this.platform = platform;
    this.architecture = architecture;
  }

  public get output(): string {
    return path.join(this.root, ...Resources.developmentOutputSegments);
  }

  public get packageFolder(): string {
    return path.join(this.root, ...Resources.developmentPackageSegments);
  }

  public async prepareAsync(report: Writable): Promise<string> {
    const manifest = await RootManifest.readAsync(this.root);
    const product = await ProductIdentity.readAsync(this.root);
    const output = this.output;
    const binary = this.locateBinary(output, product);
    const icons = path.join(this.root, product.icons);
    const stamp = createHash(Resources.developmentStampHash)
      .update(await TextFile.readAsync(path.join(this.root, ...Resources.electronManifestSegments)))
      .update(JSON.stringify([manifest.productVersion, product, product.formatDevelopmentApplicationId(this.root), this.platform, this.architecture]))
      .update(await readFile(import.meta.filename))
      .update(await readFile(path.join(icons, Resources.windowsIconFile)))
      .update(await readFile(path.join(icons, Resources.macIconFile)))
      .digest(Resources.developmentStampDigest);
    const stampPath = path.join(output, Resources.developmentStampFile);
    if (!existsSync(stampPath) || await readFile(stampPath, Resources.textEncoding) !== stamp || !existsSync(binary)) {
      report.write(Resources.formatDevelopmentPreparing(product.name));
      const distribution = path.join(this.root, ...Resources.electronDistributionSegments);
      if (!existsSync(distribution))
        await this.runAsync(process.execPath, [path.join(this.root, ...Resources.electronInstallerSegments)], Resources.electronInstallTimeout);
      await rm(output, { recursive: true, force: true });
      await FolderCreation.createAsync(path.dirname(output));
      await cp(distribution, output, { recursive: true, verbatimSymlinks: true });
      if (this.platform === Resources.windowsPlatform)
        await this.relabelWindowsAsync(output, binary, product, manifest.productVersion, icons);
      else if (this.platform === Resources.macPlatform)
        await this.relabelMacAsync(output, product, icons);
      else
        await rename(path.join(output, Resources.electronLinuxExecutable), binary);
      await writeFile(stampPath, stamp, Resources.textEncoding);
    }
    await writeFile(path.join(output, Resources.electronPathFile), binary, Resources.textEncoding);
    const packageFolder = this.packageFolder;
    await FolderCreation.createAsync(packageFolder);
    await writeFile(path.join(packageFolder, Resources.packageManifestFileName), Resources.formatJsonFile({
      name: product.slug,
      productName: product.name,
      version: manifest.productVersion,
      private: true,
      main: path.relative(packageFolder, path.join(this.root, ...Resources.electronMainSegments)).split(path.sep).join(path.posix.sep)
    }), Resources.textEncoding);
    return binary;
  }

  private locateBinary(output: string, product: ProductIdentity): string {
    switch (this.platform) {
      case Resources.windowsPlatform: return path.join(output, `${product.name}${Resources.windowsProgramExtension}`);
      case Resources.macPlatform: return path.join(output, `${product.name}${Resources.appBundleExtension}`, ...Resources.macExecutableSegments, product.name);
      case Resources.linuxPlatform: return path.join(output, product.slug);
      default: throw new BuildException(Resources.developmentUnsupportedPlatform);
    }
  }

  private async relabelWindowsAsync(output: string, binary: string, product: ProductIdentity, version: string, icons: string): Promise<void> {
    const source = path.join(output, Resources.electronWindowsExecutable);
    const executable = NtExecutable.from(await readFile(source), { ignoreCert: true });
    const resource = NtExecutableResource.from(executable);
    const [info] = Resource.VersionInfo.fromEntries(resource.entries);
    const [language] = info?.getAllLanguagesForStringValues() ?? [];
    if (Object.isUndefined(info) || Object.isUndefined(language))
      throw new BuildException(Resources.developmentNoVersionInfo);
    info.setFileVersion(version, language.lang);
    info.setProductVersion(version, language.lang);
    const fileName = path.basename(binary);
    info.setStringValues(language, {
      CompanyName: product.publisher,
      FileDescription: product.name,
      ProductName: product.name,
      InternalName: fileName,
      OriginalFilename: fileName,
      LegalCopyright: Resources.formatDevelopmentCopyright(product.publisher),
      FileVersion: version,
      ProductVersion: version
    });
    info.outputToResourceEntries(resource.entries);
    const icon = Data.IconFile.from(await readFile(path.join(icons, Resources.windowsIconFile)));
    Resource.IconGroupEntry.replaceIconsForResource(resource.entries, Resources.windowsIconGroup, language.lang, icon.icons.map(t => t.data));
    resource.outputResource(executable);
    await writeFile(binary, Buffer.from(executable.generate()));
    await rm(source);
  }

  private async relabelMacAsync(output: string, product: ProductIdentity, icons: string): Promise<void> {
    const bundle = path.join(output, `${product.name}${Resources.appBundleExtension}`);
    await rename(path.join(output, Resources.electronMacBundle), bundle);
    const identifier = product.formatDevelopmentApplicationId(this.root);
    await this.relabelMacBundleAsync(bundle, Resources.electronName, product.name, identifier);
    await this.replaceMacIconAsync(output, bundle, product, icons);
    const frameworks = path.join(bundle, ...Resources.macFrameworksSegments);
    const helperIdentifier = `${identifier}${Resources.macHelperIdentifierSuffix}`;
    for (const entry of await readdir(frameworks)) {
      if (!entry.startsWith(Resources.electronMacHelperPrefix) || !entry.endsWith(Resources.appBundleExtension))
        continue;
      const oldName = entry.slice(0, -Resources.appBundleExtension.length);
      const newName = oldName.replace(Resources.electronName, product.name);
      const helper = path.join(frameworks, newName + Resources.appBundleExtension);
      await rename(path.join(frameworks, entry), helper);
      const role = oldName.slice(Resources.electronMacHelperPrefix.length).trim().replace(Resources.macHelperRolePattern, String.empty).toLowerCase();
      await this.relabelMacBundleAsync(helper, oldName, newName, role.length === 0 ? helperIdentifier : Resources.formatMacHelperIdentifier(helperIdentifier, role));
    }
    await this.runAsync(Resources.codesignCommand, [...Resources.macAdHocSignArguments, bundle]);
  }

  private async replaceMacIconAsync(output: string, bundle: string, product: ProductIdentity, icons: string): Promise<void> {
    const iconset = path.join(output, `${product.name}${Resources.macIconsetExtension}`);
    const source = path.join(icons, Resources.macIconFile);
    const iconFile = `${product.slug}${Resources.macIconExtension}`;
    await FolderCreation.createAsync(iconset);
    for (const [name, size] of Resources.macIconsetSizes)
      await this.runAsync(Resources.macResizeCommand, [Resources.macResizeSizeOption, String(size), String(size), source, Resources.macResizeOutputOption, path.join(iconset, name)]);
    const resources = path.join(bundle, ...Resources.macResourcesSegments);
    await this.runAsync(Resources.macIconsetCommand, [...Resources.macIconsetArguments, path.join(resources, iconFile), iconset]);
    await rm(iconset, { recursive: true, force: true });
    await rm(path.join(resources, Resources.electronMacIconFile), { force: true });
    await this.runAsync(Resources.macPlistCommand, [Resources.macPlistReplaceOption, Resources.macPlistIconKey, Resources.macPlistStringOption, iconFile, path.join(bundle, ...Resources.macPlistSegments)]);
  }

  private async relabelMacBundleAsync(bundle: string, oldName: string, newName: string, identifier: string): Promise<void> {
    const executables = path.join(bundle, ...Resources.macExecutableSegments);
    await rename(path.join(executables, oldName), path.join(executables, newName));
    const plist = path.join(bundle, ...Resources.macPlistSegments);
    for (const [key, value] of Object.entries({ CFBundleExecutable: newName, CFBundleName: newName, CFBundleDisplayName: newName, CFBundleIdentifier: identifier }))
      await this.runAsync(Resources.macPlistCommand, [Resources.macPlistReplaceOption, key, Resources.macPlistStringOption, value, plist]);
  }

  private async runAsync(command: string, commandArguments: readonly string[], timeout: number = Resources.developmentCommandTimeout): Promise<void> {
    const result = await this.runner.captureAsync(command, commandArguments, this.root, timeout);
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatCommandFailed(command, commandArguments, result.exitCode, result.errorOutput));
  }
}

if (import.meta.main)
  await new DevelopmentBinary(realpathSync(process.cwd()), new ProcessRunner()).prepareAsync(process.stdout);
