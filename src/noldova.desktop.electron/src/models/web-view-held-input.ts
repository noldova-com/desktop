/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewInput } from "../interfaces/i-web-view-input.js";

export class WebViewHeldInput {
  public readonly input: IWebViewInput;
  public readonly isRelayed: boolean;

  public constructor(input: IWebViewInput, isRelayed: boolean) {
    this.input = input;
    this.isRelayed = isRelayed;
  }
}
