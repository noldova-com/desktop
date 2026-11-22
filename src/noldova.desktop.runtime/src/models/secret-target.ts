/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventChannel } from "./event-channel.js";

export class SecretTarget {
  public readonly connection: number;
  public readonly channel: EventChannel;

  public constructor(connection: number, channel: EventChannel) {
    this.connection = connection;
    this.channel = channel;
  }
}
