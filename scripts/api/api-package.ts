/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { BuildLayout } from "../../src/noldova.desktop.build/src/services/packages/build-layout.ts";
import { PackageManifest } from "../../src/noldova.desktop.build/src/models/packages/package-manifest.ts";
import { Resources } from "../resources.ts";
import { ApiEntry } from "./api-entry.ts";
import { ApiVisibility } from "./api-visibility.ts";

export class ApiPackage {
  public readonly directory: string;
  public readonly title: string;
  public readonly id: string;
  public readonly project: string;
  public readonly implementation: string;
  public readonly declarations: string;
  public readonly sourceDeclarations: string;
  public readonly packedDeclarations: string | null;
  public readonly isInstalled: boolean;
  public readonly visibility: ApiVisibility;
  public readonly exampleRoot: string;
  public readonly paths: Readonly<Record<string, readonly string[]>> | undefined;

  private constructor(directory: string, entry: ApiEntry, id: string, project: string, implementation: string, declarations: string, sourceDeclarations: string,
    packedDeclarations: string | null, isInstalled: boolean, visibility: ApiVisibility, exampleRoot: string, paths?: Readonly<Record<string, readonly string[]>>) {
    this.directory = directory;
    this.title = entry.isMain ? directory : Resources.formatApiEntryTitle(directory, entry.subpath);
    this.id = entry.isMain ? id : Resources.formatApiEntryId(id, entry.name);
    this.project = project;
    this.implementation = implementation;
    this.declarations = declarations;
    this.sourceDeclarations = sourceDeclarations;
    this.packedDeclarations = packedDeclarations;
    this.isInstalled = isInstalled;
    this.visibility = visibility;
    this.exampleRoot = exampleRoot;
    this.paths = paths;
  }

  public static forPackage(layout: BuildLayout, manifest: PackageManifest, entry: ApiEntry = ApiEntry.MAIN): ApiPackage {
    const declarations = path.join(layout.locateInstalled(manifest), Resources.apiEntryFolder, `${entry.name}${Resources.declarationsExtension}`);
    return new ApiPackage(manifest.directory, entry, manifest.id, ApiPackage.locateProject(layout, manifest),
      layout.locateSource(manifest, Resources.sourceFolder, Resources.apiEntryFolder, `${entry.name}${Resources.scriptExtension}`), declarations,
      layout.locateSource(manifest, Resources.sourceFolder, Resources.apiEntryFolder, `${entry.name}${Resources.declarationsExtension}`), null,
      true, ApiVisibility.PUBLIC_AND_PROTECTED, layout.root);
  }

  public static forPart(layout: BuildLayout, directory: string, project: string, paths: Readonly<Record<string, readonly string[]>>, entry: ApiEntry = ApiEntry.MAIN): ApiPackage {
    const declarations = ApiPackage.locatePartDeclarations(layout.root, directory, entry);
    const packed = path.join(ApiPackage.locateInstalledPart(layout, directory), Resources.apiEntryFolder, `${entry.name}${Resources.declarationsExtension}`);
    return new ApiPackage(directory, entry, directory.split(Resources.pathSeparator).slice(1).join(Resources.dash), project, ApiPackage.locatePartImplementation(layout.root, directory, entry), declarations, declarations,
      packed, false, ApiVisibility.PUBLIC, path.join(path.dirname(project), ...Resources.apiPartExampleRoot), paths);
  }

  public static locatePartImplementation(root: string, directory: string, entry: ApiEntry = ApiEntry.MAIN): string {
    return path.join(ApiPackage.locatePartSource(root, directory), Resources.apiEntryFolder, `${entry.name}${Resources.scriptExtension}`);
  }

  public static locatePartDeclarations(root: string, directory: string, entry: ApiEntry = ApiEntry.MAIN): string {
    return path.join(ApiPackage.locatePartSource(root, directory), Resources.apiEntryFolder, `${entry.name}${Resources.declarationsExtension}`);
  }

  private static locateProject(layout: BuildLayout, manifest: PackageManifest): string {
    return manifest.isAngular ? layout.locateSource(manifest, Resources.typeScriptProjectFile) : layout.locateSource(manifest, Resources.sourceFolder, Resources.typeScriptProjectFile);
  }

  private static locateInstalledPart(layout: BuildLayout, directory: string): string {
    return path.join(layout.root, Resources.nodeModulesFolder, ...PackageManifest.formatName(directory).split(Resources.pathSeparator));
  }

  private static locatePartSource(root: string, directory: string): string {
    return path.join(root, ...directory.split(Resources.pathSeparator), Resources.sourceFolder);
  }
}
