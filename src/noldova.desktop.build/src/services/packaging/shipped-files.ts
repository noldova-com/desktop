/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { PackageTarget } from "../../models/packaging/package-target.ts";
import { Resources } from "../../resources.ts";

export class ShippedFiles {
  public static filter(files: readonly string[], target: PackageTarget): readonly string[] {
    return files.filter(t => ShippedFiles.isShipped(t, target));
  }

  public static isShipped(file: string, target: PackageTarget): boolean {
    return Object.isNull(ShippedFiles.findOmission(file, target));
  }

  public static findOmission(file: string, target: PackageTarget): string | null {
    const segments = file.split(Resources.pathSegmentSeparator);
    const name = segments.slice(-1).join(String.empty);
    const ignored = segments.find(t => Resources.shippedIgnoredNames.has(t));
    if (!Object.isUndefined(ignored))
      return Resources.formatShippedIgnoredName(ignored);
    if (segments.some(t => t.startsWith(Resources.shippedResourceForkPrefix)))
      return Resources.shippedResourceForkOmission;
    const extension = Resources.shippedIgnoredExtensions.find(t => name.endsWith(t));
    if (!Object.isUndefined(extension))
      return Resources.formatShippedIgnoredExtension(extension);
    const top = segments.slice(0, 1).find(t => Resources.shippedTopIgnoredNames.has(t));
    if (!Object.isUndefined(top))
      return Resources.formatShippedTopIgnored(top);
    const folder = segments.lastIndexOf(Resources.nodeModulesFolder);
    if (folder < 0) {
      const configuration = segments.find(t => Resources.shippedAppIgnoredNames.has(t));
      return Object.isUndefined(configuration) ? null : Resources.formatShippedAppConfiguration(configuration);
    }
    if (target.platform !== Resources.windowsTarget && Resources.shippedWindowsExtensions.some(t => name.endsWith(t)))
      return Resources.shippedWindowsFilesOmission;
    const root = folder + ((segments[folder + 1] ?? String.empty).startsWith(Resources.packageScopePrefix) ? Resources.shippedScopedPackageOffset : Resources.shippedPackageOffset);
    const module = segments.slice(folder + 1, root).join(Resources.pathSegmentSeparator);
    let parent = String.empty;
    for (const [index, segment] of segments.entries()) {
      const omission = index < root ? null : ShippedFiles.findPackageOmission(segment, parent, module, index === root);
      if (!Object.isNull(omission))
        return omission;
      parent = segment;
    }
    return null;
  }

  private static findPackageOmission(name: string, parent: string, module: string, isTop: boolean): string | null {
    if (Resources.shippedPackageIgnoredNames.has(name))
      return Resources.formatShippedPackageIgnoredName(name);
    if (isTop && Resources.shippedPackageTopIgnoredNames.has(name))
      return Resources.formatShippedPackageTopIgnored(name);
    if (isTop && Resources.shippedPackageTopIgnoredFolders.get(module)?.has(name) === true)
      return Resources.formatShippedModuleTopIgnored(module, name);
    if (parent.endsWith(Resources.shippedBuildFolder))
      return Resources.shippedBuildIgnoredNames.has(name) || Resources.shippedBuildIgnoredExtensions.some(t => name.endsWith(t))
        ? Resources.formatShippedGypOutput(name, Resources.shippedBuildFolder)
        : null;
    if (parent.endsWith(Resources.shippedReleaseFolder))
      return Resources.shippedReleaseIgnoredNames.has(name) ? Resources.formatShippedGypOutput(name, Resources.shippedReleaseFolder) : null;
    const end = [...Resources.shippedPackageIgnoredFolders].find(([t, names]) => parent.endsWith(t) && names.has(name))?.[0];
    return Object.isUndefined(end) ? null : Resources.formatShippedPackageFolderIgnored(name, end);
  }
}
