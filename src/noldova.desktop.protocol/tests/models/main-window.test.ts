/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MainWindow } from "@noldova/desktop.protocol";

@TestClass
export class MainWindowTests {
  @TestMethod
  public carriesTheTitleAndWhetherItIsShownAndPaintedThroughTheWire(): void {
    const window = new MainWindow("Notes", false, true);

    const copy = MainWindow.fromJson(JsonReader.parse(JSON.stringify(window.toJson())).toJson());

    Assert.areEqual(JSON.stringify({ title: "Notes", isVisible: false, isPainted: true }), JSON.stringify(window.toJson()));
    Assert.areEqual("Notes false true", `${copy.title} ${String(copy.isVisible)} ${String(copy.isPainted)}`);
  }

  @TestMethod
  public namesTheFieldThatIsMissingInvalidOrUnknown(): void {
    Assert.areEqual("$.title", Assert.throws(() => MainWindow.fromJson({ isVisible: true, isPainted: true }), JsonException).path);
    Assert.areEqual("$.title", Assert.throws(() => MainWindow.fromJson({ title: 7, isVisible: true, isPainted: true }), JsonException).path);
    Assert.areEqual("$.isVisible", Assert.throws(() => MainWindow.fromJson({ title: "Notes", isVisible: "yes", isPainted: true }), JsonException).path);
    Assert.areEqual("$.isPainted", Assert.throws(() => MainWindow.fromJson({ title: "Notes", isVisible: true }), JsonException).path);
    Assert.areEqual("$.isPainted", Assert.throws(() => MainWindow.fromJson({ title: "Notes", isVisible: true, isPainted: "yes" }), JsonException).path);
    Assert.areEqual("$.handle", Assert.throws(() => MainWindow.fromJson({ title: "Notes", isVisible: true, isPainted: true, handle: 1 }), JsonException).path);
  }
}
