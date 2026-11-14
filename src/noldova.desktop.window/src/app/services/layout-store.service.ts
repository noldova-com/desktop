/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { RuntimeDisconnectedException } from "../exceptions/runtime-disconnected.exception.js";
import type { ILayoutStore } from "../interfaces/i-layout-store.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";

@Injectable({ providedIn: "root" })
export class LayoutStoreService implements ILayoutStore {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);

  public readAsync(): Promise<JsonValue | null> {
    return this.bridge.readLayoutAsync();
  }

  public async writeAsync(layout: JsonObject): Promise<boolean> {
    try {
      await this.bridge.writeLayoutAsync(layout);
      return true;
    }
    catch (error) {
      if (RuntimeDisconnectedException.isIn(error))
        return false;
      throw error;
    }
  }
}
