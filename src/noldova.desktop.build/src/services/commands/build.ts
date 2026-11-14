/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { AngularProject } from "../angular/angular-project.ts";
import { GalleryFile } from "../angular/gallery-file.ts";
import { ProductFile } from "../angular/product-file.ts";
import { ElectronBinary } from "../desktop/electron-binary.ts";
import { BuildVariant } from "../../models/modules/build-variant.ts";
import { ModuleArtifacts } from "../modules/module-artifacts.ts";
import { ModuleCatalog } from "../modules/module-catalog.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { PackageBuild } from "../packages/package-build.ts";
import { UpdateFeed } from "../packages/update-feed.ts";
import { Resources } from "../../resources.ts";

export class Build {
  private readonly build: PackageBuild;
  private readonly modules: ModuleCatalog;
  private readonly artifacts: ModuleArtifacts;
  private readonly product: ProductFile;
  private readonly gallery: GalleryFile;
  private readonly angular: AngularProject;
  private readonly electron: ElectronBinary;
  private readonly output: Writable;

  public constructor(build: PackageBuild, modules: ModuleCatalog, artifacts: ModuleArtifacts, product: ProductFile, gallery: GalleryFile, angular: AngularProject, electron: ElectronBinary, output: Writable) {
    this.build = build;
    this.modules = modules;
    this.artifacts = artifacts;
    this.product = product;
    this.gallery = gallery;
    this.angular = angular;
    this.electron = electron;
    this.output = output;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    const isListing = buildArguments.includes(Resources.buildListCopiesOption);
    const isTest = buildArguments[0] === Resources.buildTestOption;
    const isPackaged = buildArguments[0] === Resources.buildPackagedOption;
    const options = buildArguments.slice(isTest || isPackaged ? 1 : 0);
    const names = options.filter((_, i) => i % 2 === 0);
    const values = options.filter((_, i) => i % 2 === 1);
    const isWellFormed = options.length % 2 === 0
      && names.every(t => t === Resources.outputOption || (isTest && t === Resources.buildWithoutOption) || ((isTest || isPackaged) && t === Resources.updateFeedOption))
      && names.filter(t => t === Resources.outputOption).length < 2
      && names.filter(t => t === Resources.updateFeedOption).length < 2
      && values.every((t, i) => names[i] !== Resources.updateFeedOption || UpdateFeed.isValid(t))
      && (!names.includes(Resources.updateFeedOption) || names.includes(Resources.outputOption));
    if (isListing ? buildArguments.length > 1 : !isWellFormed || (!isTest && !isPackaged && options.length > 0)) {
      this.output.write(Resources.buildUsage);
      return Resources.usageExitCode;
    }

    try {
      if (isListing) {
        this.output.write([...(await this.build.listCopiesAsync()).map(t => Resources.formatCopyLine(t)), Resources.buildEndOfCopies].join(String.empty));
        return 0;
      }
      const feedIndex = names.indexOf(Resources.updateFeedOption);
      const variant = new BuildVariant(isTest, values.filter((_, i) => names[i] === Resources.buildWithoutOption), isPackaged, feedIndex < 0 ? null : String(values[feedIndex]));
      const outputIndex = names.indexOf(Resources.outputOption);
      const outputFolder = outputIndex < 0 ? null : path.resolve(String(values[outputIndex]));
      await this.angular.prepareAsync(this.output);
      const packages = await this.build.buildAsync(this.output, variant);
      await this.build.buildAngularAsync(this.output, variant);
      const declarations = await this.modules.listBuildAsync(variant.isTest, variant.excluded);
      await this.build.writeProductAsync(variant, outputFolder);
      this.output.write(packages.length === 0 ? Resources.buildNoPackages : Resources.formatPackagesBuilt(packages.length));
      await this.artifacts.writeAsync(declarations, outputFolder, await this.modules.readNoldovaDesktopVersionAsync());
      this.output.write(Resources.formatModulesInBuild(declarations.length));
      const ids = new Set(declarations.map(t => t.id));
      for (const declaration of declarations) {
        const absent = declaration.optionalDependencies.filter(t => !ids.has(t));
        if (absent.length > 0)
          this.output.write(Resources.formatOptionalDependenciesAbsent(declaration.id, absent));
      }
      await this.product.writeAsync();
      await this.gallery.writeAsync(variant.isPackaged);
      await this.build.installAngularAsync(this.output, declarations, variant);
      await this.electron.installAsync(this.output);
      const windowFolder = Object.isNull(outputFolder) ? null : path.join(outputFolder, Resources.windowFolder);
      await this.angular.buildAsync(this.output, windowFolder);
      if (variant.isPackaged)
        await this.angular.verifyWithoutAsync(windowFolder, Resources.galleryMarkers);
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(Resources.formatOutputLine(error.message));
      return Resources.failureExitCode;
    }
  }
}
