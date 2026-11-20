/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import type { AcceptedLicenses } from "./accepted-licenses.ts";
import { LicenseExpression } from "./license-expression.ts";
import type { LockedPackage } from "./locked-package.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";
import { ResponseBody } from "../response-body.ts";
import { TarArchive } from "./tar-archive.ts";
import type { TypeOnlyPeers } from "./type-only-peers.ts";

export class ThirdPartyPackage {
  public readonly locked: LockedPackage;
  public readonly file: string;
  public readonly license: LicenseExpression;
  public readonly licenseText: string;
  public readonly skipped: readonly string[];

  private constructor(locked: LockedPackage, file: string, license: LicenseExpression, licenseText: string, skipped: readonly string[]) {
    this.locked = locked;
    this.file = file;
    this.license = license;
    this.licenseText = licenseText;
    this.skipped = skipped;
  }

  public static async prepareAsync(locked: LockedPackage, folder: string, reviewedLicenses: readonly string[], accepted: AcceptedLicenses, typeOnly: TypeOnlyPeers):
    Promise<ThirdPartyPackage> {
    const file = path.join(folder, locked.fileName);
    const kept = existsSync(file) ? await readFile(file) : null;
    const data = !Object.isNull(kept) && locked.matches(kept) ? kept : await ThirdPartyPackage.downloadAsync(locked);
    await mkdir(folder, { recursive: true });
    await writeFile(file, data);

    const archive = TarArchive.fromGzip(data, Resources.formatTarballSource(locked.id, locked.resolved));
    const manifest = ThirdPartyPackage.readManifest(locked, archive);
    if (manifest[Resources.manifestNameField] !== locked.name || manifest[Resources.manifestVersionField] !== locked.version)
      throw new BuildException(Resources.formatTarballHoldsOther(locked.id, locked.resolved, String(manifest[Resources.manifestNameField]), String(manifest[Resources.manifestVersionField])));
    for (const peer of typeOnly.of(locked.id)) {
      const load = Resources.formatPackageLoadPattern(peer);
      const loader = [...archive.files].find(([name, file]) => Resources.scriptFilePattern.test(name) && load.test(file.content.toString(Resources.textEncoding)))?.[0];
      if (!Object.isUndefined(loader))
        throw new BuildException(Resources.formatTypeOnlyPeerLoaded(locked.id, peer, loader));
    }
    const license = new LicenseExpression(locked.id, manifest[Resources.licenseField], accepted.of(locked.id), accepted.listOtherVersions(locked.id));
    const named = license.isAccepted ? Resources.namedLicenseFile.exec(license.expression)?.[1] : undefined;
    if (!Object.isUndefined(named) && !archive.topLevelFiles.has(named))
      throw new BuildException(Resources.formatNamedLicenseMissing(locked.id, named));
    const texts = [...archive.topLevelFiles].filter(([name]) => Object.isUndefined(named) ? Resources.licenseFilePattern.test(name) : name === named).sort(([left], [right]) => left.localeCompare(right))
      .map(([, content]) => content.toString(Resources.textEncoding).trim());
    const licenseText = texts.length > 0 ? texts.join(Resources.paragraphSeparator) : await ThirdPartyPackage.readReviewedAsync(locked, reviewedLicenses);
    const skipped = archive.skipped.map(t => Resources.formatSkippedEntry(Resources.tarPackagePath.exec(t.name)?.[1] ?? t.name, TarArchive.describeEntry(t)));
    return new ThirdPartyPackage(locked, file, license, licenseText, skipped);
  }

  public formatNotice(): string {
    return Resources.formatThirdPartyNotice(this.locked.id, this.license.describe(), this.licenseText);
  }

  private static readManifest(locked: LockedPackage, archive: TarArchive): JsonObject {
    const text = archive.topLevelFiles.get(Resources.packageManifestFileName)?.toString(Resources.textEncoding);
    if (Object.isUndefined(text))
      throw new BuildException(Resources.formatTarballNoManifest(locked.id, locked.resolved));
    try {
      return JsonReader.parse(text).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatTarballManifestUnreadable(locked.id), new ExceptionOptions(error));
    }
  }

  private static async readReviewedAsync(locked: LockedPackage, reviewedLicenses: readonly string[]): Promise<string> {
    const files = reviewedLicenses.map(t => path.join(t, `${path.basename(locked.fileName, Resources.packageArchiveExtension)}${Resources.reviewedLicenseExtension}`));
    const file = files.find(t => existsSync(t));
    if (Object.isUndefined(file))
      throw new BuildException(Resources.formatReviewedLicenseMissing(locked.id, files));
    return (await readFile(file, Resources.textEncoding)).trim();
  }

  private static async downloadAsync(locked: LockedPackage): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(locked.resolved, { signal: AbortSignal.timeout(Resources.thirdPartyDownloadTimeout) });
    }
    catch (error) {
      throw new BuildException(Resources.formatDownloadFailed(locked.id, locked.resolved, String(error)), new ExceptionOptions(error));
    }
    if (!response.ok) {
      await ResponseBody.letGoAsync(response);
      throw new BuildException(Resources.formatDownloadStatus(locked.id, locked.resolved, response.status));
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (!locked.matches(data))
      throw new BuildException(Resources.formatTarballIntegrityMismatch(locked.id, locked.resolved));
    return data;
  }
}
