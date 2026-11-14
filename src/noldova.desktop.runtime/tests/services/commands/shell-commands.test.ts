/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { KeyChord } from "@noldova/desktop.protocol";
import { ShellCommands } from "@noldova/desktop.runtime";

@TestClass
export class ShellCommandsTests {
  @TestMethod
  public namesTheAgentControlCommandsAndTheStopKey(): void {
    Assert.areEqual("desktop.stopAgentControl,desktop.resumeAgentControl", [ShellCommands.stopAgentControl.text, ShellCommands.resumeAgentControl.text].join(","));
    Assert.areEqual("Mod+Shift+Period", KeyChord.parseDefault(ShellCommands.stopAgentControlKey).text);
  }
}
