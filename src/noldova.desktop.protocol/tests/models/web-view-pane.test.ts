/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";

@TestClass
export class WebViewPaneTests {
  @TestMethod
  public pinsItsWireFormWithTheInstanceOnlyWhenItHasOne(): void {
    Assert.areEqual("{\"name\":\"notes.page\",\"instance\":\"a1\"}", JSON.stringify(WebViewPane.fromJson({ name: "notes.page", instance: "a1" }).toJson()));
    Assert.areEqual("{\"name\":\"browser.pane\"}", JSON.stringify(new WebViewPane(QualifiedName.parse("browser.pane")).toJson()));
  }

  @TestMethod
  public equalsAPaneOfTheSameNameAndInstance(): void {
    const page = WebViewPane.fromJson({ name: "notes.page", instance: "a1" });

    Assert.isTrue(page.equals(WebViewPane.fromJson({ name: "notes.page", instance: "a1" })));
    Assert.isFalse(page.equals(WebViewPane.fromJson({ name: "notes.page", instance: "a2" })));
    Assert.isFalse(page.equals(WebViewPane.fromJson({ name: "notes.page" })));
  }

  @TestMethod
  public refusesABlankInstanceAndNamesTheInvalidField(): void {
    Assert.areEqual("instance", Assert.throws(() => new WebViewPane(QualifiedName.parse("notes.page"), " "), ArgumentException).parameterName);
    Assert.areEqual("$.name", Assert.throws(() => WebViewPane.fromJson({ name: "page" }), JsonException).path);
    Assert.areEqual("$.view", Assert.throws(() => WebViewPane.fromJson({ name: "notes.page", view: 1 }), JsonException).path);
  }
}
