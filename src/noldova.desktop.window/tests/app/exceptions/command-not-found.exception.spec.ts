/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { CommandNotFoundException } from "../../../src/app/exceptions/command-not-found.exception";

describe("CommandNotFoundException", () => {
  it("is an exception with its message", () => {
    const exception = new CommandNotFoundException("notes.missing");

    expect(exception).toBeInstanceOf(Exception);
    expect([exception.message, exception.commandName])
      .toEqual(["No command named notes.missing is registered; its module may not be active.", "notes.missing"]);
  });
});
