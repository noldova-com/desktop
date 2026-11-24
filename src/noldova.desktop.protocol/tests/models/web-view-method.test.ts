/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewMethod, WebViewParameter } from "@noldova/desktop.protocol";

@TestClass
export class WebViewMethodTests {
  @TestMethod
  public pinsItsWireFormWithParametersOnlyWhenItHasThem(): void {
    const full = "{\"name\":\"Page.captureScreenshot\",\"parameters\":{\"format\":{\"values\":[\"png\"]},\"clip\":{\"fields\":{\"width\":{\"maximum\":4096}}}}}";

    Assert.areEqual(full, JSON.stringify(WebViewMethod.fromJson(JsonReader.parse(full).toJson()).toJson()));
    Assert.areEqual("{\"name\":\"Page.enable\"}", JSON.stringify(new WebViewMethod("Page.enable").toJson()));
    Assert.areEqual("{\"name\":\"Page.enable\"}", JSON.stringify(WebViewMethod.fromJson({ name: "Page.enable", parameters: {} }).toJson()));
  }

  @TestMethod
  public allowsOnlyTheDeclaredParametersAsTheirRulesSay(): void {
    const method = new WebViewMethod("Page.handleJavaScriptDialog", new Map([
      ["accept", new WebViewParameter(true, [false])],
      ["promptText", new WebViewParameter(false, null, null, null, 100)]
    ]));

    Assert.isTrue(method.allows({ accept: false }));
    Assert.isTrue(method.allows({ accept: false, promptText: String.empty }));
    Assert.isFalse(method.allows({ accept: true }));
    Assert.isFalse(method.allows({}));
    Assert.isFalse(method.allows({ accept: false, other: 1 }));
    Assert.isFalse(method.allows(undefined));
    Assert.isTrue(new WebViewMethod("Page.enable").allows({}));
    Assert.isFalse(new WebViewMethod("Page.enable").allows({ enableFileChooserOpenedEvent: true }));
  }

  @TestMethod
  public refusesMethodsThatLoadADocumentOrUndoTheHostsHold(): void {
    for (const name of ["Page.navigate", "Page.navigateToHistoryEntry", "Page.reload", "Page.setDocumentContent", "Page.resetNavigationHistory", "Page.setInterceptFileChooserDialog", "Page.disable",
      "Page.setDownloadBehavior", "Page.close", "Page.crash", "Network.setRequestInterception", "Network.continueInterceptedRequest", "DOM.setFileInputFiles", "Input.dispatchDragEvent", "Input.setInterceptDrags", "DOM.getFileInfo", "Target.createTarget", "Target.attachToTarget", "Browser.setDownloadBehavior",
      "Fetch.enable", "Security.setIgnoreCertificateErrors"]) {
      Assert.isTrue(WebViewMethod.isRefused(name));
      Assert.isTrue(Assert.throws(() => new WebViewMethod(name), ArgumentException).message.startsWith(`${name} is refused in a web view`));
    }
    for (const name of ["Page.enable", "Page.captureScreenshot", "Network.enable", "Input.dispatchKeyEvent", "Targets.list"])
      Assert.isFalse(WebViewMethod.isRefused(name));
  }

  @TestMethod
  public refusesANameThatIsNotAMethod(): void {
    for (const name of ["page.enable", "Page", "Page.", "Page.Enable", "Page.enable.now", "Page.en-able", String.empty])
      Assert.areEqual("name", Assert.throws(() => new WebViewMethod(name), ArgumentException).parameterName);
    Assert.areEqual("parameters.Format", Assert.throws(() => new WebViewMethod("Page.enable", new Map([["Format", new WebViewParameter()]])), ArgumentException).parameterName);
  }

  @TestMethod
  public namesThePathThatIsInvalid(): void {
    Assert.areEqual("$.name", Assert.throws(() => WebViewMethod.fromJson({ name: "Page.navigate" }), JsonException).path);
    Assert.areEqual("$.params", Assert.throws(() => WebViewMethod.fromJson({ name: "Page.enable", params: {} }), JsonException).path);
    Assert.areEqual("$.parameters.format.value", Assert.throws(() => WebViewMethod.fromJson({ name: "Page.enable", parameters: { format: { value: "png" } } }), JsonException).path);
  }
}
