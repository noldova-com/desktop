/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ToolContent, ToolContentKind } from "@noldova/desktop.runtime";

@TestClass
export class ToolContentTests {
  @TestMethod
  public marksTextFromOutsideTheModuleWithItsOrigin(): void {
    const own = ToolContent.fromText("Saved.", null);
    const page = ToolContent.fromText("A page.", "https://example.com");

    Assert.areEqual(ToolContentKind.Text, own.kind);
    Assert.isFalse(own.isUntrusted);
    Assert.isNull(own.mimeType);
    Assert.areEqual("{\"kind\":\"Text\",\"text\":\"Saved.\",\"isUntrusted\":false}", JSON.stringify(own.toJson()));
    Assert.isTrue(page.isUntrusted);
    Assert.areEqual("{\"kind\":\"Text\",\"text\":\"A page.\",\"isUntrusted\":true,\"origin\":\"https://example.com\"}", JSON.stringify(page.toJson()));
  }

  @TestMethod
  public holdsAPngOrJpegImageAsBase64(): void {
    const png = ToolContent.fromImage("iVBORw==", "image/png", "notes:import");
    const jpeg = ToolContent.fromImage("/9g=", "image/jpeg", null);

    Assert.areEqual("{\"kind\":\"Image\",\"data\":\"iVBORw==\",\"mimeType\":\"image/png\",\"isUntrusted\":true,\"origin\":\"notes:import\"}", JSON.stringify(png.toJson()));
    Assert.areEqual("image/jpeg", jpeg.mimeType);
    Assert.areEqual("/9g=", jpeg.value);
  }

  @TestMethod
  public refusesAnImageOfAnotherTypeOrNotInBase64(): void {
    const gif = Assert.throws(() => ToolContent.fromImage("R0lG", "image/gif", null), ArgumentException);
    const data = Assert.throws(() => ToolContent.fromImage("not base64!", "image/png", null), ArgumentException);

    Assert.areEqual("mimeType", gif.parameterName);
    Assert.areEqual("data", data.parameterName);
  }

  @TestMethod
  @TestData(" ")
  @TestData("x".repeat(1025))
  public refusesABlankOrLongOrigin(origin: string): void {
    const exception = Assert.throws(() => ToolContent.fromText("A page.", origin), ArgumentException);

    Assert.areEqual("origin", exception.parameterName);
  }

  @TestMethod
  public refusesTextThatIsNotAString(): void {
    Assert.areEqual("text", Assert.throws(() => ToolContent.fromText(JSON.parse("null"), null), ArgumentException).parameterName);
  }

  @TestMethod
  public refusesAnOriginThatIsNotAString(): void {
    Assert.areEqual("origin", Assert.throws(() => ToolContent.fromText("A page.", JSON.parse("42")), ArgumentException).parameterName);
    Assert.areEqual("origin", Assert.throws(() => ToolContent.fromImage("aGk=", "image/png", JSON.parse("42")), ArgumentException).parameterName);
  }

  @TestMethod
  public acceptsAnOriginOfTheLongestLength(): void {
    Assert.isTrue(ToolContent.fromText("A page.", "x".repeat(1024)).isUntrusted);
  }
}
