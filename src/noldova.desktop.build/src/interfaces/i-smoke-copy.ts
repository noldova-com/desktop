/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IKilledCopySession } from "./i-killed-copy-session.ts";

export interface ISmokeCopy {
  readonly items: readonly string[];
  isPresentAsync(): Promise<boolean>;
  requireOutlivesAsync(runtime: number, moment: string): Promise<void>;
  checkKilledAsync(session: IKilledCopySession): Promise<void>;
}
