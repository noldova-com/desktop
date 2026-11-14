/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { ProtocolException } from "../exceptions/protocol.exception.js";
import { Resources } from "../resources.js";

export class FrameReader {
  private readonly maximumFrameLength: number;
  private readonly parts: string[] = [];
  private pendingLength: number = 0;

  public constructor(maximumFrameLength: number = Resources.defaultMaximumFrameLength) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumFrameLength, Resources.maximumFrameLengthParameterName, Resources.maximumFrameLengthInvalid);

    this.maximumFrameLength = maximumFrameLength;
  }

  public read(chunk: string): string[] {
    const frames: string[] = [];
    let start = 0;
    let delimiterIndex = chunk.indexOf(Resources.frameDelimiter);
    while (delimiterIndex >= 0) {
      this.requireWithinLimit(this.pendingLength + delimiterIndex - start);
      this.parts.push(chunk.slice(start, delimiterIndex));
      const frame = this.parts.join(String.empty);
      this.parts.length = 0;
      this.pendingLength = 0;
      if (!String.isNullOrWhitespace(frame))
        frames.push(frame);
      start = delimiterIndex + 1;
      delimiterIndex = chunk.indexOf(Resources.frameDelimiter, start);
    }

    this.requireWithinLimit(this.pendingLength + chunk.length - start);
    if (start < chunk.length) {
      this.parts.push(chunk.slice(start));
      this.pendingLength += chunk.length - start;
    }

    return frames;
  }

  private requireWithinLimit(length: number): void {
    if (length > this.maximumFrameLength)
      throw new ProtocolException(this.maximumFrameLength);
  }
}
