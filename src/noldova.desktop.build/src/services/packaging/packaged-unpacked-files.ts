/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { AsarArchive } from "./asar-archive.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackagedUnpackedFiles {
  public static toPatterns(files: readonly string[]): readonly string[] {
    return [...new Set(files.map(t => {
      const start = `${Resources.pathSegmentSeparator}${t}`.lastIndexOf(`${Resources.pathSegmentSeparator}${Resources.unpackedPackagesFolder}`);
      return start < 0 ? t : `${Resources.unpackedPackagePrefix}${t.slice(start + Resources.unpackedPackagesFolder.length)}`;
    }))].sort();
  }

  public static async verifyAsync(resources: string, configuration: string): Promise<string> {
    const listed = PackagedUnpackedFiles.readList(await readFile(configuration, Resources.textEncoding), configuration);
    const archive = path.join(resources, Resources.packagedArchiveFile);
    const unpacked = path.join(resources, Resources.packagedUnpackedFolder);
    const patterns = listed.filter(t => t.startsWith(Resources.unpackedPackagePrefix));
    const entries = patterns.length === 0 ? [] : await AsarArchive.listFilesAsync(archive);
    const found = patterns.flatMap(t => {
      const matched = entries.filter(u => path.posix.matchesGlob(u, t));
      if (matched.length === 0)
        throw new BuildException(Resources.formatUnpackedPatternUnmatched(archive, t));
      return matched;
    });
    const files = [...new Set([...listed.filter(t => !Resources.unpackedPatternCharacters.test(t)), ...found])].sort();
    for (const file of files) {
      const segments = file.split(Resources.pathSegmentSeparator);
      const marked = await AsarArchive.isUnpackedAsync(archive, segments);
      if (Object.isNull(marked))
        throw new BuildException(Resources.formatUnpackedEntryMissing(archive, file));
      if (!marked)
        throw new BuildException(Resources.formatUnpackedEntryPacked(archive, file));
      await readFile(path.join(unpacked, ...segments)).catch((error: unknown) => {
        throw new BuildException(Resources.formatUnpackedFileUnreadable(file, unpacked), new ExceptionOptions(error));
      });
    }
    return files.length === 0
      ? Resources.unpackedNoneVerified
      : Resources.formatUnpackedVerified(files);
  }

  private static readList(text: string, configuration: string): readonly string[] {
    try {
      return JsonReader.parse(text).readStringArray(Resources.builderUnpackField);
    }
    catch (error) {
      throw new BuildException(Resources.formatUnpackedListMissing(configuration), new ExceptionOptions(error));
    }
  }
}
