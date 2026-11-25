/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event, Response } from "@noldova/desktop.protocol";

import type { RawConnectionFixture } from "./raw-connection.fixture.js";

export class EventAndResponseFixture {
  public readonly event: Event;
  public readonly response: Response;

  public constructor(event: Event, response: Response) {
    this.event = event;
    this.response = response;
  }

  public static async readAsync(connection: RawConnectionFixture): Promise<EventAndResponseFixture> {
    return new EventAndResponseFixture(await connection.readEventAsync(), await connection.readResponseAsync());
  }
}
