/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { IPreloadChannels } from "../interfaces/i-preload-channels.js";
import type { IPreloadSettings } from "../interfaces/i-preload-settings.js";
import { Resources } from "../resources.js";

export class PreloadSettings implements IPreloadSettings {
  public readonly bridge: string = Resources.bridgeName;
  public readonly pastedByteLimit: number = Resources.pastedByteLimit;
  public readonly appearance: JsonObject | null;
  public readonly channels: IPreloadChannels = Resources.preloadChannels;

  public constructor(appearance: JsonObject | null) {
    this.appearance = appearance;
  }

  public toArgument(): string {
    return `${Resources.preloadArgument}${JSON.stringify(this)}`;
  }
}
