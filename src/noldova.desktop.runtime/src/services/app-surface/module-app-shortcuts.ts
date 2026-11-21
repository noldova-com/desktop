/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppShortcut, KeyChord } from "@noldova/desktop.protocol";

import type { IAppShortcuts } from "../../interfaces/i-app-shortcuts.js";
import type { AppSurface } from "./app-surface.js";

export class ModuleAppShortcuts implements IAppShortcuts {
  private readonly surface: AppSurface;
  private readonly registrations: Disposable[];
  private readonly stopping: AbortSignal;

  public constructor(surface: AppSurface, registrations: Disposable[], stopping: AbortSignal) {
    this.surface = surface;
    this.registrations = registrations;
    this.stopping = stopping;
  }

  public list(): readonly AppShortcut[] {
    return this.surface.shortcuts;
  }

  public has(key: KeyChord): boolean {
    return this.surface.hasShortcut(key);
  }

  public onChanged(listener: () => void): () => void {
    if (this.stopping.aborted)
      return () => undefined;
    const registration = this.surface.onShortcutsChanged(listener);
    this.registrations.push(registration);
    return () => registration[Symbol.dispose]();
  }
}
