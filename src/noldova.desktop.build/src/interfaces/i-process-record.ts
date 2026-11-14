/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IProcessRecord {
  readonly id: number;
  readonly parent: number;
  readonly type: string | null;
  readonly seccomp: number;
  readonly arguments: readonly string[];
}
