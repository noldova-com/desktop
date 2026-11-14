/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FileGrant } from "@noldova/desktop.protocol";

export interface IIssuedGrant {
  readonly connection: number;
  readonly file: FileGrant;
  readonly expires: number;
  readonly isShared: boolean;
}
