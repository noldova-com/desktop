/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IFoundInPageResult {
  readonly requestId: number;
  readonly activeMatchOrdinal: number;
  readonly matches: number;
  readonly finalUpdate: boolean;
}
