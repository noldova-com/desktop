/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import "@noldova/context.core";

import type { IBuilderRun } from "../../interfaces/i-builder-run.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackageBuilder {
  private readonly installFolder: string | null;

  public constructor(installFolder: string | null) {
    this.installFolder = installFolder;
  }

  public static async runAsync(exports: object, commandArguments: readonly string[]): Promise<void> {
    const build = Resources.builderRunExport in exports ? exports[Resources.builderRunExport] : undefined;
    if (!PackageBuilder.isBuild(build))
      throw new BuildException(Resources.builderRunMissing);
    await build(PackageBuilder.formatOptions(commandArguments));
  }

  public static locateBuilder(root: string): string {
    return createRequire(import.meta.url).resolve(path.join(root, Resources.nodeModulesFolder, Resources.builderModule));
  }

  public static loadBuilder(root: string): object {
    const exports: object = createRequire(import.meta.url)(PackageBuilder.locateBuilder(root));
    return exports;
  }

  public static formatOptions(commandArguments: readonly string[]): IBuilderRun {
    const [configuration = String.empty, installFolder = null] = commandArguments;
    const builder = new PackageBuilder(installFolder);
    return { config: configuration, publish: Resources.builderPublishNever, effectiveOptionComputed: t => builder.computeAsync(t) };
  }

  public async computeAsync(options: unknown): Promise<boolean> {
    const installFolder = this.installFolder;
    if (Object.isNull(installFolder) || !Array.isArray(options))
      return false;
    const [packageArguments, desktopFile]: readonly unknown[] = options;
    if (!Array.isArray(packageArguments) || !Object.isString(desktopFile))
      return false;
    const values: unknown[] = packageArguments;
    const index = values.findIndex(t => Object.isString(t) && Resources.debianAppMappingPattern.test(t));
    const entry = await readFile(desktopFile, Resources.textEncoding);
    if (index < 0 || !Resources.debianExecPattern.test(entry))
      throw new BuildException(Resources.formatDebianInstallFolderUnplaced(installFolder, desktopFile));
    values[index] = String(values[index]).replace(Resources.debianAppMappingPattern, (_match: string, source: string, product: string) =>
      `${source}${Resources.formatDebianInstallFolder(installFolder)}/${product}`);
    await writeFile(desktopFile, entry.replace(Resources.debianExecPattern, (_match: string, key: string) => `${key}${Resources.formatDebianInstallFolder(installFolder)}/`));
    return false;
  }

  private static isBuild(value: unknown): value is (options: IBuilderRun) => Promise<unknown> {
    return Object.isFunction(value);
  }
}

if (import.meta.main)
  await PackageBuilder.runAsync(PackageBuilder.loadBuilder(process.cwd()), process.argv.slice(Resources.commandArgumentsOffset));
