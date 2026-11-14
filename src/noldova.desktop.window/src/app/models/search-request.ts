/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class SearchRequest {
  public static readonly plain: SearchRequest = new SearchRequest(String.empty, null);
  public static readonly commands: SearchRequest = new SearchRequest(Resources.commandsOnlyPrefix, null);

  public readonly query: string;
  public readonly source: string | null;

  public constructor(query: string, source: string | null) {
    this.query = query;
    this.source = source;
  }
}
