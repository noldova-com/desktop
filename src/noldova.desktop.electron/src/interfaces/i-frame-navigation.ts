/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPreventableEvent } from "./i-preventable-event.js";
import type { IWebViewFrame } from "./i-web-view-frame.js";

export interface IFrameNavigation extends IPreventableEvent {
  readonly url: string;
  readonly isMainFrame: boolean;
  readonly frame: IWebViewFrame | null;
  readonly initiator?: IWebViewFrame | null;
}
