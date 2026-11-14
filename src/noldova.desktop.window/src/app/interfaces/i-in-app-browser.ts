/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LinkGesture } from "@noldova/ui.components.angular";

import type { LinkPlace } from "../enums/link-place.js";

export interface IInAppBrowser {
  placeFor(url: string, gesture: LinkGesture): LinkPlace;
  openAsync(url: string): Promise<void>;
}
