/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event, Response } from "@noldova/desktop.protocol";

export class ReadMessagesFixture {
  public readonly responses: ReadonlyMap<string, Response>;
  public readonly events: readonly Event[];

  public constructor(responses: ReadonlyMap<string, Response>, events: readonly Event[]) {
    this.responses = responses;
    this.events = events;
  }
}
