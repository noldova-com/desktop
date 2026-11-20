/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewPane } from "@noldova/desktop.protocol";

import type { IWebViewHandle } from "./i-web-view-handle.js";
import type { IWebViewOpenOptions } from "./i-web-view-open-options.js";

export interface IWindowWebViews {
  openAsync(pane: WebViewPane, profileKey: string, options?: IWebViewOpenOptions): Promise<IWebViewHandle>;
}
