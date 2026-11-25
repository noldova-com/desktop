/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { UndoProviderTakenException } from "../../../src/app/exceptions/undo-provider-taken.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("UndoProviderTakenException", () => {
  it("is a window exception with its own name and message", () => {
    const exception = new UndoProviderTakenException();

    expect([exception instanceof WindowException, exception instanceof Exception, exception.name, exception.message])
      .toEqual([true, true, "UndoProviderTakenException", "Another window part already provides Undo in this window."]);
  });
});
