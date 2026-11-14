/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

import type { StatusBarItemTone } from "../enums/status-bar-item-tone.js";

export interface IStatusBarItemOptions {
  readonly icon?: string;
  readonly tooltip?: string;
  readonly command?: string;
  readonly commandArguments?: JsonValue;
  readonly isHidden?: boolean;
  readonly tone?: StatusBarItemTone;
}
