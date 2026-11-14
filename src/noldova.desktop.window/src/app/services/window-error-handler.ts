/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, inject } from "@angular/core";

import "@noldova/context.core";

import { ActionNotConfirmedException } from "../exceptions/action-not-confirmed.exception.js";
import { RuntimeDisconnectedException } from "../exceptions/runtime-disconnected.exception.js";
import { WindowPartFailureException } from "../exceptions/window-part-failure.exception.js";
import { Resources } from "../../resources.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";

@Injectable()
export class WindowErrorHandler extends ErrorHandler {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly handled: WeakSet<object> = new WeakSet();

  public override handleError(error: unknown): void {
    if (!(error instanceof ActionNotConfirmedException) && RuntimeDisconnectedException.isIn(error))
      return;
    if (Object.isObject(error)) {
      if (this.handled.has(error))
        return;
      this.handled.add(error);
    }
    super.handleError(error);
    const moduleId = error instanceof WindowPartFailureException ? error.moduleId : null;
    this.bridge.logError(moduleId, WindowErrorHandler.describe(error).slice(0, Resources.windowLogLimit));
  }

  private static describe(error: unknown): string {
    if (!(error instanceof Error))
      return String(error);
    const text = error.stack ?? Resources.formatErrorText(error.name, error.message);
    return Object.isUndefined(error.cause) ? text : `${text}${Resources.causeSeparator}${WindowErrorHandler.describe(error.cause)}`;
  }
}
