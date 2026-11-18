/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IShownPathFiles } from "./i-shown-path-files.js";

export interface IMainProcessFiles extends IShownPathFiles {
  rename(from: string, to: string): Promise<void>;
}
