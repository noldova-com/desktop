/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import "@noldova/context.core";

import { KnownIcon } from "../models/known-icon.js";
import { Resources } from "../../resources.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";

@Injectable({ providedIn: "root" })
export class UnknownIconsService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly noted: Map<string, Set<string>> = new Map();

  public note(moduleId: string, name: string | null): void {
    if (Object.isNull(name) || KnownIcon.isKnown(name))
      return;
    const names = this.noted.get(moduleId) ?? new Set<string>();
    if (names.has(name))
      return;
    names.add(name);
    this.noted.set(moduleId, names);
    this.bridge.logModule(moduleId, Resources.formatUnknownIcon(name));
  }
}
