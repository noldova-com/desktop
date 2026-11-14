/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { QualifiedName, Response } from "@noldova/desktop.protocol";

export interface IRuntimeConnection {
  readonly isConnected: boolean;

  callAsync(method: QualifiedName, payload: JsonValue, timeout?: number, signal?: AbortSignal, window?: number, page?: number): Promise<Response>;
  close(): void;
}
