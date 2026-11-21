/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { BuildPart } from "../../src/models/build-part.js";
import type { BuildVariant } from "../../src/models/modules/build-variant.js";
import type { ModuleDeclaration } from "../../src/models/modules/module-declaration.js";
import { PackageCopy } from "../../src/models/packages/package-copy.js";
import { PackageManifest } from "../../src/models/packages/package-manifest.js";
import { AngularProject } from "../../src/services/angular/angular-project.js";
import { GalleryFile } from "../../src/services/angular/gallery-file.js";
import { ProductFile } from "../../src/services/angular/product-file.js";
import { Build } from "../../src/services/commands/build.js";
import { Install } from "../../src/services/commands/install.js";
import { ElectronBinary } from "../../src/services/desktop/electron-binary.js";
import { ModuleArtifacts } from "../../src/services/modules/module-artifacts.js";
import { ModuleCatalog } from "../../src/services/modules/module-catalog.js";
import { PackageBuild } from "../../src/services/packages/package-build.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";
import { NpmCommand } from "../../src/services/toolchain/npm-command.js";

export class BuildStepsFixture {
  private readonly failAt: string | null;
  private readonly failure: Error;

  public readonly steps: string[] = [];

  public constructor(failAt: string | null = null, failure: Error = new Error("failed")) {
    this.failAt = failAt;
    this.failure = failure;
  }

  public create(root: string, declarations: readonly ModuleDeclaration[], packages: readonly PackageManifest[], output: Writable): Build {
    const runner = new ProcessRunner();
    const record = (step: string): Promise<void> => this.recordAsync(step);
    return new Build(new StepPackageBuild(root, runner, record, packages), new StepModuleCatalog(root, record, declarations), new StepModuleArtifacts(root, record),
      new StepProductFile(root, record), new StepGalleryFile(root, record), new StepAngularProject(root, runner, record), new StepElectronBinary(root, runner, record), output);
  }

  public createInstall(root: string, output: Writable): Install {
    return new Install(new StepAngularProject(root, new ProcessRunner(), step => this.recordAsync(step)), output);
  }

  public static createPackage(name: string): PackageManifest {
    return new PackageManifest(`src/noldova.desktop.sample${name}`, `@noldova/desktop.sample${name}`, []);
  }

  private async recordAsync(step: string): Promise<void> {
    this.steps.push(step);
    if (step.split(" ")[0] === this.failAt)
      throw this.failure;
    await Promise.resolve();
  }
}

class StepPackageBuild extends PackageBuild {
  private readonly record: (step: string) => Promise<void>;
  private readonly packages: readonly PackageManifest[];

  public constructor(root: string, runner: ProcessRunner, record: (step: string) => Promise<void>, packages: readonly PackageManifest[]) {
    super(root, runner, {});
    this.record = record;
    this.packages = packages;
  }

  public override async listCopiesAsync(): Promise<readonly PackageCopy[]> {
    await this.record("copies");
    return [new PackageCopy("sample-app", "node_modules/@noldova/desktop.cli", "1.2.3")];
  }

  public override async buildAsync(_output: Writable, variant: BuildVariant, part: BuildPart): Promise<readonly PackageManifest[]> {
    await this.record(`packages ${String(variant.isTest)} ${variant.excluded.join(",")} ${String(variant.isPackaged)} ${String(variant.updateFeed)} ${String(part.part)}`);
    return this.packages;
  }

  public override async buildAngularAsync(): Promise<readonly PackageManifest[]> {
    await this.record("angular-packages");
    return [];
  }

  public override async writeProductAsync(_variant: BuildVariant, outputFolder: string | null): Promise<void> {
    await this.record(`product ${String(outputFolder)}`);
  }

  public override async installAngularAsync(_output: Writable, modules: readonly ModuleDeclaration[]): Promise<void> {
    await this.record(`install-angular ${modules.map(t => t.id).join(",")}`);
  }
}

class StepModuleCatalog extends ModuleCatalog {
  private readonly record: (step: string) => Promise<void>;
  private readonly declarations: readonly ModuleDeclaration[];

  public constructor(root: string, record: (step: string) => Promise<void>, declarations: readonly ModuleDeclaration[]) {
    super(root);
    this.record = record;
    this.declarations = declarations;
  }

  public override async listBuildAsync(includeFixtures: boolean, excluded: readonly string[]): Promise<readonly ModuleDeclaration[]> {
    await this.record(`modules ${String(includeFixtures)} ${excluded.join(",")}`);
    return this.declarations;
  }

  public override async readNoldovaDesktopVersionAsync(): Promise<string | null> {
    await this.record("desktop-version");
    return "1.2.3";
  }
}

class StepModuleArtifacts extends ModuleArtifacts {
  private readonly record: (step: string) => Promise<void>;

  public constructor(root: string, record: (step: string) => Promise<void>) {
    super(root);
    this.record = record;
  }

  public override async writeAsync(declarations: readonly ModuleDeclaration[], outputFolder: string | null, noldovaDesktop: string | null): Promise<void> {
    await this.record(`artifacts ${declarations.length} ${String(outputFolder)} ${String(noldovaDesktop)}`);
  }
}

class StepProductFile extends ProductFile {
  private readonly record: (step: string) => Promise<void>;

  public constructor(root: string, record: (step: string) => Promise<void>) {
    super(root);
    this.record = record;
  }

  public override async writeAsync(): Promise<void> {
    await this.record("product-file");
  }
}

class StepGalleryFile extends GalleryFile {
  private readonly record: (step: string) => Promise<void>;

  public constructor(root: string, record: (step: string) => Promise<void>) {
    super(root);
    this.record = record;
  }

  public override async writeAsync(isPackaged: boolean): Promise<void> {
    await this.record(`gallery ${String(isPackaged)}`);
  }
}

class StepAngularProject extends AngularProject {
  private readonly record: (step: string) => Promise<void>;

  public constructor(root: string, runner: ProcessRunner, record: (step: string) => Promise<void>) {
    super(root, runner, new NpmCommand(runner, {}));
    this.record = record;
  }

  public override async installAsync(_output: Writable, part: BuildPart): Promise<void> {
    await this.record(`angular-install ${String(part.part)}`);
  }

  public override async prepareAsync(): Promise<void> {
    await this.record("prepare");
  }

  public override async buildAsync(_output: Writable, outputPath: string | null): Promise<void> {
    await this.record(`window ${String(outputPath)}`);
  }

  public override async verifyWithoutAsync(outputPath: string | null, texts: readonly string[]): Promise<void> {
    await this.record(`verify ${String(outputPath)} ${texts.length}`);
  }
}

class StepElectronBinary extends ElectronBinary {
  private readonly record: (step: string) => Promise<void>;

  public constructor(root: string, runner: ProcessRunner, record: (step: string) => Promise<void>) {
    super(root, runner);
    this.record = record;
  }

  public override async installAsync(): Promise<void> {
    await this.record("electron");
  }
}
