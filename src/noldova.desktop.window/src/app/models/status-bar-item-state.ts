/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { QualifiedName } from "@noldova/desktop.protocol";

import { StatusBarItemTone } from "../enums/status-bar-item-tone.js";
import type { IStatusBarItemOptions } from "../interfaces/i-status-bar-item-options.js";
import { Resources } from "../../resources.js";

export class StatusBarItemState {
  public readonly text: string;
  public readonly icon: string | null;
  public readonly tooltip: string | null;
  public readonly command: string | null;
  public readonly commandArguments: JsonValue;
  public readonly isHidden: boolean;
  public readonly tone: StatusBarItemTone;

  public constructor(text: string, options: IStatusBarItemOptions = {}) {
    if (!Object.isUndefined(options.icon))
      ArgumentException.throwIfNullOrWhitespace(options.icon, Resources.iconParameter);
    if (!Object.isUndefined(options.tooltip))
      ArgumentException.throwIfNullOrWhitespace(options.tooltip, Resources.tooltipParameter);
    const isHidden = options.isHidden ?? false;
    if (!isHidden && String.isNullOrWhitespace(text) && Object.isUndefined(options.icon))
      throw new ArgumentException(Resources.statusBarItemEmpty, Resources.textParameter);
    if (!isHidden && String.isNullOrWhitespace(text) && Object.isUndefined(options.tooltip))
      throw new ArgumentException(Resources.statusBarItemUnnamed, Resources.tooltipParameter);

    this.text = text;
    this.icon = options.icon ?? null;
    this.tooltip = options.tooltip ?? null;
    this.command = Object.isUndefined(options.command) ? null : QualifiedName.parse(options.command, Resources.commandParameter).text;
    this.commandArguments = options.commandArguments ?? null;
    this.isHidden = isHidden;
    this.tone = options.tone ?? StatusBarItemTone.Neutral;
  }

  public get label(): string {
    return this.tooltip ?? this.text;
  }
}
