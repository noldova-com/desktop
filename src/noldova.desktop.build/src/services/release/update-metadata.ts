/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { PackageTarget } from "../../models/packaging/package-target.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { ReleaseFile } from "../../models/release/release-file.ts";
import { Resources } from "../../resources.ts";

export class UpdateMetadata {
  private readonly version: string;
  private readonly update: ReleaseFile;
  private readonly others: readonly ReleaseFile[];
  private readonly releaseDate: string;

  public constructor(version: string, updateName: string, files: readonly ReleaseFile[], releaseDate: string) {
    const update = files.find(t => t.name === updateName);
    if (Object.isUndefined(update))
      throw new BuildException(Resources.formatUpdateFileMissing(version, updateName));

    this.version = version;
    this.update = update;
    this.others = files.filter(t => t !== update);
    this.releaseDate = releaseDate;
  }

  public static formatFileName(target: PackageTarget): string {
    return Resources.formatUpdateMetadataFileName(target.platform, target.architecture);
  }

  public static readReleaseDate(text: string, file: string): string {
    const match = Resources.updateMetadataReleaseDate.exec(text);
    if (Object.isUndefined(match?.[1]))
      throw new BuildException(Resources.formatReleaseDateMissing(file));
    return match[1];
  }

  public format(): string {
    return Resources.formatUpdateMetadata(this.version,
      [this.update, ...this.others].flatMap(t => Resources.formatUpdateMetadataEntry(t.name, t.digest.sha512, t.digest.size)),
      this.update.name, this.update.digest.sha512, this.releaseDate);
  }
}
