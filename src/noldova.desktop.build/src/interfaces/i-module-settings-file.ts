/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISettingsPageJson } from "./i-settings-page-json.ts";

export interface IModuleSettingsFile {
  readonly settings: readonly Readonly<Record<string, unknown>>[];
  readonly pages: readonly ISettingsPageJson[];
}
