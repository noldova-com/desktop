/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { PreloadBridgeException } from "../../../src/app/exceptions/preload-bridge.exception";

describe("PreloadBridgeException", () => {
  it("is an exception with its message", () => {
    const exception = new PreloadBridgeException();

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("The window needs the main process's bridge, which the preload provides.");
  });
});
