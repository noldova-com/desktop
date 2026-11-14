/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RequestContext } from "@noldova/desktop.runtime";

@TestClass
export class RequestContextTests {
  @TestMethod
  public carriesTheCallerThePayloadTheSignalAndTheConnection(): void {
    const controller = new AbortController();

    const context = new RequestContext("main", { path: "notes.md" }, controller.signal, 3);

    Assert.areEqual("main", context.client);
    Assert.areEqual("{\"path\":\"notes.md\"}", JSON.stringify(context.payload));
    Assert.areEqual(controller.signal, context.signal);
    Assert.areEqual(3, context.connection);
    Assert.areEqual("null|null", `${context.window}|${context.page}`);
  }

  @TestMethod
  public carriesTheWindowAndItsPage(): void {
    const context = new RequestContext("main", null, new AbortController().signal, 3, 4, 2);

    Assert.areEqual("4|2", `${context.window}|${context.page}`);
  }

  @TestMethod
  public requiresTheCallersName(): void {
    Assert.areEqual("client", Assert.throws(() => new RequestContext(String.empty, null, new AbortController().signal, 1), ArgumentException).parameterName);
  }
}
