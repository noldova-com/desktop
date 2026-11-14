/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { FileNotShownException } from "../../../src/app/exceptions/file-not-shown.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("FileNotShownException", () => {
  it("is a window exception with its own name and message", () => {
    const exception = new FileNotShownException("Sample App", "The file is gone.");

    expect([exception instanceof WindowException, exception instanceof Exception, exception.name, exception.message, exception.reason])
      .toEqual([true, true, "FileNotShownException", "Sample App didn't show the file in its folder: The file is gone.", "The file is gone."]);
  });
});
