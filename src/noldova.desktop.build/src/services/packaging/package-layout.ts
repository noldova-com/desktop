/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Resources } from "../../resources.ts";

export class PackageLayout {
  private readonly folder: string;
  private readonly runnerTemporary: string;

  public constructor(root: string, environment: NodeJS.ProcessEnv = {}) {
    this.folder = path.join(root, ...Resources.packageLayoutFolderSegments);
    this.runnerTemporary = environment[Resources.runnerTemporaryVariable] ?? String.empty;
  }

  public get stage(): string {
    return path.join(this.folder, Resources.packageStageFolder);
  }

  public get stagedProduct(): string {
    return path.join(this.stage, ...Resources.packageStagedProductSegments);
  }

  public get npmCache(): string {
    return path.join(this.folder, Resources.packageNpmCacheFolder);
  }

  public get electron(): string {
    return path.join(this.folder, Resources.electronPackageName);
  }

  public get toolCache(): string {
    return path.join(this.folder, Resources.packageToolCacheFolder);
  }

  public get output(): string {
    return path.join(this.folder, Resources.packageOutputFolder);
  }

  public get smoke(): string {
    return path.join(this.folder, Resources.packageSmokeFolder);
  }

  public get command(): string {
    return path.join(this.folder, Resources.packageCommandFolder);
  }

  public get debianTemplates(): string {
    return path.join(this.folder, Resources.packageDebianTemplatesFolder);
  }

  public get signing(): string {
    return this.runnerTemporary === String.empty ? path.join(this.folder, Resources.packageSigningFolder) : path.join(this.runnerTemporary, Resources.runnerSigningFolder);
  }

  public get archiveCheck(): string {
    return path.join(this.folder, Resources.packageArchiveCheckFolder);
  }

  public get configuration(): string {
    return path.join(this.folder, Resources.packageConfigurationFile);
  }

  public get report(): string {
    return path.join(this.folder, Resources.packageReportFile);
  }

  public get thirdParty(): string {
    return path.join(this.folder, Resources.packageThirdPartyFolder);
  }

  public get company(): string {
    return path.join(this.folder, Resources.packageCompanyFolder);
  }

  public get thirdPartyLicenses(): string {
    return path.join(this.folder, Resources.packageThirdPartyLicensesFile);
  }
}
