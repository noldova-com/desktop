/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { InstalledPackage } from "../models/packaging/installed-package.ts";

export interface ISystemInstall {
  readonly packageName: string;
  readonly installed: InstalledPackage;
  verifyAsync(): Promise<string>;
  removeAsync(): Promise<string>;
}
