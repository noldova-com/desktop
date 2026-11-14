/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { WindowClosed } from "@noldova/desktop.protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { RuntimeServer } from "./runtime-server.js";

export class WindowClosedMethod implements IMethodHandler {
  private readonly server: RuntimeServer;

  public constructor(server: RuntimeServer) {
    this.server = server;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    this.server.closeWindow(context, WindowClosed.fromJson(context.payload).window);
    return Promise.resolve(null);
  }
}
