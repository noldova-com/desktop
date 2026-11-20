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
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import type { AcceptedLicenses } from "./accepted-licenses.ts";
import { LicenseExpression } from "./license-expression.ts";
import type { LockedPackage } from "./locked-package.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";
import { RetriedDownload } from "../../services/processes/retried-download.ts";
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

  public static async prepareAsync(locked: LockedPackage, folder: string, reviewedLicenses: readonly string[], accepted: AcceptedLicenses, typeOnly: TypeOnlyPeers,
    output: Writable, limit: number = Resources.thirdPartyDownloadTimeout, pause: number = Resources.downloadRetryPause, download: typeof fetch = fetch):
    Promise<ThirdPartyPackage> {
    const file = path.join(folder, locked.fileName);
    const kept = existsSync(file) ? await readFile(file) : null;
    const data = !Object.isNull(kept) && locked.matches(kept) ? kept : await ThirdPartyPackage.downloadAsync(locked, output, limit, pause, download);
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

  private static async downloadAsync(locked: LockedPackage, output: Writable, limit: number, pause: number, download: typeof fetch): Promise<Buffer> {
    let data = Buffer.alloc(0);
    await RetriedDownload.runAsync(Resources.formatDownloadSubject(locked.id, locked.resolved), output, async () => {
      const signal = AbortSignal.timeout(limit);
      const response = await ThirdPartyPackage.fetchAsync(locked, signal, download);
      if (Object.isString(response))
        return response;
      if (!response.ok && (response.status >= Resources.httpServerErrorStatus || Resources.downloadRetriedStatuses.includes(response.status))) {
        await ResponseBody.letGoAsync(response);
        return Resources.formatHttpStatus(response.status);
      }
      if (!response.ok) {
        await ResponseBody.letGoAsync(response);
        throw new BuildException(Resources.formatDownloadStatus(locked.id, locked.resolved, response.status));
      }
      try {
        data = Buffer.from(await response.arrayBuffer());
      }
      catch (error) {
        if (signal.aborted)
          throw new BuildException(Resources.formatDownloadFailed(locked.id, locked.resolved, String(error)), new ExceptionOptions(error));
        return ThirdPartyPackage.describe(error);
      }
      return null;
    }, pause);
    if (!locked.matches(data))
      throw new BuildException(Resources.formatTarballIntegrityMismatch(locked.id, locked.resolved));
    return data;
  }

  private static async fetchAsync(locked: LockedPackage, signal: AbortSignal, download: typeof fetch): Promise<Response | string> {
    try {
      return await download(locked.resolved, { signal });
    }
    catch (error) {
      if (!Object.isNull(ThirdPartyPackage.codeOf(error)))
        return ThirdPartyPackage.describe(error);
      throw new BuildException(Resources.formatDownloadFailed(locked.id, locked.resolved, ThirdPartyPackage.describe(error)), new ExceptionOptions(error));
    }
  }

  private static describe(error: unknown): string {
    const code = ThirdPartyPackage.codeOf(error);
    return Object.isNull(code) ? String(error) : Resources.formatNetworkFailure(String(error), code);
  }

  private static codeOf(error: unknown): string | null {
    return error instanceof Error && error.cause instanceof Error && "code" in error.cause ? String(error.cause.code) : null;
  }
}
