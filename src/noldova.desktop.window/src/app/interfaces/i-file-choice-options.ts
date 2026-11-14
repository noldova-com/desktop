/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFileGrantOptions } from "./i-file-grant-options.js";

export interface IFileChoiceOptions extends IFileGrantOptions {
  readonly multiple?: boolean;
}
