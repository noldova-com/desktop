/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export interface ICliCommandConsole {
  writeLine(text: string): void;

  askAsync(prompt: string): Promise<string | null>;

  onEvent(name: string, listener: (payload: JsonValue) => void): Disposable;
}
