/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { ViewDialogRefusal } from "../../../src/app/enums/view-dialog-refusal";
import { ViewDialogException } from "../../../src/app/exceptions/view-dialog.exception";

describe("ViewDialogException", () => {
  it("is an exception with its refusal and the message for it", () => {
    const exceptions = [new ViewDialogException(ViewDialogRefusal.AlreadyOpen), new ViewDialogException(ViewDialogRefusal.Reconnecting)];

    expect(exceptions.map(t => [t instanceof Exception, t.refusal, t.message])).toEqual([
      [true, ViewDialogRefusal.AlreadyOpen, "A dialog is already open."],
      [true, ViewDialogRefusal.Reconnecting, "A dialog can't open while the window reconnects to the runtime."]
    ]);
  });
});
