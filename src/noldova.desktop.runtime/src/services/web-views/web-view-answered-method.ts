/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { WebViewAnswered } from "@noldova/desktop.protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { WebViewCenter } from "./web-view-center.js";

export class WebViewAnsweredMethod implements IMethodHandler {
  private readonly center: WebViewCenter;

  public constructor(center: WebViewCenter) {
    this.center = center;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    this.center.answer(context.connection, WebViewAnswered.fromJson(context.payload));
    return Promise.resolve(null);
  }
}
