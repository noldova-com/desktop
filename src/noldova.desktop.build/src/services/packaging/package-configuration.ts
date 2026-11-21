/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { PackageAssets } from "./package-assets.ts";
import { PackageLayout } from "./package-layout.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { Resources } from "../../resources.ts";

export class PackageConfiguration {
  private static readonly SIGN_HOOK: string = fileURLToPath(new URL(`${Resources.windowsSignHookName}${path.extname(import.meta.filename)}`, import.meta.url));

  private readonly root: string;
  private readonly assets: PackageAssets;
  private readonly product: ProductIdentity;
  private readonly version: string;
  private readonly target: PackageTarget;
  private readonly stage: string;
  private readonly output: string;
  private readonly electronDistribution: string;
  private readonly electronVersion: string;
  private readonly isSigned: boolean;
  private readonly windowsPublisher: string | null;
  private readonly hasWebViews: boolean;

  public constructor(root: string, product: ProductIdentity, version: string, target: PackageTarget, stage: string, output: string, electronDistribution: string, electronVersion: string,
    isSigned: boolean, windowsPublisher: string | null, hasWebViews: boolean) {
    this.root = root;
    this.assets = new PackageAssets(root);
    this.product = product;
    this.version = version;
    this.target = target;
    this.stage = stage;
    this.output = output;
    this.electronDistribution = electronDistribution;
    this.electronVersion = electronVersion;
    this.isSigned = isSigned;
    this.windowsPublisher = windowsPublisher;
    this.hasWebViews = hasWebViews;
  }

  public static isLibrary(file: string): boolean {
    const extension = path.extname(file).toLowerCase();
    if (extension !== Resources.windowsProgramExtension)
      return extension === Resources.windowsLibraryExtension;
    const segments = path.resolve(file).split(path.sep);
    return segments.some((_, i) => Resources.packagedThirdPartySegments.every((t, j) => segments[i + j] === t));
  }

  public static hasExtension(file: string, extensions: readonly string[]): boolean {
    return extensions.includes(path.extname(file).toLowerCase());
  }

  public get fileNames(): readonly string[] {
    return this.target.listFileNames(this.product.name, this.version);
  }

  public toJson(unpackedFiles: readonly string[]): Record<string, unknown> {
    const product = this.product;
    return {
      appId: product.applicationId,
      productName: product.name,
      copyright: Resources.formatPackageCopyright(product.publisher),
      directories: { app: this.stage, output: this.output },
      electronDist: this.electronDistribution,
      electronVersion: this.electronVersion,
      asar: { smartUnpack: false },
      asarUnpack: [Resources.addonsPattern, ...unpackedFiles],
      npmRebuild: false,
      nodeGypRebuild: false,
      buildDependenciesFromSource: false,
      electronFuses: this.fuses,
      extraResources: this.listLicenses(),
      publish: null,
      ...(this.isSigned ? { forceCodeSigning: true } : {}),
      ...this.describePlatform()
    };
  }

