/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class SearchQuery {
  public static readonly empty: SearchQuery = new SearchQuery(String.empty, false);

  public readonly text: string;
  public readonly isCommandsOnly: boolean;

  private constructor(text: string, isCommandsOnly: boolean) {
    this.text = text;
    this.isCommandsOnly = isCommandsOnly;
  }

  public get isEmpty(): boolean {
    return this.text.length === 0;
  }

  public static parse(typed: string): SearchQuery {
    const trimmed = typed.trim();
    const isCommandsOnly = trimmed.startsWith(Resources.commandsOnlyPrefix);
    return new SearchQuery(isCommandsOnly ? trimmed.slice(Resources.commandsOnlyPrefix.length).trim() : trimmed, isCommandsOnly);
  }

  public equals(other: SearchQuery): boolean {
    return this.text === other.text && this.isCommandsOnly === other.isCommandsOnly;
  }
}
