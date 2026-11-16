/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import type { SearchResult } from "./search-result.js";
import { Resources } from "../../resources.js";

export class SearchAnswer {
  public readonly results: readonly SearchResult[];
  public readonly total: number;
  public readonly isCapped: boolean;

  public constructor(results: readonly SearchResult[], total: number = results.length, isCapped: boolean = false) {
    if (!Number.isSafeInteger(total) || total < results.length)
      throw new ArgumentOutOfRangeException(Resources.totalParameter, total, Resources.searchTotalInvalid);

    this.results = [...results];
    this.total = total;
    this.isCapped = isCapped;
  }
}
