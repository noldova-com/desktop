/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EnvironmentProviders, Type } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";

import type { WindowPartSource } from "../models/window-part-source.js";
import type { IProductAbout } from "./i-product-about.js";

export interface IWindowInputs {
  readonly productName: string;
  readonly about?: IProductAbout;
  readonly windowParts: readonly WindowPartSource[];
  readonly menus: Readonly<Record<string, JsonValue>>;
  readonly gallery: Type<unknown> | null;
  readonly providers?: readonly EnvironmentProviders[];
}
