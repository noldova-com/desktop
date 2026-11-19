/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { KeyText } from "@noldova/desktop.protocol";

@TestClass
export class KeyTextTests {
  @TestMethod
  public showsATokenInMacOsFormInWords(): void {
    Assert.areEqual("Send with Cmd+Enter", KeyText.format("Send with {key:Mod+Enter}", "darwin"));
    Assert.areEqual("Option+Enter adds a line; Cmd+Enter sends.", KeyText.format("{key:Alt+Enter} adds a line; {key:Mod+Enter} sends.", "darwin"));
    Assert.areEqual("Option+Shift+Cmd+K|Control+Option+Shift+K", KeyText.format("{key:Shift+Mod+Alt+K}|{key:Shift+Alt+Ctrl+K}", "darwin"));
    Assert.areEqual("Control+F2|Shift+Esc|F2", KeyText.format("{key:Ctrl+F2}|{key:Shift+Escape}|{key:F2}", "darwin"));
  }

  @TestMethod
  public showsATokenInTheFormOfWindowsAndLinux(): void {
    for (const platform of ["win32", "linux"]) {
      Assert.areEqual("Send with Ctrl+Enter", KeyText.format("Send with {key:Mod+Enter}", platform), platform);
      Assert.areEqual("Alt+Enter adds a line; Ctrl+Enter sends.", KeyText.format("{key:Alt+Enter} adds a line; {key:Mod+Enter} sends.", platform), platform);
      Assert.areEqual("Ctrl+Alt+Shift+K", KeyText.format("{key:Shift+Alt+Mod+K}", platform), platform);
    }
  }

  @TestMethod
  public leavesTextWithoutATokenAsItIs(): void {
    for (const text of ["Ctrl+Enter sends.", "{Mod+Enter}", "{key:Mod+Enter", "key:Mod+Enter}", "{Key:Mod+Enter}", String.empty]) {
      for (const platform of ["darwin", "win32", "linux"])
        Assert.areEqual(text, KeyText.format(text, platform), `${platform}: ${text}`);
    }
  }

  @TestMethod
  public showsATokenThatNamesNoKeyAsWritten(): void {
    for (const platform of ["darwin", "win32", "linux"]) {
      Assert.areEqual("Send with {key:Mod+Entr}", KeyText.format("Send with {key:Mod+Entr}", platform), platform);
      Assert.areEqual("{key:} and {key:Mod+Ctrl+K}", KeyText.format("{key:} and {key:Mod+Ctrl+K}", platform), platform);
    }
    Assert.areEqual("Fine Cmd+K, wrong {key:Cmd+K}", KeyText.format("Fine {key:Mod+K}, wrong {key:Cmd+K}", "darwin"));
    Assert.areEqual("Fine Ctrl+K, wrong {key:Cmd+K}", KeyText.format("Fine {key:Mod+K}, wrong {key:Cmd+K}", "win32"));
  }
}
