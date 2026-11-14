/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as published from "@noldova/desktop.window/testing";

import * as testing from "../../src/api/testing";

describe("the window's testing entry", () => {
  it("publishes the fakes of the context the window hands a module's window part", () => {
    expect(Object.values(published)).toEqual(Object.values(testing));
    expect(Object.keys(testing).sort()).toEqual(["FakeWindowPartContext", "FakeWindowSecrets", "FakeWindowWebViews"]);
  });
});
