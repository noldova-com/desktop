/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWindowOpenDetails {
  readonly url: string;
  readonly referrer: { readonly url: string };
  readonly disposition?: string;
}
