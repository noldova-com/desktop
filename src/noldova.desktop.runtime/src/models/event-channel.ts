/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class EventChannel implements Disposable {
  private readonly publisher: (payload: JsonValue, connection?: number, window?: number | null) => void;
  private readonly withdraw: () => void;

  public constructor(publisher: (payload: JsonValue, connection?: number, window?: number | null) => void, withdraw: () => void) {
    this.publisher = publisher;
    this.withdraw = withdraw;
  }

  public publish(payload: JsonValue): void {
    this.publisher(payload);
  }

  public publishTo(connection: number, window: number | null, payload: JsonValue): void {
    this.publisher(payload, connection, window);
  }

  public [Symbol.dispose](): void {
    this.withdraw();
  }
}
