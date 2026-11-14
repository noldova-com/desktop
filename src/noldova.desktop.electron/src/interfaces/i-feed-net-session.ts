/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFeedResponse } from "./i-feed-response.js";
import type { IFeedWebRequest } from "./i-feed-web-request.js";

export interface IFeedNetSession {
  readonly webRequest: IFeedWebRequest;
  fetch(url: string, init: { readonly signal: AbortSignal }): Promise<IFeedResponse>;
}
