/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewGuest } from "./i-web-view-guest.js";
import type { IWebViewSession } from "./i-web-view-session.js";

export interface IWebViewEngine {
  readSession(partition: string): IWebViewSession;
  findGuest(contentsId: number): IWebViewGuest | null;
  watchAttach(isAllowed: (windowId: number, partition: string) => boolean, log: (text: string) => void): void;
  now(): number;
  waitAsync(milliseconds: number, signal: AbortSignal): Promise<void>;
}
