/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RenderProcessGoneDetails, WindowOpenHandlerResponse } from "electron";

import type { IFrameNavigation } from "./i-frame-navigation.js";
import type { IPreventableEvent } from "./i-preventable-event.js";
import type { IWebViewFrame } from "./i-web-view-frame.js";
import type { IWebViewDebugger } from "./i-web-view-debugger.js";
import type { IWebViewInput } from "./i-web-view-input.js";
import type { IWebViewInputEvent } from "./i-web-view-input-event.js";
import type { IWebViewKeyEvent } from "./i-web-view-key-event.js";
import type { IWindowNavigation } from "./i-window-navigation.js";
import type { IWindowOpenDetails } from "./i-window-open-details.js";
import type { WebViewHistory } from "../models/web-view-history.js";

export interface IWebViewContents {
  readonly id: number;
  readonly debugger: IWebViewDebugger;
  readonly mainFrame: { readonly framesInSubtree: readonly IWebViewFrame[] };

  loadURL(url: string): Promise<void>;
  getURL(): string;
  getTitle(): string;
  isLoading(): boolean;
  isDestroyed(): boolean;
  canGoBack(): boolean;
  canGoForward(): boolean;
  readHistoryEntry(offset: number): string | null;
  readHistory(): WebViewHistory;
  restoreHistoryAsync(history: WebViewHistory): Promise<void>;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  setWindowOpenHandler(handler: (details: IWindowOpenDetails) => WindowOpenHandlerResponse): void;
  setWebRTCIPHandlingPolicy(policy: "disable_non_proxied_udp"): void;
  getZoomFactor(): number;
  setZoomFactor(factor: number): void;
  findInPage(text: string, options: { readonly forward: boolean; readonly findNext: boolean; readonly matchCase: boolean }): number;
  stopFindInPage(action: "clearSelection"): void;
  sendInputEvent(event: IWebViewKeyEvent): void;
  insertText(text: string): Promise<void>;
  executeJavaScriptInIsolatedWorld(worldId: number, scripts: { code: string }[]): Promise<unknown>;
  on(event: "will-frame-navigate", listener: (navigation: IFrameNavigation) => void): unknown;
  on(event: "did-start-navigation", listener: (navigation: IWindowNavigation) => void): unknown;
  on(event: "will-attach-webview", listener: (event: IPreventableEvent) => void): unknown;
  on(event: "before-input-event", listener: (event: IPreventableEvent, input: IWebViewInput) => void): unknown;
  on(event: "did-start-loading" | "did-stop-loading" | "did-navigate" | "did-navigate-in-page" | "page-title-updated" | "destroyed", listener: () => void): unknown;
  on(event: "did-fail-load", listener: (event: unknown, code: number, description: string, url: string, isMainFrame: boolean) => void): unknown;
  on(event: "render-process-gone", listener: (event: unknown, details: RenderProcessGoneDetails) => void): unknown;
  on(event: "certificate-error", listener: (event: IPreventableEvent, url: string, error: string, certificate: unknown, callback: (isTrusted: boolean) => void) => void): unknown;
  on(event: "select-client-certificate", listener: (event: IPreventableEvent, url: string, list: unknown, callback: () => void) => void): unknown;
  on(event: "input-event", listener: (event: unknown, input: IWebViewInputEvent) => void): unknown;
  on(event: "ipc-message", listener: (event: { readonly processId: number; readonly frameId: number; readonly senderFrame: { readonly origin: string } | null }, channel: string, ...values: unknown[]) => void): unknown;
  on(event: "login", listener: (event: IPreventableEvent, details: { readonly url: string }, info: unknown, callback: () => void) => void): unknown;
  on(event: "found-in-page", listener: (event: unknown, result: { readonly requestId: number; readonly activeMatchOrdinal: number; readonly matches: number; readonly finalUpdate: boolean }) => void): unknown;
  on(event: "zoom-changed", listener: (event: unknown, direction: string) => void): unknown;
  on(event: "page-favicon-updated", listener: (event: unknown, favicons: string[]) => void): unknown;
}
