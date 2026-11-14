/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IViewUpdate {
  readonly title?: string;
  readonly icon?: string;
  readonly breadcrumb?: readonly string[];
  readonly breadcrumbIcon?: string;
}
