/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/desktop.protocol";

export class ListedAndPostedFixture {
  public readonly synced: string;
  public readonly posted: string;
  public readonly event: Event;

  public constructor(synced: string, posted: string, event: Event) {
    this.synced = synced;
    this.posted = posted;
    this.event = event;
  }
}
