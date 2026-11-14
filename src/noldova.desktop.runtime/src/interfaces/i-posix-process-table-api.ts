/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPosixProcessTableApi {
  listProcessesAsync(): Promise<readonly (readonly [number, number, number, number, number, number?])[]>;
}
