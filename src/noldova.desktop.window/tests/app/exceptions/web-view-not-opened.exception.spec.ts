/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { WebViewNotOpenedException } from "../../../src/app/exceptions/web-view-not-opened.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("WebViewNotOpenedException", () => {
  it("is a window exception with its own name and message", () => {
    const exception = new WebViewNotOpenedException();

    expect([exception instanceof WindowException, exception instanceof Exception, exception.name, exception.message])
      .toEqual([true, true, "WebViewNotOpenedException", "The web view was not opened: its module declares no webViews.json, its pane is not open or holds as many views as it may, or its profile key is not valid."]);
  });
});
