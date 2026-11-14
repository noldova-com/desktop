/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import type { ModuleDeclaration } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";
import { CliCommandDefinition } from "./cli-command-definition.js";

export class CliModule {
  public readonly id: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly dependencies: readonly string[];
  public readonly cliPackage: string | null;
  public readonly commands: readonly CliCommandDefinition[];
  public readonly optionalDependencies: readonly string[];

  public constructor(
    id: string,
    displayName: string,
    description: string,
    dependencies: readonly string[],
    cliPackage: string | null,
    commands: readonly CliCommandDefinition[],
    optionalDependencies: readonly string[]) {
    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.dependencies = dependencies;
    this.cliPackage = cliPackage;
    this.commands = commands;
    this.optionalDependencies = optionalDependencies;
  }

  public static fromDeclaration(declaration: ModuleDeclaration): CliModule {
    return new CliModule(
      declaration.id,
      declaration.displayName,
      declaration.description,
      declaration.dependencies,
      declaration.cliPackage,
      declaration.cliCommands.map((t, index) => CliCommandDefinition.fromJson(JsonReader.fromValue(t, Resources.formatCliCommandPath(declaration.id, index)))),
      declaration.optionalDependencies);
  }
}
