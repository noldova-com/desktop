/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewInputKind } from "../enums/web-view-input-kind.js";

export interface IWebViewInput {
  readonly module: string;
  readonly view: string;
  readonly kind: WebViewInputKind;
}
