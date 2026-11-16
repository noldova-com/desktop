/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { VersionRange } from "../../src/noldova.desktop.build/src/models/modules/version-range.ts";
import { PackageNaming } from "../../src/noldova.desktop.build/src/services/packages/package-naming.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";
import { Resources } from "../resources.ts";
import { DependencyPinCheckResources } from "./dependency-pin-check.resources.ts";

export class DependencyPinCheck implements ICheck {
  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = DependencyPinCheckResources.title;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const manifests = files.filter(t => path.posix.basename(t) === Resources.manifestFile);
    const findings: string[] = [];
    const texts = new Map<string, string>();
    for (const manifest of manifests)
      texts.set(manifest, await this.readTextAsync(manifest));
    const pins = DependencyPinCheck.readPins(texts);
    for (const [manifest, text] of texts)
      findings.push(...DependencyPinCheck.validate(manifest, text, pins));
    findings.push(...await this.validateInstallPinsAsync(files, texts));
    const lockfiles = files.filter(t => path.posix.basename(t) === DependencyPinCheckResources.lockfile);
    for (const lockfile of lockfiles)
      findings.push(...await this.validateConfigurationAsync(files, path.posix.join(path.posix.dirname(lockfile), DependencyPinCheckResources.npmConfiguration)));

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(DependencyPinCheckResources.formatChecked(manifests.length, lockfiles.length));
    return findings.length === 0;
  }

  private static validate(file: string, text: string, pins: ReadonlyMap<string, string>): readonly string[] {
    let manifest: JsonObject;
    try {
      manifest = JsonReader.parse(text).toJson();
    }
    catch (error) {
      return [DependencyPinCheckResources.formatUnreadable(file, error)];
    }

    const findings: string[] = [];
    for (const section of DependencyPinCheckResources.sections) {
      const entries = manifest[section];
      if (Object.isUndefined(entries))
        continue;
      if (!DependencyPinCheck.isRecord(entries)) {
        findings.push(DependencyPinCheckResources.formatNotRecord(file, section));
        continue;
      }
      findings.push(...section === DependencyPinCheckResources.peerSection
        ? DependencyPinCheck.validatePeers(file, manifest[Resources.nameField], entries, pins)
        : DependencyPinCheck.validateEntries(file, section, entries, section === DependencyPinCheckResources.overridesSection, section));
    }
    return findings;
  }

  private static validatePeers(file: string, packageName: JsonValue | undefined, entries: JsonObject, pins: ReadonlyMap<string, string>): readonly string[] {
    const ranged = Object.entries(entries).filter((t): t is [string, string] => DependencyPinCheck.isRanged(t[0]) && Object.isString(t[1]));
    const siblings = Object.entries(entries).filter((t): t is [string, string] => Object.isString(packageName) && PackageNaming.isSiblingPeer(packageName, t[0]) && Object.isString(t[1]));
    const exact = Object.fromEntries(Object.entries(entries).filter(([name]) => !ranged.some(t => t[0] === name) && !siblings.some(t => t[0] === name)));
    return [...DependencyPinCheck.validateEntries(file, DependencyPinCheckResources.peerSection, exact, false, DependencyPinCheckResources.peerSection),
      ...siblings.filter(t => t[1] !== BuildResources.packagePeerRangePlaceholder).map(([name, value]) => DependencyPinCheckResources.formatOwnPeer(file, name, value, BuildResources.packagePeerRangePlaceholder)), ...ranged.flatMap(([name, value]) => {
      const range = VersionRange.parse(value);
      const pin = pins.get(name);
      if (Object.isNull(range) || !range.isFollowing())
        return [DependencyPinCheckResources.formatPeerForm(file, name, value, BuildResources.versionRangeForm)];
      return !Object.isUndefined(pin) && range.includes(pin) ? [] : [DependencyPinCheckResources.formatPeerPin(file, name, value, pin)];
    })];
  }

  private static isRanged(name: string): boolean {
    return (PackageNaming.isShared(name) && !PackageNaming.isCore(name)) || name === DependencyPinCheckResources.nodeTypesPackage;
  }

  private static readPins(texts: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
    const folders = [String.empty, DependencyPinCheckResources.windowAppFolder].map(t => path.posix.join(t, Resources.manifestFile));
    return new Map(folders.flatMap(t => DependencyPinCheckResources.pinSections.flatMap(u => Object.entries(DependencyPinCheck.readRecord(DependencyPinCheck.parse(texts.get(t)), u))))
      .filter((t): t is [string, string] => DependencyPinCheck.isRanged(t[0]) && Object.isString(t[1])));
  }

  private static validateEntries(file: string, location: string, entries: JsonObject, isOverride: boolean, parent: string): readonly string[] {
    const findings: string[] = [];
    for (const [name, value] of Object.entries(entries)) {
      const dependency = isOverride && name === DependencyPinCheckResources.overrideSelf ? parent : name;
      if (isOverride && DependencyPinCheck.isRecord(value))
        findings.push(...DependencyPinCheck.validateEntries(file, `${location}${Resources.space}${name}`, value, true, name));
      else if (!Object.isString(value))
        findings.push(DependencyPinCheckResources.formatNoVersion(file, location, name));
      else if (PackageNaming.isOwn(dependency)) {
        if (value !== DependencyPinCheckResources.ownVersion)
          findings.push(DependencyPinCheckResources.formatOwnVersion(file, location, name, value));
      }
      else if (!DependencyPinCheckResources.exactVersion.test(value))
        findings.push(DependencyPinCheckResources.formatNotExact(file, location, name, value));
    }
    return findings;
  }

  private static parse(text: string | undefined): JsonObject | null {
    try {
      return Object.isUndefined(text) ? null : JsonReader.parse(text).toJson();
    }
    catch {
      return null;
    }
  }

  private static readRecord(value: JsonObject | null, field: string): JsonObject {
    const entries = value?.[field];
    return DependencyPinCheck.isRecord(entries) ? entries : {};
  }

  private static readShipped(file: string, text: string): readonly (readonly [string, string, string, string, string])[] {
    const manifest = DependencyPinCheck.parse(text);
    const packageName = manifest?.[Resources.nameField];
    if (Object.isNull(manifest) || !Object.isString(packageName) || !PackageNaming.isOwn(packageName))
      return [];
    const folder = Object.keys(DependencyPinCheck.readRecord(manifest, DependencyPinCheckResources.peerSection)).includes(Resources.angularCorePackage)
      ? DependencyPinCheckResources.windowAppFolder
      : String.empty;
    const section = Object.isUndefined(manifest[DependencyPinCheckResources.binField]) ? DependencyPinCheckResources.shippedSection : DependencyPinCheckResources.toolSection;
    return Object.entries(DependencyPinCheck.readRecord(manifest, DependencyPinCheckResources.shippedSection))
      .filter((t): t is [string, string] => !PackageNaming.isOwn(t[0]) && Object.isString(t[1]))
      .map(([name, version]) => [file, name, version, folder, section] satisfies readonly [string, string, string, string, string]);
  }

  private static isRecord(value: JsonValue | undefined): value is JsonObject {
    return Object.isPlainObject(value);
  }

  private async validateInstallPinsAsync(files: readonly string[], texts: ReadonlyMap<string, string>): Promise<readonly string[]> {
    const pinFiles = [String.empty, DependencyPinCheckResources.windowAppFolder].map(t => path.posix.join(t, Resources.manifestFile));
    const shipped = [...texts].filter(([file]) => !pinFiles.includes(file)).flatMap(([file, text]) => DependencyPinCheck.readShipped(file, text));
    if (shipped.length === 0)
      return [];
    const findings: string[] = [];
    for (const folder of new Set(shipped.map(t => t[3]))) {
      const manifest = path.posix.join(folder, Resources.manifestFile);
      const lockfile = DependencyPinCheckResources.lockfile;
      const pinned = DependencyPinCheck.parse(texts.get(manifest));
      const locked = files.includes(lockfile) ? DependencyPinCheck.readRecord(DependencyPinCheck.parse(await this.readTextAsync(lockfile)), DependencyPinCheckResources.lockedPackagesField) : {};
      const isRoot = folder === String.empty;
      const pinning = isRoot ? DependencyPinCheckResources.formatRootFile(manifest) : manifest;
      const locking = DependencyPinCheckResources.formatRootFile(lockfile);
      const source = isRoot ? DependencyPinCheckResources.rootSource : DependencyPinCheckResources.formatWindowSource(folder, lockfile);
      findings.push(...shipped.filter(t => t[3] === folder).flatMap(([file, name, version, , section]) => {
        if (DependencyPinCheck.readRecord(pinned, section)[name] !== version)
          return section === DependencyPinCheckResources.shippedSection
            ? [DependencyPinCheckResources.formatUnpinnedShipped(file, name, version, pinning, source)]
            : [DependencyPinCheckResources.formatUnpinnedTool(file, name, version, pinning)];
        const entry = locked[`${DependencyPinCheckResources.lockedFolder}${name}`];
        const lockedVersion = DependencyPinCheck.isRecord(entry) ? entry[DependencyPinCheckResources.versionField] : undefined;
        return lockedVersion === version ? [] : [DependencyPinCheckResources.formatLockMismatch(file, name, version, locking, lockedVersion)];
      }));
    }
    return findings;
  }

  private async validateConfigurationAsync(files: readonly string[], file: string): Promise<readonly string[]> {
    if (!files.includes(file))
      return [DependencyPinCheckResources.formatMissingConfiguration(file)];
    const lines = (await this.readTextAsync(file)).split(Resources.lineEnd).map(t => t.trim());
    return lines.includes(DependencyPinCheckResources.saveExact) ? [] : [DependencyPinCheckResources.formatMissingSaveExact(file)];
  }

  private async readTextAsync(file: string): Promise<string> {
    return await readFile(path.join(this.root, file), Resources.encoding);
  }
}
