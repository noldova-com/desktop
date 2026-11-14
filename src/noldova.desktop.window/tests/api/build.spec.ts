/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowApplication, WindowPartSource } from "@noldova/desktop.window/build";

import { WindowApplication as SourceWindowApplication } from "../../src/app/models/window-application";
import { WindowPartSource as SourceWindowPartSource } from "../../src/app/models/window-part-source";

describe("the window's build entry", () => {
  it("publishes what the app's entry starts the window with and what the build's generated window parts are made of", () => {
    expect([WindowApplication, WindowPartSource]).toEqual([SourceWindowApplication, SourceWindowPartSource]);
  });
});
