/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PackageTarget } from "../models/packaging/package-target.ts";
import type { SourceArchive } from "../models/packaging/source-archive.ts";

export interface IVerifiedReports {
  readonly text: string;
  readonly unstarted: readonly PackageTarget[];
  readonly sources: readonly SourceArchive[];
}
