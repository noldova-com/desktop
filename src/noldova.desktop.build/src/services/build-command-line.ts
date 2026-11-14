#!/usr/bin/env node
/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpathSync } from "node:fs";
import type { Writable } from "node:stream";

import { Resources } from "../resources.ts";
import { AngularProject } from "./angular/angular-project.ts";
import { GalleryFile } from "./angular/gallery-file.ts";
import { ProductFile } from "./angular/product-file.ts";
import { Build } from "./commands/build.ts";
import { DesktopToolsCommand } from "./commands/desktop-tools-command.ts";
import { Install } from "./commands/install.ts";
import { ListTargets } from "./commands/list-targets.ts";
import { PackageSmoke } from "./commands/package-smoke.ts";
import { Package } from "./commands/package.ts";
import { ReleaseAssets } from "./commands/release-assets.ts";
import { ReleaseCheck } from "./commands/release-check.ts";
import { ReleasePublish } from "./commands/release-publish.ts";
import { Start } from "./commands/start.ts";
import { DevelopmentBinary } from "./desktop/development-binary.ts";
import { ElectronBinary } from "./desktop/electron-binary.ts";
import { SandboxValidator } from "./desktop/sandbox.validator.ts";
import { ModuleArtifacts } from "./modules/module-artifacts.ts";
import { ModuleCatalog } from "./modules/module-catalog.ts";
import { PackageBuild } from "./packages/package-build.ts";
import { PackageStage } from "./packaging/package-stage.ts";
import { PackagedBuild } from "./packaging/packaged-build.ts";
import { TrustedSigningModule } from "./packaging/trusted-signing-module.ts";
import { ProcessRunner } from "./processes/process-runner.ts";
import { TemporaryFolder } from "./processes/temporary-folder.ts";
import { NpmCommand } from "./toolchain/npm-command.ts";

export class BuildCommandLine {
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly output: Writable;
  private readonly errors: Writable;

  public constructor(folder: string, environment: NodeJS.ProcessEnv, platform: string, architecture: string, output: Writable, errors: Writable) {
    this.folder = folder;
    this.environment = environment;
    this.platform = platform;
    this.architecture = architecture;
    this.output = output;
    this.errors = errors;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const [command, ...rest] = commandArguments;
    const runner = new ProcessRunner();
    switch (command) {
      case Resources.installCommand:
        return new Install(new AngularProject(this.folder, runner, new NpmCommand(runner, this.environment)), this.output).runAsync(rest);
      case Resources.buildCommand: {
        const root = this.folder;
        const angular = new AngularProject(root, runner, new NpmCommand(runner, this.environment));
        const build = new Build(new PackageBuild(root, runner, this.environment, this.platform, this.architecture), new ModuleCatalog(root), new ModuleArtifacts(root),
          new ProductFile(root), new GalleryFile(root), angular, new ElectronBinary(root, runner), this.output);
        return build.runAsync(rest);
      }
      case Resources.startCommand: {
        const root = realpathSync(this.folder);
        const sandbox = new SandboxValidator(this.platform, SandboxValidator.readOptionalTextAsync, SandboxValidator.statOptionalAsync);
        return new Start(root, runner, new DevelopmentBinary(root, runner, this.platform, this.architecture), sandbox).runAsync(rest, this.environment, this.output);
      }
      case Resources.desktopToolsCommand: {
        const root = realpathSync(this.folder);
        return new DesktopToolsCommand(root, runner, new DevelopmentBinary(root, runner, this.platform, this.architecture)).runAsync(rest, this.environment, this.errors);
      }
      case Resources.packageCommand: {
        const root = this.folder;
        const npm = new NpmCommand(runner, this.environment);
        const stage = new PackageStage(root, npm, new PackagedBuild(root, runner, new GalleryFile(root), new AngularProject(root, runner, npm)));
        return new Package(root, this.platform, this.architecture, stage, runner, this.environment, this.output, TrustedSigningModule.PACKAGES).runAsync(rest);
      }
      case Resources.packageSmokeCommand:
        return new PackageSmoke(this.folder, this.platform, this.architecture, runner, new TemporaryFolder(), Resources.procFolder, this.environment, this.output).runAsync(rest);
      case Resources.listTargetsCommand:
        return new ListTargets(this.output, this.errors, this.environment).runAsync(rest);
      case Resources.releaseCheckCommand:
        return new ReleaseCheck(this.folder, runner, this.environment, this.output).runAsync(rest);
      case Resources.releaseAssetsCommand:
        return new ReleaseAssets(this.folder, this.platform, this.architecture, this.output).runAsync(rest);
      case Resources.releasePublishCommand:
        return new ReleasePublish(this.folder, runner, this.environment, this.output).runAsync(rest);
      default:
        this.errors.write(Resources.usage);
        return Resources.usageExitCode;
    }
  }
}

if (import.meta.main)
  process.exitCode = await new BuildCommandLine(process.cwd(), process.env, process.platform, process.arch, process.stdout, process.stderr).runAsync(process.argv.slice(Resources.commandArgumentsOffset));
