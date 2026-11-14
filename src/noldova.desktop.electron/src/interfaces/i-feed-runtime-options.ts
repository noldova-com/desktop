/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IFeedRuntimeOptions {
  readonly isUseMultipleRangeRequest: boolean;
  readonly platform: "darwin" | "linux" | "win32";
  readonly executor: object;
}
