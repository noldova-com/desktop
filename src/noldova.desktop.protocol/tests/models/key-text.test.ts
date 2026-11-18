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
import { KeyText } from "@noldova/desktop.protocol";

@TestClass
export class KeyTextTests {
  @TestMethod
  public showsATokenInMacOsFormInWords(): void {
    Assert.areEqual("Send with Cmd+Enter", KeyText.format("Send with {key:Mod+Enter}", "darwin"));
    Assert.areEqual("Option+Enter adds a line; Cmd+Enter sends.", KeyText.format("{key:Alt+Enter} adds a line; {key:Mod+Enter} sends.", "darwin"));
    Assert.areEqual("Control+Option+Shift+Cmd+K", KeyText.format("{key:Shift+Mod+Alt+Ctrl+K}", "darwin"));
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
      Assert.areEqual(text, KeyText.format(text, "darwin"), text);
      KeyText.check(text, "title");
    }
  }

  @TestMethod
  public refusesATokenThatIsNotAKeyNamingTheField(): void {
    for (const [text, chord] of [["Send with {key:Mod+Entr}", "Mod+Entr"], ["{key:}", String.empty], ["Fine {key:Mod+K}, wrong {key:Cmd+K}", "Cmd+K"]] as const) {
      const exception = Assert.throws(() => KeyText.check(text, "description"), ArgumentException, text);
      Assert.areEqual("description", exception.parameterName);
      Assert.isTrue(exception.message.startsWith(`"${chord}" is not a key.`), exception.message);
    }
    const ambiguous = Assert.throws(() => KeyText.check("{key:Mod+Ctrl+K}", "title"), ArgumentException);
    Assert.areEqual("title", ambiguous.parameterName);
    KeyText.check("{key:Mod+K} and {key:Shift+F2}", "title");
  }
}
