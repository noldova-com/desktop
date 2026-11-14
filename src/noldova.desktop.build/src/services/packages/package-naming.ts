/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackageNaming {
  public static isNoldova(specifier: string): boolean {
    return specifier.startsWith(Resources.noldovaScope) || specifier.startsWith(Resources.noldovaCompanyScope);
  }

  public static isOwn(name: string, modulesPrefix: string = Resources.modulesPrefix): boolean {
    return name === Resources.desktopLibraryPackage || name.startsWith(Resources.modulesPrefix) || name.startsWith(modulesPrefix);
  }

  public static isCore(name: string): boolean {
    return Resources.corePackageParts.some(t => name === `${Resources.modulesPrefix}${t}`);
  }

  public static isShared(name: string): boolean {
    return PackageNaming.isCore(name) || PackageNaming.isContext(name) || name === Resources.kitPackage;
  }

  public static isContext(name: string): boolean {
    return name.startsWith(Resources.contextPackagePrefix);
  }

  public static isWindow(name: string): boolean {
    return name === Resources.windowPackage;
  }

  public static isAngular(name: string): boolean {
    return name.startsWith(Resources.angularScope);
  }

  public static isWorkspaceOnly(name: string): boolean {
    return PackageNaming.isAngular(name) || name === Resources.windowPackage || name === Resources.kitPackage;
  }

  public static listOwnScopes(modulesPrefix: string): readonly string[] {
    return [...new Set([PackageNaming.scopeOf(Resources.modulesPrefix), PackageNaming.scopeOf(modulesPrefix)])];
  }

  public static nameWindowPackage(modulePackage: string): string {
    return `${modulePackage}${Resources.windowPackageSuffix}`;
  }

  public static nameSourcePackage(directory: string, modulesPrefix: string = Resources.modulesPrefix): string {
    if (directory.startsWith(`${Resources.sourceModulesFolder}${Resources.pathSegmentSeparator}`))
      return `${modulesPrefix}${PackageNaming.join(directory.slice(Resources.sourceModulesFolder.length + 1), PackageNaming.separatorOf(modulesPrefix))}`;
    const name = PackageNaming.nameFolder(directory);
    if (Object.isNull(name))
      throw new BuildException(Resources.formatPackageFolderInvalid(directory));
    return name;
  }

  public static nameFixturePackage(folder: string): string {
    return `${Resources.fixturePackagePrefix}${PackageNaming.join(folder, Resources.packageSegmentSeparator)}`;
  }

  public static nameModulePackage(id: string, part: string, isFixture: boolean, modulesPrefix: string = Resources.modulesPrefix): string {
    return `${PackageNaming.locateModulePrefix(id, isFixture, modulesPrefix)}${part}`;
  }

  public static locateModulePrefix(id: string, isFixture: boolean, modulesPrefix: string = Resources.modulesPrefix): string {
    return isFixture
      ? `${Resources.fixturePackagePrefix}${id}${Resources.packageSegmentSeparator}`
      : `${modulesPrefix}${id}${PackageNaming.separatorOf(modulesPrefix)}`;
  }

  public static locatePackageFolder(filePath: string): string | null {
    const [source, folder, ...rest] = filePath.split(Resources.pathSegmentSeparator);
    const directory = `${source}${Resources.pathSegmentSeparator}${folder}`;
    return rest.length > 0 && !Object.isNull(PackageNaming.nameFolder(directory)) ? directory : null;
  }

  private static nameFolder(directory: string): string | null {
    const [source, folder, ...rest] = directory.split(Resources.pathSegmentSeparator);
    if (source !== Resources.sourceFolder || Object.isUndefined(folder) || rest.length > 0)
      return null;
    const segments = folder.toLowerCase().split(Resources.packageSegmentSeparator).slice(1);
    if (Resources.lowerCasePackageFolderPattern.test(folder)) {
      const name = `${Resources.noldovaScope}${segments.join(Resources.packageSegmentSeparator)}`;
      return PackageNaming.isOwn(name) ? name : null;
    }
    if (!Resources.titleCasePackageFolderPattern.test(folder))
      return null;
    const name = `${Resources.noldovaCompanyScope}${segments.join(Resources.kebabSeparator)}`;
    return name === Resources.companyDesktopLibraryPackage || name.startsWith(`${Resources.companyDesktopLibraryPackage}${Resources.kebabSeparator}`) ? name : null;
  }

  private static scopeOf(modulesPrefix: string): string {
    return modulesPrefix.slice(0, modulesPrefix.indexOf(Resources.pathSegmentSeparator));
  }

  private static separatorOf(modulesPrefix: string): string {
    return modulesPrefix.endsWith(Resources.kebabSeparator) ? Resources.kebabSeparator : Resources.packageSegmentSeparator;
  }

  private static join(folder: string, separator: string): string {
    return folder.split(Resources.pathSegmentSeparator).join(separator);
  }
}
