/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import type { TextRange } from "./text-range.js";
import { Resources } from "../../resources.js";

export class SearchResult {
  public readonly id: string;
  public readonly title: string;
  public readonly detail: string;
  public readonly openAsync: () => Promise<void>;
  public readonly titleMatch: TextRange | null;
  public readonly detailMatch: TextRange | null;
  public readonly keyLabel: string | null;

  public constructor(id: string, title: string, detail: string, openAsync: () => Promise<void>, titleMatch: TextRange | null = null, detailMatch: TextRange | null = null,
    keyLabel: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idParameter);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);
    SearchResult.requireWithin(titleMatch, title, Resources.titleMatchParameter);
    SearchResult.requireWithin(detailMatch, detail, Resources.detailMatchParameter);
    if (!Object.isNull(keyLabel))
      ArgumentException.throwIfNullOrWhitespace(keyLabel, Resources.keyLabelParameter);

    this.id = id;
    this.title = title;
    this.detail = detail;
    this.openAsync = openAsync;
    this.titleMatch = titleMatch;
    this.detailMatch = detailMatch;
    this.keyLabel = keyLabel;
  }

  private static requireWithin(range: TextRange | null, text: string, parameter: string): void {
    if (!Object.isNull(range) && range.end > text.length)
      throw new ArgumentOutOfRangeException(parameter, range.end, Resources.textRangeOutside);
  }
}
