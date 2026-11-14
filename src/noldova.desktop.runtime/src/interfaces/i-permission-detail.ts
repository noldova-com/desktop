/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionDetailKind } from "../enums/permission-detail-kind.js";

export interface IPermissionDetail {
  readonly label: string;
  readonly kind: PermissionDetailKind;
  readonly value: string;
}
