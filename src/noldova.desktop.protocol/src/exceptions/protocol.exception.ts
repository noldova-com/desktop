/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { FailureCode } from "../enums/failure-code.js";
import { Resources } from "../resources.js";
import { DesktopProtocolException } from "./desktop-protocol.exception.js";

export class ProtocolException extends DesktopProtocolException {
  public readonly code: FailureCode;
  public readonly maximumFrameLength: number;

  public constructor(maximumFrameLength: number, options?: ExceptionOptions) {
    super(Resources.formatFrameTooLarge(maximumFrameLength), options);

    this.code = FailureCode.FrameTooLarge;
    this.maximumFrameLength = maximumFrameLength;
  }
}
