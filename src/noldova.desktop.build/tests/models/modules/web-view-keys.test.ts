/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { WebViewKeys } from "../../../src/models/modules/web-view-keys.js";

@TestClass
export class WebViewKeysTests {
  @TestMethod
  @TestData("Mod+Shift+R", "Ctrl+Shift+R", "Mod+Shift+R")
  @TestData("Ctrl+Alt+F5", "Ctrl+Alt+F5", "Ctrl+Alt+F5")
  @TestData("Shift+Mod+R", "Ctrl+Shift+R", "Mod+Shift+R")
  @TestData("F2", "F2", "F2")
  public writesAKeyInEachPlatformsForm(text: string, standard: string, mac: string): void {
    Assert.areEqual(standard, WebViewKeys.formOn(text, false));
    Assert.areEqual(mac, WebViewKeys.formOn(text, true));
  }

  @TestMethod
  @TestData("Mod+Nope")
  @TestData("Mod+Mod+R")
  @TestData("Hyper+R")
  @TestData("Mod+Ctrl+R")
  public refusesAKeyThatIsNotWellFormed(text: string): void {
    Assert.isNull(WebViewKeys.formOn(text, false));
    Assert.isNull(WebViewKeys.formOn(text, true));
  }

  @TestMethod
  public takesAKeyWithoutAControlKeyOtherThanAFunctionKeyAsTyping(): void {
    Assert.areEqual("true,true,false,false,false,false", ["R", "Shift+R", "Ctrl+R", "Mod+R", "Alt+R", "F5"].map(t => WebViewKeys.isTyping(t)).join(","));
  }

  @TestMethod
  public refusesTheEditingSystemAndShellKeysOfEachPlatform(): void {
    const standard = WebViewKeys.refusedOn(false);
    const mac = WebViewKeys.refusedOn(true);

    Assert.isTrue(standard.includes("Ctrl+C") && standard.includes("Alt+F4") && standard.includes("Alt+ArrowLeft") && standard.includes("Ctrl+Shift+Period"), standard.join(" "));
    Assert.isTrue(mac.includes("Mod+C") && mac.includes("Mod+Q") && mac.includes("Mod+BracketLeft") && mac.includes("Mod+Shift+Period"), mac.join(" "));
    Assert.isFalse(mac.includes("Alt+F4"));
  }
}
