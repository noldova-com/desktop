/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { UnconfirmedAction } from "../enums/unconfirmed-action.js";
import { Resources } from "../../resources.js";
import { RuntimeDisconnectedException } from "./runtime-disconnected.exception.js";
import { WindowException } from "./window.exception.js";

export class ActionNotConfirmedException extends WindowException {
  public override readonly name: string = "ActionNotConfirmedException";
  public readonly action: UnconfirmedAction;
  public readonly subject: string | null;

  public constructor(action: UnconfirmedAction, subject: string | null, cause: unknown) {
    super(ActionNotConfirmedException.describe(action, subject ?? String.empty), new ExceptionOptions(cause));

    this.action = action;
    this.subject = subject;
  }

  public static from(error: unknown, action: UnconfirmedAction, subject: string | null): unknown {
    return RuntimeDisconnectedException.isIn(error) ? new ActionNotConfirmedException(action, subject, error) : error;
  }

  private static describe(action: UnconfirmedAction, subject: string): string {
    switch (action) {
      case UnconfirmedAction.Command:
        return Resources.formatCommandNotFinished(subject);
      case UnconfirmedAction.Setting:
        return Resources.formatSettingNotConfirmed(subject);
      default:
        return Resources.notificationsNotConfirmed;
    }
  }
}
