/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { DeclarationFieldInvalidException } from "../../exceptions/declaration-field-invalid.exception.js";
import { DeclarationsUnreadableException } from "../../exceptions/declarations-unreadable.exception.js";
import { DeclarationsVersionUnsupportedException } from "../../exceptions/declarations-version-unsupported.exception.js";
import { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";

export class ModuleDeclarationReader {
  public static locate(runtimeEntryPath: string): string {
    return path.join(path.dirname(runtimeEntryPath), ...Resources.installRootSegments, ...Resources.declarationsFileSegments);
  }

  public static async readAsync(file: string): Promise<readonly ModuleDeclaration[]> {
    return (await ModuleDeclarationReader.readDocumentAsync(file)).modules;
  }

  public static async readNoldovaDesktopAsync(file: string): Promise<string | null> {
    return (await ModuleDeclarationReader.readDocumentAsync(file)).noldovaDesktop;
  }

  private static async readDocumentAsync(file: string): Promise<{ readonly modules: readonly ModuleDeclaration[]; readonly noldovaDesktop: string | null }> {
    try {
      return ModuleDeclarationReader.parse(JsonReader.parse(await readFile(file, Resources.utf8Encoding)));
    }
    catch (error) {
      throw new DeclarationsUnreadableException(file, error);
    }
  }

  private static parse(reader: JsonReader): { readonly modules: readonly ModuleDeclaration[]; readonly noldovaDesktop: string | null } {
    const version = reader.hasField(Resources.formatVersionField) ? reader.readValue(Resources.formatVersionField) : undefined;
    if (version !== Resources.declarationsFormatVersion)
      throw new DeclarationsVersionUnsupportedException(version);
    const modules = reader.readObjectArray(Resources.modulesField);
    const noldovaDesktop = reader.hasField(Resources.noldovaDesktopField) ? reader.readValue(Resources.noldovaDesktopField) : null;
    if (!Object.isNull(noldovaDesktop) && (!Object.isString(noldovaDesktop) || !Resources.moduleVersionPattern.test(noldovaDesktop)))
      throw new DeclarationFieldInvalidException(Resources.noldovaDesktopField);
    return { modules: modules.map(t => ModuleDeclaration.fromJson(t.toJson())), noldovaDesktop };
  }
}
