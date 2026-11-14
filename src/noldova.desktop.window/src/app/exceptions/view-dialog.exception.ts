/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ViewDialogRefusal } from "../enums/view-dialog-refusal.js";
import { Resources } from "../../resources.js";
import { WindowException } from "./window.exception.js";

export class ViewDialogException extends WindowException {
  public override readonly name: string = "ViewDialogException";
  public readonly refusal: ViewDialogRefusal;

  public constructor(refusal: ViewDialogRefusal) {
    super(ViewDialogException.describe(refusal));

    this.refusal = refusal;
  }

  private static describe(refusal: ViewDialogRefusal): string {
    switch (refusal) {
      case ViewDialogRefusal.AlreadyOpen:
        return Resources.dialogAlreadyOpen;
      default:
        return Resources.dialogWhileReconnecting;
    }
  }
}
