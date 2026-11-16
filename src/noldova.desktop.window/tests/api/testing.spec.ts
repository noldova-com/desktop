/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import * as published from "@noldova/desktop.window/testing";

import * as testing from "../../src/api/testing";

describe("the window's testing entry", () => {
  it("publishes the fakes of the context the window hands a module's window part", () => {
    expect(Object.values(published)).toEqual(Object.values(testing));
    expect(Object.keys(testing).sort()).toEqual(["FakeWindowPartContext", "FakeWindowSecrets", "FakeWindowWebViews"]);
  });

  it("rejects a fake request with the window's request failure, its code and details", async () => {
    const context = new published.FakeWindowPartContext();
    context.answer("requestAsync", () => Promise.reject(new RuntimeRequestException(FailureCode.NotFound, "There is no such note.", { path: "/notes/a.md" })));

    const failure = await context.requestAsync("notes.open", { path: "/notes/a.md" }).catch((error: unknown) => error);

    expect(failure instanceof RuntimeRequestException && [failure.code, failure.message, failure.details]).toEqual([FailureCode.NotFound, "There is no such note.", { path: "/notes/a.md" }]);
  });
});