  public async writeAsync(file: string, unpackedFiles: readonly string[] = []): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Resources.formatJsonFile(this.toJson(unpackedFiles)));
    if (this.target.platform === Resources.windowsTarget) {
      await mkdir(path.dirname(this.windowsCommand), { recursive: true });
      await writeFile(this.windowsCommand, this.describeWindowsCommand());
    }
    if (this.target.platform === Resources.macosTarget || this.target.platform === Resources.linuxTarget) {
      await mkdir(path.dirname(this.posixCommand), { recursive: true });
      await writeFile(this.posixCommand, this.describePosixCommand(), { mode: Resources.executableMode });
    }
    if (this.target.platform === Resources.linuxTarget) {
      await writeFile(this.updateInstaller, Resources.debianUpdateInstallerScript, { mode: Resources.executableMode });
      await this.writeDebianTemplatesAsync(this.product.installFolder);
    }
  }

  public static locateBuilderTemplates(): string {
    const builder = createRequire(fileURLToPath(import.meta.resolve(Resources.builderModule)));
    return path.join(path.dirname(builder.resolve(Resources.builderLibraryManifest)), ...Resources.builderLinuxTemplatesSegments);
  }

  public static placeDebianTemplate(text: string, template: string, installFolder: string | null): string {
    const linked = Resources.debianCommandTemplates.has(path.basename(template)) ? PackageConfiguration.linkDebianCommand(text, template) : text;
    if (Object.isNull(installFolder))
      return linked;
    if (!linked.includes(Resources.debianTemplateProductPath))
      throw new BuildException(Resources.formatDebianTemplateUnplaced(template, installFolder));
    const placed = `${Resources.formatDebianInstallFolder(installFolder)}${Resources.debianTemplateProductPath.slice(Resources.debianInstallPrefix.length)}`;
    return linked.replaceAll(Resources.debianTemplateProductPath, () => placed);
  }

  private static linkDebianCommand(text: string, template: string): string {
    if (!text.includes(Resources.debianTemplateProgram))
      throw new BuildException(Resources.formatDebianTemplateProgramUnlinked(template));
    return text.replaceAll(Resources.debianTemplateProgram, () => Resources.debianTemplateCommand);
  }

  private async writeDebianTemplatesAsync(installFolder: string | null): Promise<void> {
    const folder = new PackageLayout(this.root).debianTemplates;
    await mkdir(folder, { recursive: true });
    for (const [option, file] of Resources.debianTemplates) {
      const source = path.join(PackageConfiguration.locateBuilderTemplates(), file);
      const text = `${await readFile(source, Resources.textEncoding)}${this.describeDebianTemplateAddition(option)}`;
      await writeFile(path.join(folder, file), PackageConfiguration.placeDebianTemplate(text, source, installFolder));
    }
  }

  private describeDebianTemplateAddition(option: string): string {
    if (option === Resources.afterInstallTemplateOption)
      return Resources.formatDebianUpdatePolicyInstall(this.product.applicationId, this.product.name);
    return option === Resources.afterRemoveTemplateOption ? Resources.formatDebianUpdatePolicyRemove(this.product.applicationId) : String.empty;
  }

  private static spell(extension: string): string[] {
    return [...extension].reduce<string[]>((spellings, character) => [...new Set([character.toLowerCase(), character.toUpperCase()])]
      .flatMap(t => spellings.map(u => `${u}${t}`)), [String.empty]);
  }

  private get fuses(): Readonly<Record<string, boolean>> {
    const fuses = { ...Resources.packageFuses, enableCookieEncryption: this.hasWebViews };
    return this.target.platform === Resources.macosTarget && !this.isSigned ? { ...fuses, resetAdHocDarwinSignature: true } : fuses;
  }

  private get windowsCommandName(): string {
    return `${this.product.slug}${Resources.windowsCommandExtension}`;
  }

  private get posixCommand(): string {
    return path.join(new PackageLayout(this.root).command, this.product.slug);
  }

  private get updateInstaller(): string {
    return path.join(new PackageLayout(this.root).command, Resources.debianUpdateInstallerFile);
  }

  private get windowsCommand(): string {
    return path.join(new PackageLayout(this.root).command, this.windowsCommandName);
  }

  private describePlatform(): Record<string, unknown> {
    const product = this.product;
    const icons = path.join(this.root, product.icons);
    const target = this.target.formats.map(t => ({ target: t, arch: [this.target.architecture] }));
    const artifactName = this.target.formatFileName(product.name, this.version, Resources.builderExtensionMacro);
    switch (this.target.platform) {
      case Resources.windowsTarget:
        return {
          win: {
            target,
            icon: path.join(icons, Resources.windowsIconFile),
            artifactName,
            extraFiles: [{ from: this.windowsCommand, to: Resources.formatPackagedCommandPath(this.windowsCommandName) }],
            ...(this.isSigned ? {
              signtoolOptions: {
                sign: PackageConfiguration.SIGN_HOOK,
                signingHashAlgorithms: [Resources.windowsSigningHash],
                publisherName: this.windowsPublisher ?? undefined
              },
              signExts: Resources.windowsSignedExtensions.flatMap(t => PackageConfiguration.spell(t))
            } : {})
          },
          nsis: {
            oneClick: true,
            perMachine: false,
            packElevateHelper: false,
            deleteAppDataOnUninstall: false,
            shortcutName: product.name,
            uninstallDisplayName: product.name,
            artifactName,
            include: this.assets.locate(Resources.installerIncludeSegments),
            ...Object.isNull(product.installFolder) ? {} : { menuCategory: product.installFolder }
          }
        };
      case Resources.macosTarget:
        return {
          mac: {
            target,
            icon: path.join(icons, Resources.macIconFile),
            category: product.macCategory,
            artifactName,
            extraResources: [{ from: this.posixCommand, to: Resources.formatPackagedCommandPath(product.slug) }],
            ...(this.isSigned ? {
              hardenedRuntime: true,
              entitlements: this.assets.locate(Resources.entitlementsSegments),
              entitlementsInherit: this.assets.locate(Resources.entitlementsSegments),
              notarize: true
            } : {})
          },
          ...Object.isNull(product.installFolder)
            ? this.isSigned ? { dmg: { sign: true } } : {}
            : { pkg: { installLocation: Resources.formatMacInstallLocation(product.installFolder), isRelocatable: false, overwriteAction: Resources.macInstallerOverwriteAction,
              allowAnywhere: false, allowCurrentUserHome: false, allowRootDirectory: true } }
        };
      default:
        return {
          toolsets: { appimage: Resources.appImageToolset },
          extraMetadata: { homepage: product.about.website ?? Resources.formatRepositoryPage(product.releaseRepository) },
          deb: {
            maintainer: product.publisher,
            ...Object.fromEntries([...Resources.debianTemplates].map(([option, file]) => [option, path.join(new PackageLayout(this.root).debianTemplates, file)]))
          },
          linux: {
            target,
            icon: path.join(icons, Resources.linuxIconFile),
            executableName: product.slug,
            extraResources: [{ from: this.posixCommand, to: Resources.formatPackagedCommandPath(product.slug) },
              { from: this.updateInstaller, to: Resources.debianUpdateInstallerFile }],
            syncDesktopName: true,
            category: product.linuxCategory,
            artifactName,
            desktop: { entry: { Name: product.name, StartupWMClass: product.applicationId } }
          }
        };
    }
  }

  private describeWindowsCommand(): string {
    const folder = Resources.windowsCommandFolder;
    const program = path.win32.join(folder, `${this.product.name}${Resources.windowsProgramExtension}`);
    const entry = path.win32.join(folder, Resources.packagedResourcesFolder, Resources.packagedArchiveFile, ...Resources.desktopToolsEntrySegments);
    return Resources.formatWindowsCommandScript(program, entry);
  }

  private describePosixCommand(): string {
    const resources = Resources.posixResourcesVariable;
    const program = this.target.platform === Resources.macosTarget
      ? [resources, ...Resources.macProgramSegments, this.product.name].join(path.posix.sep)
      : [resources, Resources.parentFolderSegment, this.product.slug].join(path.posix.sep);
    const entry = path.posix.join(resources, Resources.packagedArchiveFile, ...Resources.desktopToolsEntrySegments);
    return Resources.formatPosixCommandScript(program, entry);
  }

  private listLicenses(): readonly Record<string, unknown>[] {
    const thirdParty = new PackageLayout(this.root).thirdPartyLicenses;
    return [
      { from: path.join(this.root, ...Resources.licenseSegments), to: Resources.formatPackagedLicensePath(Resources.licenseSegments.join(Resources.pathSegmentSeparator)) },
      ...this.assets.list(Resources.fontLicensesSegments).toReversed().filter(t => existsSync(t))
        .map(t => ({ from: t, to: Resources.packagedLicensesFolder, filter: Resources.licenseTextFilter })),
      { from: path.join(this.root, ...Resources.dictionariesSegments), to: Resources.packagedLicensesFolder, filter: Resources.licenseTextFilter },
      { from: path.join(this.stage, ...Resources.windowLicensesSegments), to: Resources.formatPackagedLicensePath(Resources.windowLicensesFile) },
      { from: thirdParty, to: Resources.formatPackagedLicensePath(path.basename(thirdParty)) }
    ];
  }
}
