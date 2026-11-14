/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SettingsRow } from "../models/settings/settings-row.js";

export interface ISettingsPageRow {
  readonly page: string;
  readonly row: SettingsRow;
}
