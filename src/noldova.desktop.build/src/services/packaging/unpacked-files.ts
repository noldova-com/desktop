/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { ForeignAddons } from "./foreign-addons.ts";
import { ShippedFiles } from "./shipped-files.ts";
import { FileErrors } from "../files/file-errors.ts";
import { Resources } from "../../resources.ts";

export class UnpackedFiles {
  public static async listAsync(stage: string, target: PackageTarget): Promise<readonly string[]> {
    const folders = (await readdir(stage, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile() && t.name === Resources.packageManifestFileName)
      .map(t => path.relative(stage, t.parentPath).split(path.sep).join(Resources.pathSegmentSeparator))
      .filter(t => Resources.installedPackageFolderPattern.test(t))
      .sort();
    const files: string[] = [];
    for (const folder of folders)
      files.push(...await UnpackedFiles.readPackageAsync(stage, folder, target));
    return files;
  }

  private static async readPackageAsync(stage: string, folder: string, target: PackageTarget): Promise<readonly string[]> {
    const manifest = UnpackedFiles.parse(await readFile(path.join(stage, folder, Resources.packageManifestFileName), Resources.textEncoding));
    if (Object.isNull(manifest) || !manifest.hasField(Resources.noldovaDesktopField))
      return [];
    const named = manifest.toJson()[Resources.manifestNameField];
    const name = Object.isString(named) ? named : folder;
    let files: readonly string[];
    try {
      files = manifest.readObject(Resources.noldovaDesktopField).readStringArray(Resources.desktopUnpackedField);
    }
    catch (error) {
      throw new BuildException(Resources.formatUnpackedFieldInvalid(name), new ExceptionOptions(error));
    }
    const unpacked: string[] = [];
    const real = new Set<string>();
    for (const file of files.filter(t => !ForeignAddons.isLeftOut(t, target))) {
      const checked = await UnpackedFiles.checkAsync(stage, folder, name, file);
      if (real.has(checked))
        throw UnpackedFiles.refuse(name, file, Resources.unpackedNamedTwice);
      real.add(checked);
      const packaged = `${folder}${Resources.pathSegmentSeparator}${file}`;
      const omissions = PackageTarget.listAll().map(t => ShippedFiles.findOmission(packaged, t));
      if (omissions.every(t => !Object.isNull(t)))
        throw UnpackedFiles.refuse(name, file, Resources.formatUnpackedNeverShipped(omissions[0]));
      if (ShippedFiles.isShipped(packaged, target))
        unpacked.push(packaged);
    }
    return unpacked;
  }

  private static parse(text: string): JsonReader | null {
    try {
      return JsonReader.parse(text);
    }
    catch {
      return null;
    }
  }

  private static async checkAsync(stage: string, folder: string, name: string, file: string): Promise<string> {
    const segments = file.split(Resources.pathSegmentSeparator);
    if (Resources.unpackedPatternCharacters.test(file))
      throw UnpackedFiles.refuse(name, file, Resources.unpackedWildcardPath);
    if (Resources.absolutePathPattern.test(file))
      throw UnpackedFiles.refuse(name, file, Resources.unpackedAbsolutePath);
    if (segments.some(t => Resources.unpackedRelativeSegments.includes(t)))
      throw UnpackedFiles.refuse(name, file, Resources.unpackedRelativePath);
    if (segments.includes(Resources.nodeModulesFolder))
      throw UnpackedFiles.refuse(name, file, Resources.unpackedPackagesPath);
    const root = path.join(stage, folder);
    let target = root;
    for (const segment of segments) {
      const names = await readdir(target).catch((error: unknown): string[] => UnpackedFiles.whenMissing(error, []));
      if (!names.includes(segment)) {
        const other = names.find(t => t.toLowerCase() === segment.toLowerCase());
        throw UnpackedFiles.refuse(name, file, Object.isUndefined(other) ? Resources.unpackedNoFile : Resources.formatUnpackedWrongCase(other, segment));
      }
      target = path.join(target, segment);
    }
    const real = await realpath(target).catch((error: unknown) => UnpackedFiles.whenMissing(error, null));
    if (Object.isNull(real))
      throw UnpackedFiles.refuse(name, file, Resources.unpackedNoFile);
    const relative = path.relative(await realpath(root), real);
    const inside = relative.split(path.sep);
    if (path.isAbsolute(relative) || inside[0] === Resources.parentFolderSegment || inside.includes(Resources.nodeModulesFolder))
      throw UnpackedFiles.refuse(name, file, Resources.unpackedLinkOutside);
    if (!(await stat(real)).isFile())
      throw UnpackedFiles.refuse(name, file, Resources.unpackedNoFile);
    return real;
  }

  private static refuse(name: string, file: string, reason: string): BuildException {
    return new BuildException(Resources.formatUnpackedRefused(name, file, reason));
  }

  private static whenMissing<T>(error: unknown, value: T): T {
    if (!FileErrors.isMissing(error))
      throw error;
    return value;
  }
}
