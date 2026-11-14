/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWebViewRequest {
  readonly id: number;
  readonly url: string;
  readonly webContentsId?: number;
  readonly resourceType: string;
  readonly requestHeaders?: Readonly<Record<string, string>>;
}
