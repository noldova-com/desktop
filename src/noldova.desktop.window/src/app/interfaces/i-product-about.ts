/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProductLogo } from "./i-product-logo.js";

export interface IProductAbout {
  readonly description: string | null;
  readonly website: string | null;
  readonly releases: string | null;
  readonly licenses: string | null;
  readonly logo: IProductLogo | null;
}
