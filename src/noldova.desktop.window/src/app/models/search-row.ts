/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SearchResult } from "./search-result.js";
import type { SearchSourceContribution } from "./search-source-contribution.js";
import { Resources } from "../../resources.js";

export class SearchRow {
  public readonly source: SearchSourceContribution;
  public readonly result: SearchResult;

  public constructor(source: SearchSourceContribution, result: SearchResult) {
    this.source = source;
    this.result = result;
  }

  public get id(): string {
    return Resources.formatSearchRowId(this.source.name, this.result.id);
  }
}
