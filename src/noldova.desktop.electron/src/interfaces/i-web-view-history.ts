/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NavigationEntry } from "electron";

export interface IWebViewHistory {
  readonly entries: readonly NavigationEntry[];
  readonly index: number;
}
