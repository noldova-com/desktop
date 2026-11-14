/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type { ModuleCatalog } from "../../src/noldova.desktop.build/src/services/modules/module-catalog.ts";
import { ModuleDeclaration } from "../../src/noldova.desktop.build/src/models/modules/module-declaration.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";

export class ModuleFolderCheck implements ICheck {
  private readonly root: string;
  private readonly modules: ModuleCatalog;

  public readonly title: string = Resources.moduleFolderCheckTitle;

  public constructor(root: string, modules: ModuleCatalog) {
    this.root = root;
    this.modules = modules;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const folder = path.join(this.root, Resources.sourceModulesFolder);
    const names = existsSync(folder) ? (await readdir(folder)).sort() : [];
    const findings: string[] = [];
    for (const name of names) {
      const location = `${Resources.sourceModulesFolder}${Resources.pathSeparator}${name}`;
      if (!(await stat(path.join(folder, name))).isDirectory()) {
        findings.push(Resources.formatModuleFolderNotFolder(location));
        continue;
      }
      if (!Resources.moduleFolderIdPattern.test(name) || name === Resources.moduleFolderReservedId)
        findings.push(Resources.formatModuleFolderBadId(location, name));
      if (!existsSync(path.join(folder, name, Resources.moduleFolderDocumentName)))
        findings.push(Resources.formatModuleFolderNoDocument(location));
      const parts = BuildResources.moduleParts.filter(t => existsSync(path.join(folder, name, t)));
      if (parts.length > 0 && !ModuleDeclaration.hasDeclaration(this.root, location))
        findings.push(Resources.formatModuleFolderUndeclared(location, parts));
    }
    findings.push(...(await this.modules.readAllAsync()).problems);

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatModuleFolderChecked(names.length));
    return findings.length === 0;
  }
}
