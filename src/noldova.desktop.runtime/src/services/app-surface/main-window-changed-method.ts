/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Failure, FailureCode, MainWindow, ShellClients } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import { Resources } from "../../resources.js";
import type { AppSurface } from "./app-surface.js";

export class MainWindowChangedMethod implements IMethodHandler {
  private readonly surface: AppSurface;

  public constructor(surface: AppSurface) {
    this.surface = surface;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    if (context.client !== ShellClients.mainProcess || !Object.isNull(context.window))
      return Promise.reject(new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.mainWindowNotFromMainProcess)));
    this.surface.receiveMainWindow(context.connection, MainWindow.fromJson(context.payload));
    return Promise.resolve(null);
  }
}
