/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { ModuleDeclaration } from "../../models/modules/module-declaration.ts";
import { Resources } from "../../resources.ts";

export class PackagedModules {
  public static verify(status: unknown, declared: readonly Pick<ModuleDeclaration, "id" | "platforms" | "dependencies" | "switchSetting">[], platform: string): string {
    let listed: readonly JsonReader[];
    try {
      listed = JsonReader.fromValue(status).readObjectArray(Resources.statusModulesField);
    }
    catch (error) {
      throw new BuildException(Resources.formatPackagedModulesUnlisted(status), new ExceptionOptions(error));
    }
    const modules = listed.map(t => ({
      id: PackagedModules.readText(t, Resources.statusIdField),
      state: PackagedModules.readText(t, Resources.statusStateField),
      cause: PackagedModules.readText(t, Resources.statusCauseField)
    }));
    const byId = new Map(declared.map(t => [t.id, t]));
    const isLeftOut = (id: string): boolean => {
      const platforms = byId.get(id)?.platforms ?? null;
      return !Object.isNull(platforms) && !platforms.includes(platform);
    };
    const dependsOnLeftOut = (id: string, seen: ReadonlySet<string>): boolean =>
      (byId.get(id)?.dependencies ?? []).some(t => !seen.has(t) && (isLeftOut(t) || dependsOnLeftOut(t, new Set([...seen, t]))));
    const isExcused = (id: string, state: string): boolean =>
      state === Resources.moduleUnavailableState && isLeftOut(id) || state === Resources.moduleBlockedState && dependsOnLeftOut(id, new Set([id])) ||
      state === Resources.moduleOffState && !Object.isNull(byId.get(id)?.switchSetting ?? null);
    const missing = declared.map(t => t.id).filter(t => !modules.some(u => u.id === t));
    const inactive = modules.filter(t => t.state !== Resources.moduleActiveState && !isExcused(t.id, t.state));
    if (missing.length > 0 || inactive.length > 0)
      throw new BuildException(Resources.formatPackagedModulesNotActive([
        ...missing.map(t => Resources.formatPackagedModuleMissing(t)),
        ...inactive.map(t => Resources.formatPackagedModuleInactive(t.id, t.state, t.cause))
      ]));
    const active = modules.filter(t => t.state === Resources.moduleActiveState).map(t => t.id);
    const unavailable = modules.filter(t => t.state === Resources.moduleUnavailableState).map(t => t.id);
    const blocked = modules.filter(t => t.state === Resources.moduleBlockedState).map(t => t.id);
    const off = modules.filter(t => t.state === Resources.moduleOffState).map(t => t.id);
    if (modules.length === 0)
      return Resources.packagedModulesNone;
    return Resources.formatPackagedModulesActive(active, unavailable, blocked, off, platform);
  }

  private static readText(module: JsonReader, name: string): string {
    const field = module.toJson()[name];
    return Object.isString(field) ? field : String.empty;
  }
}
