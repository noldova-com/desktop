/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBrowserPage } from "./i-browser-page.ts";
import type { IVitestPluginContext } from "./i-vitest-plugin-context.ts";

export interface IBrowserCommandContext {
  readonly page: IBrowserPage;
  readonly project: IVitestPluginContext;
}
