/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { open } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../exceptions/build.exception.ts";
import { PackageDigest } from "../../models/release/package-digest.ts";
import { ReleaseFile } from "../../models/release/release-file.ts";
import { ResponseBody } from "../../models/response-body.ts";
import type { SourceArchive } from "../../models/packaging/source-archive.ts";
import { Resources } from "../../resources.ts";

// Downloads the archives of complete source the packages name into the release's folder, beside the release's own
// files, and refuses one whose size or SHA-256 isn't the one its package names.
export class ReleaseSources {
  private readonly folder: string;
  private readonly releaseFiles: readonly string[];

  public constructor(folder: string, releaseFiles: readonly string[]) {
    this.folder = folder;
    this.releaseFiles = releaseFiles;
  }

  public async downloadAsync(sources: readonly SourceArchive[]): Promise<readonly ReleaseFile[]> {
    const names = sources.map(t => t.fileName);
    const clash = names.find((t, i) => this.releaseFiles.includes(t) || names.indexOf(t) !== i);
    if (!Object.isUndefined(clash))
      throw new BuildException(Resources.formatSourceArchiveNameTaken(clash));
    const files: ReleaseFile[] = [];
    for (const source of sources)
      files.push(await this.downloadOneAsync(source));
    return files;
  }

  private async downloadOneAsync(source: SourceArchive): Promise<ReleaseFile> {
    const file = path.join(this.folder, source.fileName);
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(Resources.sourceArchiveDownloadLimit) });
      if (!response.ok || Object.isNull(response.body)) {
        await ResponseBody.letGoAsync(response);
        throw new BuildException(Resources.formatSourceArchiveUnavailable(source.url, response.status));
      }
      const reader = response.body.getReader();
      const handle = await open(file, Resources.writeFileFlag);
      try {
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
          await handle.writeFile(chunk.value);
      }
      finally {
        await handle.close();
      }
    }
    catch (error) {
      if (error instanceof BuildException)
        throw error;
      throw new BuildException(Resources.formatSourceArchiveDownloadFailed(source.url, error), new ExceptionOptions(error));
    }
    const digest = await PackageDigest.readAsync(file);
    if (digest.size !== source.size || digest.sha256 !== source.sha256)
      throw new BuildException(Resources.formatSourceArchiveDiffers(source.url, digest.size, digest.sha256, source.size, source.sha256));
    return new ReleaseFile(source.fileName, digest);
  }
}
