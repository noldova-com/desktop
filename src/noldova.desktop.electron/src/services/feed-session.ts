/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IFeedNetSession } from "../interfaces/i-feed-net-session.js";
import type { IFeedResponse } from "../interfaces/i-feed-response.js";
import type { FeedRequestGuard } from "./feed-request-guard.js";

export class FeedSession {
  private readonly create: () => IFeedNetSession;
  private readonly guard: FeedRequestGuard;
  private session: IFeedNetSession | undefined;

  public constructor(create: () => IFeedNetSession, guard: FeedRequestGuard) {
    this.create = create;
    this.guard = guard;
    this.session = undefined;
  }

  public fetchAsync(url: string, signal: AbortSignal): Promise<IFeedResponse> {
    return this.open().fetch(url, { signal });
  }

  private open(): IFeedNetSession {
    if (Object.isUndefined(this.session)) {
      const created = this.create();
      this.guard.install(created.webRequest);
      this.session = created;
    }
    return this.session;
  }
}
