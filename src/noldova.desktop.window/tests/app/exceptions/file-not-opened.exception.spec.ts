/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { FileNotOpenedException } from "../../../src/app/exceptions/file-not-opened.exception";
import { WindowException } from "../../../src/app/exceptions/window.exception";

describe("FileNotOpenedException", () => {
  it("is a window exception with its own name and message", () => {
    const exception = new FileNotOpenedException("Sample App", "No app opens .md files.");

    expect([exception instanceof WindowException, exception instanceof Exception, exception.name, exception.message, exception.reason])
      .toEqual([true, true, "FileNotOpenedException", "Sample App didn't open the file: No app opens .md files.", "No app opens .md files."]);
  });
});
