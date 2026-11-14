/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ModuleState, type ModuleStatus } from "@noldova/desktop.protocol";

import type { ModuleDeclaration } from "../../models/module-declaration.js";

export class DependencyStates {
  private readonly readStatus: (moduleId: string) => ModuleStatus | undefined;
  private readonly listeners: Set<{ readonly declaration: ModuleDeclaration; readonly listener: (moduleId: string, isActive: boolean) => void }> = new Set();

  public constructor(readStatus: (moduleId: string) => ModuleStatus | undefined) {
    this.readStatus = readStatus;
  }

  public isAvailable(declaration: ModuleDeclaration, dependency: string): boolean {
    const status = this.readStatus(dependency);
    return status?.state === ModuleState.Active && declaration.accepts(dependency, status.version);
  }

  public listen(declaration: ModuleDeclaration, listener: (moduleId: string, isActive: boolean) => void): () => void {
    const entry = { declaration, listener };
    this.listeners.add(entry);
    return () => {
      this.listeners.delete(entry);
    };
  }

  public announce(moduleId: string): void {
    for (const entry of [...this.listeners])
      if (this.listeners.has(entry) && entry.declaration.optionalDependencies.includes(moduleId))
        entry.listener(moduleId, this.isAvailable(entry.declaration, moduleId));
  }
}
