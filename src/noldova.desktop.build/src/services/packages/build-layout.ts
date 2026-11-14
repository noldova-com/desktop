/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { PackageManifest } from "../../models/packages/package-manifest.ts";
import { Resources } from "../../resources.ts";

export class BuildLayout {
  public readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get archivesFolder(): string {
    return path.join(this.root, Resources.archivesFolder);
  }

  public get windowAppFolder(): string | null {
    const source = path.join(this.root, Resources.sourceFolder);
    const apps = existsSync(source)
      ? readdirSync(source, { withFileTypes: true }).filter(t => t.isDirectory() && t.name.endsWith(Resources.windowAppSuffix)).map(t => t.name).sort()
      : [];
    const [app, ...others] = apps;
    if (others.length > 0)
      throw new BuildException(Resources.formatWindowAppsClash(apps));
    return Object.isUndefined(app) ? null : path.join(source, app);
  }

  public get nodeGypFolder(): string {
    return path.join(this.root, Resources.buildFolder, Resources.nodeGypFolder);
  }

  public get windowInstallRecord(): string {
    return path.join(this.root, Resources.buildFolder, Resources.recordsFolder, Resources.windowInstallRecordFile);
  }

  public locateSource(manifest: PackageManifest, ...segments: readonly string[]): string {
    return path.join(this.root, ...manifest.directory.split(Resources.pathSegmentSeparator), ...segments);
  }

  public locateOutput(manifest: PackageManifest): string {
    return path.join(this.root, Resources.buildFolder, Resources.buildPackagesFolder, manifest.id);
  }

  public locateAddonWork(manifest: PackageManifest, addon: string): string {
    return path.join(this.root, Resources.buildFolder, Resources.addonOutputFolder, manifest.id, addon);
  }

  public locateTestOutput(manifest: PackageManifest): string {
    return path.join(this.root, Resources.buildFolder, Resources.testsFolder, manifest.id);
  }

  public static nameArchive(name: string, version: string): string {
    return Resources.formatArchiveName(name.replace(Resources.archiveScopePattern, Resources.archiveScopeReplacement), version);
  }

  public locateArchive(manifest: PackageManifest, version: string): string {
    return path.join(this.archivesFolder, BuildLayout.nameArchive(manifest.name, version));
  }

  public locateInstalledPackage(name: string): string {
    return path.join(this.root, Resources.nodeModulesFolder, ...name.split(Resources.pathSegmentSeparator));
  }

  public locateRecord(manifest: PackageManifest): string {
    return path.join(this.root, Resources.buildFolder, Resources.recordsFolder, Resources.formatRecordFile(manifest.id));
  }

  public locateTestRecord(manifest: PackageManifest): string {
    return path.join(this.root, Resources.buildFolder, Resources.recordsFolder, Resources.formatTestRecordFile(manifest.id));
  }

  public locateInstalled(manifest: PackageManifest): string {
    return this.locateInstalledPackage(manifest.name);
  }
}
