/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import type { SearchAnswer } from "./search-answer.js";
import type { SearchResult } from "./search-result.js";
import { Resources } from "../../resources.js";

export class SearchSourceContribution {
  public readonly name: string;
  public readonly label: string;
  public readonly placeholderName: string;
  public readonly heading: string;
  public readonly recentHeading: string | null;
  public readonly icon: string;
  public readonly recentAsync: (signal: AbortSignal) => Promise<readonly SearchResult[]>;
  public readonly searchAsync: (query: string, signal: AbortSignal) => Promise<SearchAnswer>;

  public constructor(name: string, label: string, placeholderName: string, heading: string, recentHeading: string | null, icon: string,
    recentAsync: (signal: AbortSignal) => Promise<readonly SearchResult[]>, searchAsync: (query: string, signal: AbortSignal) => Promise<SearchAnswer>) {
    if (!Resources.contributionNamePattern.test(name))
      throw new ArgumentException(Resources.invalidContributionName, Resources.nameParameter);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelParameter);
    ArgumentException.throwIfNullOrWhitespace(placeholderName, Resources.placeholderNameParameter);
    ArgumentException.throwIfNullOrWhitespace(heading, Resources.headingParameter);
    if (!Object.isNull(recentHeading))
      ArgumentException.throwIfNullOrWhitespace(recentHeading, Resources.recentHeadingParameter);
    ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameter);

    this.name = name;
    this.label = label;
    this.placeholderName = placeholderName;
    this.heading = heading;
    this.recentHeading = recentHeading;
    this.icon = icon;
    this.recentAsync = recentAsync;
    this.searchAsync = searchAsync;
  }
}
