/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HeldInputKind } from "../enums/held-input-kind.js";
import type { IWebViewInput } from "../interfaces/i-web-view-input.js";

export class WebViewHeldInput {
  public readonly input: IWebViewInput;
  public readonly kind: HeldInputKind;

  public constructor(input: IWebViewInput, kind: HeldInputKind) {
    this.input = input;
    this.kind = kind;
  }
}
