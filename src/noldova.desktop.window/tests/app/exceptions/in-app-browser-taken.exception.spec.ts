/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { InAppBrowserTakenException } from "../../../src/app/exceptions/in-app-browser-taken.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("InAppBrowserTakenException", () => {
  it("is a window exception with its own name and message", () => {
    const exception = new InAppBrowserTakenException();

    expect([exception instanceof WindowException, exception instanceof Exception, exception.name, exception.message])
      .toEqual([true, true, "InAppBrowserTakenException", "Another window part is already the in-app browser."]);
  });
});
