/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { JsonValue } from "@noldova/context.json";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { AppSurface } from "./app-surface.js";

export class MainWindowMethod implements IMethodHandler {
  private readonly surface: AppSurface;

  public constructor(surface: AppSurface) {
    this.surface = surface;
  }

  public handleAsync(_context: RequestContext): Promise<JsonValue> {
    return Promise.resolve(this.surface.mainWindow?.toJson() ?? null);
  }
}
