/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { PackageTarget } from "../../models/packaging/package-target.ts";
import { Resources } from "../../resources.ts";

export class ForeignAddons {
  public static async removeAsync(stage: string, target: PackageTarget): Promise<readonly string[]> {
    const removed: string[] = [];
    for (const folder of await ForeignAddons.listPackagesAsync(path.join(stage, Resources.nodeModulesFolder)))
      for (const foreign of await ForeignAddons.listForeignAsync(folder, target)) {
        await rm(foreign, { recursive: true });
        removed.push(path.relative(stage, foreign).split(path.sep).join(Resources.pathSegmentSeparator));
      }
    return removed;
  }

  public static isLeftOut(file: string, target: PackageTarget): boolean {
    const segments = file.split(Resources.pathSegmentSeparator);
    const [folder, name] = segments;
    if (!Object.isUndefined(folder) && !Object.isUndefined(name) && Resources.addonBuildFolders.includes(folder))
      return ForeignAddons.isForeignAddon(name, target, false);
    const conpty = segments[Resources.conptyFolderSegments.length + 1];
    return !Object.isUndefined(conpty) && segments.length > Resources.conptyFolderSegments.length + 2
      && Resources.conptyFolderSegments.every((t, index) => segments[index] === t) && ForeignAddons.isForeignConpty(conpty, target);
  }

  private static isForeignAddon(name: string, target: PackageTarget, hasOwn: boolean): boolean {
    return Resources.addonTargetPattern.test(name) && name !== target.addonTarget && (hasOwn || !ForeignAddons.includesTarget(name, target));
  }

  private static includesTarget(name: string, target: PackageTarget): boolean {
    const [platform = String.empty, architecture = String.empty] = target.addonTarget.split(Resources.kebabSeparator);
    const [named = String.empty, processors = String.empty] = name.split(Resources.kebabSeparator);
    return named === platform && processors.split(Resources.addonProcessorSeparator).includes(architecture);
  }

  private static isForeignConpty(name: string, target: PackageTarget): boolean {
    return Resources.conptyTargets.includes(name)
      && (target.platform !== Resources.windowsTarget || name !== `${Resources.conptyTargetPrefix}${target.architecture}`);
  }

  private static async listForeignAsync(folder: string, target: PackageTarget): Promise<readonly string[]> {
    const foreign: string[] = [];
    for (const native of Resources.addonBuildFolders.map(t => path.join(folder, t))) {
      const names = await ForeignAddons.listFoldersAsync(native);
      const hasOwn = names.includes(target.addonTarget);
      foreign.push(...names.filter(t => ForeignAddons.isForeignAddon(t, target, hasOwn)).map(t => path.join(native, t)));
    }
    const conpty = path.join(folder, ...Resources.conptyFolderSegments);
    for (const version of (await ForeignAddons.listFoldersAsync(conpty)).map(t => path.join(conpty, t)))
      foreign.push(...(await ForeignAddons.listFoldersAsync(version)).filter(t => ForeignAddons.isForeignConpty(t, target)).map(t => path.join(version, t)));
    return foreign;
  }

  private static async listPackagesAsync(folder: string): Promise<readonly string[]> {
    const found: string[] = [];
    for (const name of await ForeignAddons.listFoldersAsync(folder)) {
      const child = path.join(folder, name);
      if (name.startsWith(Resources.packageScopePrefix))
        found.push(...await ForeignAddons.listPackagesAsync(child));
      else if (existsSync(path.join(child, Resources.packageManifestFileName)))
        found.push(child, ...await ForeignAddons.listPackagesAsync(path.join(child, Resources.nodeModulesFolder)));
    }
    return found;
  }

  private static async listFoldersAsync(folder: string): Promise<readonly string[]> {
    if (!existsSync(folder))
      return [];
    return (await readdir(folder, { withFileTypes: true })).filter(t => t.isDirectory()).map(t => t.name).sort();
  }
}
