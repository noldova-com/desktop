/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { Resources } from "../../resources.js";

export class TextRange {
  public readonly start: number;
  public readonly length: number;

  public constructor(start: number, length: number) {
    if (!Number.isSafeInteger(start) || start < 0)
      throw new ArgumentOutOfRangeException(Resources.startParameter, start, Resources.textRangeStartInvalid);
    if (!Number.isSafeInteger(length) || length < 1)
      throw new ArgumentOutOfRangeException(Resources.lengthParameter, length, Resources.textRangeLengthInvalid);

    this.start = start;
    this.length = length;
  }

  public get end(): number {
    return this.start + this.length;
  }
}
