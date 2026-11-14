/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SearchRow } from "./search-row.js";

export class SearchGroup {
  public readonly name: string;
  public readonly heading: string;
  public readonly rows: readonly SearchRow[];

  public constructor(name: string, heading: string, rows: readonly SearchRow[]) {
    this.name = name;
    this.heading = heading;
    this.rows = rows;
  }
}
