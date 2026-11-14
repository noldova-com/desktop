/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IShownPathStatus } from "./i-shown-path-status.js";

export interface IShownPathFiles {
  lstat(file: string): Promise<IShownPathStatus>;
  readlink(link: string): Promise<string>;
  realpath(file: string): Promise<string>;
}
