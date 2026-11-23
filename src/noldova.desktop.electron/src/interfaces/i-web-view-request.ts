/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewFrame } from "./i-web-view-frame.js";

export interface IWebViewRequest {
  readonly id: number;
  readonly url: string;
  readonly webContentsId?: number;
  readonly resourceType: string;
  readonly frame?: IWebViewFrame | null;
  readonly requestHeaders?: Readonly<Record<string, string>>;
  readonly ip?: string;
}
