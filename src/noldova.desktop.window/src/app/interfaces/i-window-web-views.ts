/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewPane } from "@noldova/desktop.protocol";

import type { IWebViewHandle } from "./i-web-view-handle.js";

export interface IWindowWebViews {
  openAsync(pane: WebViewPane, profileKey: string): Promise<IWebViewHandle>;
}
