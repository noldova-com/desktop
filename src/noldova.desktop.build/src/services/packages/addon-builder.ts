/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { NodeGyp } from "../toolchain/node-gyp.ts";
import type { BuildLayout } from "./build-layout.ts";
import type { PackageManifest } from "../../models/packages/package-manifest.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class AddonBuilder {
  private readonly layout: BuildLayout;
  private readonly nodeGyp: NodeGyp;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly releaseAddons: string;
  private readonly machineArchitecture: string;
  private readonly nodeFolder: string;

  public constructor(layout: BuildLayout, nodeGyp: NodeGyp, platform: string, architecture: string, releaseAddons: string = String.empty, machineArchitecture: string = process.arch,
    nodeFolder: string = path.dirname(path.dirname(process.execPath))) {
    this.layout = layout;
    this.nodeGyp = nodeGyp;
    this.platform = platform;
    this.architecture = architecture;
    this.releaseAddons = releaseAddons;
    this.machineArchitecture = machineArchitecture;
    this.nodeFolder = nodeFolder;
  }

  public static listReleaseBuilds(manifest: PackageManifest): readonly string[] {
    return [
      ...manifest.windowsAddons.flatMap(t => Resources.addonWindowsTargets.map(u => Resources.formatFolderPath(u, Resources.formatAddonFile(t)))),
      ...manifest.posixAddons.flatMap(t => Resources.addonPosixTargets.map(u => Resources.formatFolderPath(u, Resources.formatAddonFile(t))))
    ];
  }

  public async buildAsync(manifest: PackageManifest, output: string): Promise<void> {
    if (this.releaseAddons.length > 0)
      return await this.copyReleaseAddonsAsync(manifest, output);
    const addons = this.isWindows ? manifest.windowsAddons : manifest.posixAddons;
    if (addons.length > 0 && this.architecture !== this.machineArchitecture)
      throw new BuildException(Resources.formatAddonArchitectureRefused(manifest.name, this.architecture, this.machineArchitecture));
    for (const addon of addons)
      await this.buildAddonAsync(manifest, addon, output);
  }

  private get isWindows(): boolean {
    return this.platform === Resources.windowsPlatform;
  }

  private locateHeaders(): readonly string[] {
    return !this.isWindows && existsSync(path.join(this.nodeFolder, ...Resources.addonLocalHeadersSegments))
      ? [Resources.addonLocalHeadersOption, this.nodeFolder]
      : [Resources.addonHeadersDownloadOption, this.layout.nodeGypFolder];
  }

  private async buildAddonAsync(manifest: PackageManifest, addon: string, output: string): Promise<void> {
    const work = this.layout.locateAddonWork(manifest, addon);
    const source = `${addon}${Resources.addonSourceExtension}`;
    const target = addon.replaceAll(Resources.kebabSeparator, Resources.snakeSeparator);
    await rm(work, { recursive: true, force: true });
    await mkdir(work, { recursive: true });
    await copyFile(this.layout.locateSource(manifest, ...Resources.addonSourceSegments, source), path.join(work, source));
    await writeFile(path.join(work, Resources.addonProjectFile), Resources.formatJsonFile({
      targets: [{ target_name: target, sources: [source], defines: [Resources.addonNodeApiDefine] }]
    }));

    const kind = this.isWindows ? Resources.addonKindWindows : Resources.addonKindPosix;
    const result = await this.nodeGyp.runAsync([...Resources.addonRebuildArguments, ...this.locateHeaders()], work);
    if (!result.isSuccessful)
      throw new BuildException(this.isWindows && result.text.includes(Resources.addonNoToolchainText)
        ? Resources.formatAddonToolchainMissing(manifest.name, addon, this.describeToolchain())
        : Resources.formatAddonBuildFailed(manifest.name, kind, addon, result.exitCode, result.text));

    const folder = path.join(output, Resources.addonOutputFolder, Resources.formatAddonTarget(this.platform, this.architecture));
    await mkdir(folder, { recursive: true });
    await copyFile(path.join(work, ...Resources.addonBuiltSegments, Resources.formatAddonFile(target)), path.join(folder, Resources.formatAddonFile(addon)));
  }

  private async copyReleaseAddonsAsync(manifest: PackageManifest, output: string): Promise<void> {
    const builds = AddonBuilder.listReleaseBuilds(manifest);
    const missing = builds.filter(t => !existsSync(this.locateReleaseBuild(manifest, t)));
    if (missing.length > 0)
      throw new BuildException(Resources.formatLines(missing.map(t => {
        const [target = String.empty, file = String.empty] = t.split(Resources.pathSegmentSeparator);
        return Resources.formatReleaseAddonMissing(target, manifest.name, path.basename(file, Resources.addonExtension), manifest.directory, t);
      })));

    for (const build of builds) {
      const file = path.join(output, Resources.addonOutputFolder, ...build.split(Resources.pathSegmentSeparator));
      await mkdir(path.dirname(file), { recursive: true });
      await copyFile(this.locateReleaseBuild(manifest, build), file);
    }
  }

  private locateReleaseBuild(manifest: PackageManifest, build: string): string {
    return path.join(this.releaseAddons, ...manifest.directory.split(Resources.pathSegmentSeparator), ...build.split(Resources.pathSegmentSeparator));
  }

  private describeToolchain(): string {
    return this.architecture === Resources.architectureArm64 ? Resources.addonToolchainWorkloadArm64 : Resources.addonToolchainWorkload;
  }
}
