/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";
import type { WebViewEvent, WebViewNavigation, WebViewPane } from "@noldova/desktop.protocol";

import type { IWebViewFindOptions } from "./i-web-view-find-options.js";
import type { IWebViewFound } from "./i-web-view-found.js";
import type { IWebViewLayer } from "./i-web-view-layer.js";

export interface IWebViewHandle {
  readonly id: string;
  readonly pane: WebViewPane;
  readonly profileKey: string;
  readonly isClosed: boolean;

  mount(host: HTMLElement): void;
  show(): void;
  hide(): void;
  setControlled(isControlled: boolean): void;
  openLayerAsync<T>(load: () => Promise<Type<T>>): Promise<IWebViewLayer<T>>;
  navigateAsync(url: string): Promise<WebViewNavigation>;
  goBackAsync(): Promise<WebViewNavigation>;
  goForwardAsync(): Promise<WebViewNavigation>;
  reloadAsync(): Promise<WebViewNavigation>;
  stopAsync(): Promise<WebViewNavigation>;
  getZoomAsync(): Promise<number>;
  setZoomAsync(factor: number): Promise<number>;
  zoomInAsync(): Promise<number>;
  zoomOutAsync(): Promise<number>;
  findAsync(text: string, options?: IWebViewFindOptions): Promise<IWebViewFound>;
  findNextAsync(): Promise<IWebViewFound>;
  findPreviousAsync(): Promise<IWebViewFound>;
  endFind(): void;
  subscribe(listener: (event: WebViewEvent) => void): () => void;
  close(): void;
}
