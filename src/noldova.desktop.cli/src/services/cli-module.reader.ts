/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModuleDeclarationReader } from "@noldova/desktop.runtime";

import { CliCommandsUnreadableException } from "../exceptions/cli-commands-unreadable.exception.js";
import { CliModule } from "../models/cli-module.js";

export class CliModuleReader {
  public static async readAsync(runtimeEntryPath: string): Promise<readonly CliModule[]> {
    const file = ModuleDeclarationReader.locate(runtimeEntryPath);
    const declarations = await ModuleDeclarationReader.readAsync(file);
    try {
      return declarations.map(t => CliModule.fromDeclaration(t));
    }
    catch (error) {
      throw new CliCommandsUnreadableException(file, error);
    }
  }
}
