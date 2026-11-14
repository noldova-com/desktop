/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DesktopProtocolException } from "../../exceptions/desktop-protocol.exception.js";
import { Resources } from "../../resources.js";

export class UnansweredCallException extends DesktopProtocolException {
  public readonly member: string;

  public constructor(member: string) {
    super(Resources.formatUnansweredCall(member));

    this.member = member;
  }
}
