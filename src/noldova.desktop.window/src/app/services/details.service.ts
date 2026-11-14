/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";
import type { ModuleStatus } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";

@Injectable({ providedIn: "root" })
export class DetailsService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);

  public copyAsync(modules: readonly ModuleStatus[]): Promise<boolean> {
    const lines = [
      Resources.formatPlatformDetails(this.bridge.platform, this.bridge.processor),
      ...modules.map(t => Resources.formatModuleDetails(t.id, t.version, t.state, t.cause))
    ];
    return this.bridge.copyDetailsAsync(lines.join(Resources.detailsSeparator));
  }
}
