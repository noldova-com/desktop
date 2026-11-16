/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyChord, WebViewInfo } from "@noldova/desktop.protocol";

export interface IOpenedWebView {
  readonly view: WebViewInfo;
  readonly partition: string;
  readonly keys: readonly KeyChord[];
}
