/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ResponseBody } from "../../src/models/response-body.js";

@TestClass
export class ResponseBodyTests {
  @TestMethod
  public async cancelsABodyAndLetsGoOfOneWhoseCancelFailsOrOfNone(): Promise<void> {
    const cancelled: string[] = [];
    const outcome = (response: { readonly body?: { cancel(): Promise<void> } | null }): Promise<string> =>
      ResponseBody.letGoAsync(response).then(() => "let go", (error: unknown) => String(error));

    const results = [
      await outcome({ body: { cancel: () => {
        cancelled.push("open");
        return Promise.resolve();
      } } }),
      await outcome({ body: { cancel: () => {
        cancelled.push("locked");
        return Promise.reject(new TypeError("The stream is locked."));
      } } }),
      await outcome({ body: null }),
      await outcome({})
    ];

    Assert.areEqual("let go|let go|let go|let go", results.join("|"));
    Assert.areEqual("open|locked", cancelled.join("|"));
  }
}
