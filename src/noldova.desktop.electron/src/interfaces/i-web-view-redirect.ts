/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWebViewRedirect {
  readonly id: number;
  readonly url: string;
  readonly redirectURL: string;
  readonly webContentsId?: number;
  readonly ip?: string;
}
