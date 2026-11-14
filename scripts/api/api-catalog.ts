/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { AngularTestProject } from "../angular/angular-test-project.ts";
import type { BuildLayout } from "../../src/noldova.desktop.build/src/services/packages/build-layout.ts";
import type { PackageCatalog } from "../../src/noldova.desktop.build/src/services/packages/package-catalog.ts";
import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { Resources } from "../resources.ts";
import { ApiEntry } from "./api-entry.ts";
import { ApiPackage } from "./api-package.ts";
import { ApiPathAliasException } from "./api-path-alias.exception.ts";
import { ApiException } from "./api.exception.ts";

export class ApiCatalog {
  private readonly root: string;
  private readonly packages: PackageCatalog;
  private readonly layout: BuildLayout;
  private readonly angular: AngularTestProject;
  private readonly parts: readonly string[];

  public constructor(root: string, packages: PackageCatalog, layout: BuildLayout, angular: AngularTestProject, parts: readonly string[]) {
    this.root = root;
    this.packages = packages;
    this.layout = layout;
    this.angular = angular;
    this.parts = [...parts];
  }

  public async listAsync(): Promise<readonly ApiPackage[]> {
    const packages: ApiPackage[] = [];
    for (const manifest of [...await this.packages.listPackagesAsync(), ...await this.packages.listAngularPackagesAsync()])
      packages.push(...(await ApiEntry.readAsync(this.root, manifest.directory)).map(t => ApiPackage.forPackage(this.layout, manifest, t)));
    if (this.parts.length === 0)
      return packages;
    const aliases = await this.angular.readPathAliasesAsync();
    const parts: (readonly [string, ApiEntry])[] = [];
    for (const part of this.parts)
      parts.push(...(await ApiEntry.readAsync(this.root, part)).map(t => [part, t] as const));
    const paths = this.mapPaths(aliases, parts);
    return [...packages, ...parts.map(([part, entry]) => ApiPackage.forPart(this.layout, part, this.angular.projectFile, paths, entry))];
  }

  public async inspectEachAsync(output: Writable, noPackages: string, verdict: string, inspectAsync: (apiPackage: ApiPackage) => Promise<readonly string[]>): Promise<boolean> {
    const apiPackages = await this.listOrReportAsync(output);
    if (Object.isUndefined(apiPackages))
      return false;
    if (apiPackages.length === 0) {
      output.write(noPackages);
      return true;
    }
    let passed = true;
    for (const apiPackage of apiPackages) {
      const problems = await inspectAsync(apiPackage);
      output.write(problems.length === 0 ? Resources.formatApiCatalogVerdict(apiPackage.title, verdict) : Resources.formatApiCatalogProblems(apiPackage.title, problems));
      passed &&= problems.length === 0;
    }
    return passed;
  }

  private async listOrReportAsync(output: Writable): Promise<readonly ApiPackage[] | undefined> {
    try {
      return await this.listAsync();
    }
    catch (error) {
      if (!(error instanceof ApiException || error instanceof BuildException))
        throw error;
      output.write(Resources.formatApiCatalogFailure(error.message));
      return undefined;
    }
  }

  private mapPaths(aliases: ReadonlyMap<string, readonly string[]>, parts: readonly (readonly [string, ApiEntry])[]): Readonly<Record<string, readonly string[]>> {
    const targets = new Set([...aliases.values()].flat());
    const declared = new Map<string, string>();
    for (const [part, entry] of parts) {
      const implementation = ApiPackage.locatePartImplementation(this.root, part, entry);
      if (!targets.has(implementation))
        throw new ApiPathAliasException(this.angular.projectName, part, entry.name, entry.isMain ? part : Resources.formatApiEntryTitle(part, entry.subpath));
      declared.set(implementation, ApiPackage.locatePartDeclarations(this.root, part, entry));
    }
    const paths: Record<string, readonly string[]> = {};
    for (const [alias, files] of aliases)
      paths[alias] = files.map(t => declared.get(t) ?? t);
    return paths;
  }
}
