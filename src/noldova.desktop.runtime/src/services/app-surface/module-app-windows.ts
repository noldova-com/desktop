/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppWindow } from "@noldova/desktop.protocol";

import type { IAppWindows } from "../../interfaces/i-app-windows.js";
import type { AppSurface } from "./app-surface.js";

export class ModuleAppWindows implements IAppWindows {
  private readonly surface: AppSurface;
  private readonly registrations: Disposable[];

  public constructor(surface: AppSurface, registrations: Disposable[]) {
    this.surface = surface;
    this.registrations = registrations;
  }

  public list(): readonly AppWindow[] {
    return this.surface.windows;
  }

  public onChanged(listener: () => void): () => void {
    const registration = this.surface.onWindowsChanged(listener);
    this.registrations.push(registration);
    return () => registration[Symbol.dispose]();
  }
}
