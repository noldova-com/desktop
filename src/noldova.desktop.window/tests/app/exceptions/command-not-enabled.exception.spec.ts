/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { CommandNotEnabledException } from "../../../src/app/exceptions/command-not-enabled.exception";

describe("CommandNotEnabledException", () => {
  it("is an exception with its message", () => {
    const exception = new CommandNotEnabledException("notes.archive");

    expect(exception).toBeInstanceOf(Exception);
    expect([exception.message, exception.commandName])
      .toEqual(["The command notes.archive is not enabled for these arguments.", "notes.archive"]);
  });
});
