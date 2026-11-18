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

export class PackageTarget {
  private readonly addonPlatform: string;

  public readonly platform: string;
  public readonly architecture: string;
  public readonly formats: readonly string[];
  public readonly extensions: readonly string[];
  public readonly updateExtension: string;

  public constructor(platform: string, architecture: string) {
    const formats = Resources.packageFormats.get(platform);
    const updateExtension = Resources.packageUpdateExtensions.get(platform);
    const addonPlatform = [...Resources.packagePlatforms].find(([, name]) => name === platform)?.[0];
    if (Object.isUndefined(formats) || Object.isUndefined(updateExtension) || Object.isUndefined(addonPlatform) || !Resources.packageArchitectures.includes(architecture))
      throw new BuildException(Resources.formatPackageTargetUnsupported(platform, architecture));

    this.platform = platform;
    this.architecture = architecture;
    this.formats = [...formats.keys()];
    this.extensions = [...formats.values()];
    this.updateExtension = updateExtension;
    this.addonPlatform = addonPlatform;
  }

  public static fromProcess(platform: string, architecture: string): PackageTarget {
    return new PackageTarget(Resources.packagePlatforms.get(platform) ?? platform, architecture);
  }

  public static readArchitecture(environment: NodeJS.ProcessEnv, processArchitecture: string): string {
    const architecture = environment[Resources.targetArchitectureVariable] ?? String.empty;
    return architecture.length > 0 ? architecture : processArchitecture;
  }

  public get id(): string {
    return Resources.formatTargetId(this.platform, this.architecture);
  }

  public get addonTarget(): string {
    return Resources.formatTargetId(this.addonPlatform, this.architecture);
  }

  public get installArguments(): readonly string[] {
    return Resources.formatInstallPlatformArguments(String(Resources.lockfilePlatforms.get(this.platform)), this.architecture,
      this.platform === Resources.linuxTarget ? Resources.lockfileLinuxLibrary : null);
  }

  public static listAll(): readonly PackageTarget[] {
    return [...Resources.packageFormats.keys()].flatMap(t => Resources.packageArchitectures.map(u => new PackageTarget(t, u)));
  }

  public formatFileName(productName: string, version: string, extension: string): string {
    return Resources.formatTargetFileName(productName, version, this.platform, this.architecture, extension);
  }

  public listFileNames(productName: string, version: string): readonly string[] {
    return this.extensions.map(t => this.formatFileName(productName, version, t));
  }
}
