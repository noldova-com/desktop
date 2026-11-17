/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewAction, WebViewEvent, WebViewInfo, WebViewNavigation } from "@noldova/desktop.protocol";

import type { IWebViewRelay } from "./i-web-view-relay.js";

export interface IRuntimeWebViews {
  readonly relay: IWebViewRelay;

  list(): readonly WebViewInfo[];

  navigateAsync(id: string, url: string): Promise<WebViewNavigation>;

  actAsync(id: string, action: WebViewAction): Promise<WebViewNavigation>;

  setAllowedOriginsAsync(id: string, origins: readonly string[]): Promise<void>;

  setControlledAsync(id: string, isControlled: boolean): Promise<void>;

  clearProfileAsync(profileKey: string): Promise<void>;

  onViewEvent(listener: (event: WebViewEvent) => void): () => void;
}
