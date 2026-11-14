/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export class WebViewProtocolEvent {
  public readonly view: string;
  public readonly method: string;
  public readonly params: JsonObject;
  public readonly isCut: boolean;

  public constructor(view: string, method: string, params: JsonObject, isCut: boolean) {
    this.view = view;
    this.method = method;
    this.params = params;
    this.isCut = isCut;
  }
}
