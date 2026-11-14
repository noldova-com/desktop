/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { IPreloadChannels } from "./i-preload-channels.js";

export interface IPreloadSettings {
  readonly bridge: string;
  readonly pastedByteLimit: number;
  readonly appearance: JsonObject | null;
  readonly channels: IPreloadChannels;
}
