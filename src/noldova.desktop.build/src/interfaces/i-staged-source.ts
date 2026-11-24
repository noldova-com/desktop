/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SourceArchive } from "../models/packaging/source-archive.ts";

export interface IStagedSource {
  readonly id: string;
  readonly license: string;
  readonly archive: SourceArchive;
}
