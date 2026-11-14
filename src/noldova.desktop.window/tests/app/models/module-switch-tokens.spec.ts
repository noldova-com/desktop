/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModuleSwitchTokens } from "../../../src/app/models/module-switch-tokens";

describe("ModuleSwitchTokens", () => {
  it("names the token of what saves a module's parts before it turns off", () => {
    expect(ModuleSwitchTokens.saver.toString()).toContain("What saves a module's parts before it turns off");
  });
});
