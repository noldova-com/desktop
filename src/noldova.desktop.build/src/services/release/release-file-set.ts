/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PackageTarget } from "../../models/packaging/package-target.ts";
import { PackageDigest } from "../../models/release/package-digest.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { ReleaseFile } from "../../models/release/release-file.ts";
import { Resources } from "../../resources.ts";
import { UpdateMetadata } from "./update-metadata.ts";

export class ReleaseFileSet {
  private readonly productName: string;
  private readonly targets: readonly PackageTarget[];

  public constructor(productName: string, targets: readonly PackageTarget[]) {
    this.productName = productName;
    this.targets = targets;
  }

  public listAll(): readonly string[] {
    return this.targets.flatMap(t => this.listTarget(t));
  }

  public async writeAsync(folder: string, target: PackageTarget, version: string, releaseDate: string): Promise<readonly string[]> {
    const packages = await this.readPackagesAsync(folder, target);
    for (const file of packages)
      await writeFile(path.join(folder, Resources.formatChecksumName(file.name)), ReleaseFileSet.formatChecksum(file));
    await writeFile(path.join(folder, UpdateMetadata.formatFileName(target)), this.describe(target, version, packages, releaseDate).format());
    return this.listTarget(target);
  }

  public async verifyAsync(folder: string, version: string): Promise<readonly ReleaseFile[]> {
    if (!existsSync(folder))
      throw new BuildException(Resources.formatReleaseFolderMissing(folder));
    const expected = this.listAll();
    const present = await readdir(folder);
    const missing = expected.filter(t => !present.includes(t));
    const unexpected = present.filter(t => !expected.includes(t));
    if (missing.length > 0 || unexpected.length > 0)
      throw new BuildException(Resources.formatReleaseFilesDiffer(folder, missing, unexpected));

    const files: ReleaseFile[] = [];
    for (const target of this.targets) {
      const packages = await this.readPackagesAsync(folder, target);
      const checksums: ReleaseFile[] = [];
      for (const file of packages) {
        const checksum = Resources.formatChecksumName(file.name);
        const bytes = await readFile(path.join(folder, checksum));
        if (bytes.toString(Resources.textEncoding) !== ReleaseFileSet.formatChecksum(file))
          throw new BuildException(Resources.formatChecksumMismatch(checksum, file.name));
        checksums.push(new ReleaseFile(checksum, PackageDigest.fromBytes(bytes)));
      }
      const metadata = UpdateMetadata.formatFileName(target);
      const bytes = await readFile(path.join(folder, metadata));
      const text = bytes.toString(Resources.textEncoding);
      if (text !== this.describe(target, version, packages, UpdateMetadata.readReleaseDate(text, metadata)).format())
        throw new BuildException(Resources.formatUpdateMetadataMismatch(metadata, version, packages.map(t => t.name)));
      files.push(...packages, ...checksums, new ReleaseFile(metadata, PackageDigest.fromBytes(bytes)));
    }
    return files;
  }

  private static formatChecksum(file: ReleaseFile): string {
    return Resources.formatChecksumLine(file.digest.sha256, file.name);
  }

  private static async readAsync(folder: string, name: string): Promise<ReleaseFile> {
    const file = path.join(folder, name);
    if (!existsSync(file))
      throw new BuildException(Resources.formatReleaseFileMissing(file));
    return new ReleaseFile(name, await PackageDigest.readAsync(file));
  }

  private listTarget(target: PackageTarget): readonly string[] {
    const packages = target.listFileNames(this.productName);
    return [...packages, ...packages.map(t => Resources.formatChecksumName(t)), UpdateMetadata.formatFileName(target)];
  }

  private async readPackagesAsync(folder: string, target: PackageTarget): Promise<readonly ReleaseFile[]> {
    const files: ReleaseFile[] = [];
    for (const name of target.listFileNames(this.productName))
      files.push(await ReleaseFileSet.readAsync(folder, name));
    return files;
  }

  private describe(target: PackageTarget, version: string, packages: readonly ReleaseFile[], releaseDate: string): UpdateMetadata {
    return new UpdateMetadata(version, target.formatFileName(this.productName, target.updateExtension), packages, releaseDate);
  }
}
