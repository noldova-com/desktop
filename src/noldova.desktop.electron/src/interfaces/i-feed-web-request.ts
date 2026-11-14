/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IFeedWebRequest {
  onBeforeRequest(listener: (details: { readonly url: string }, callback: (response: { readonly cancel: boolean }) => void) => void): void;
  onBeforeSendHeaders(listener: (details: { readonly id: number; readonly requestHeaders: Readonly<Record<string, string>> },
    callback: (response: { readonly requestHeaders: Record<string, string> }) => void) => void): void;
  onResponseStarted(listener: (details: { readonly id: number }) => void): void;
  onErrorOccurred(listener: (details: { readonly id: number }) => void): void;
}
