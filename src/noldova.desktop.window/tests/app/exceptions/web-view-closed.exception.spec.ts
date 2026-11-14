/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { WebViewClosedException } from "../../../src/app/exceptions/web-view-closed.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("WebViewClosedException", () => {
  it("is a window exception with its own name and message", () => {
    const exception = new WebViewClosedException();

    expect([exception instanceof WindowException, exception instanceof Exception, exception.name, exception.message])
      .toEqual([true, true, "WebViewClosedException", "The web view is closed."]);
  });
});
