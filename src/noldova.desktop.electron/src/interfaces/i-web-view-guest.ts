/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewContents } from "./i-web-view-contents.js";

export interface IWebViewGuest {
  readonly contents: IWebViewContents;
  readonly hostId: number | null;
  readonly partition: string | null;
}
