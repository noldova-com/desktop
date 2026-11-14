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
import { KeyChord, WebViewDeclaration, WebViewKey, WebViewMethod } from "@noldova/desktop.protocol";

@TestClass
export class WebViewDeclarationTests {
  @TestMethod
  public pinsItsWireFormWithBothFields(): void {
    const full = "{\"methods\":[{\"name\":\"Page.enable\"},{\"name\":\"Page.captureScreenshot\",\"parameters\":{\"quality\":{\"minimum\":0,\"maximum\":100}}}],\"events\":[\"Page.loadEventFired\"],\"keys\":[{\"name\":\"reload\",\"keys\":[\"Mod+R\",\"F5\"],\"macKeys\":[\"Mod+R\"]}]}";

    Assert.areEqual(full, JSON.stringify(WebViewDeclaration.fromJson(JsonReader.parse(full).toJson()).toJson()));
    Assert.areEqual("{\"methods\":[],\"events\":[],\"keys\":[]}", JSON.stringify(WebViewDeclaration.fromJson({}).toJson()));
    Assert.areEqual("{\"methods\":[],\"events\":[],\"keys\":[]}", JSON.stringify(new WebViewDeclaration().toJson()));
  }

  @TestMethod
  public takesNewWindowRequestsOnlyWhenItSaysSo(): void {
    const declaration = WebViewDeclaration.fromJson({ newWindows: true });

    Assert.isTrue(declaration.newWindows);
    Assert.areEqual("{\"methods\":[],\"events\":[],\"keys\":[],\"newWindows\":true}", JSON.stringify(declaration.toJson()));
    Assert.isFalse(WebViewDeclaration.fromJson({ newWindows: false }).newWindows);
    Assert.isFalse(WebViewDeclaration.fromJson({}).newWindows);
    Assert.isFalse(new WebViewDeclaration().newWindows);
    Assert.areEqual("$.newWindows", Assert.throws(() => WebViewDeclaration.fromJson({ newWindows: "yes" }), JsonException).path);
  }

  @TestMethod
  public allowsOnlyDeclaredCallsAndEvents(): void {
    const declaration = WebViewDeclaration.fromJson({
      methods: [{ name: "Page.enable" }, { name: "Page.captureScreenshot", parameters: { quality: { maximum: 100 } } }],
      events: ["Page.loadEventFired"]
    });

    Assert.isTrue(declaration.allows("Page.enable", {}));
    Assert.isTrue(declaration.allows("Page.captureScreenshot", { quality: 100 }));
    Assert.isFalse(declaration.allows("Page.captureScreenshot", { quality: 101 }));
    Assert.isFalse(declaration.allows("Page.reload", {}));
    Assert.isFalse(declaration.allows("page.enable", {}));
    Assert.isTrue(declaration.allowsEvent("Page.loadEventFired"));
    Assert.isFalse(declaration.allowsEvent("Page.frameNavigated"));
    Assert.isFalse(new WebViewDeclaration().allows("Page.enable", {}));
  }

  @TestMethod
  public refusesRepeatedNamesAndEventsThatAreNotNames(): void {
    Assert.areEqual("methods", Assert.throws(() => new WebViewDeclaration([new WebViewMethod("Page.enable"), new WebViewMethod("Page.enable")]), ArgumentException).parameterName);
    Assert.areEqual("events", Assert.throws(() => new WebViewDeclaration([], ["Page.loadEventFired", "Page.loadEventFired"]), ArgumentException).parameterName);
    Assert.areEqual("events", Assert.throws(() => new WebViewDeclaration([], ["loadEventFired"]), ArgumentException).parameterName);
  }

  @TestMethod
  public findsTheDeclaredKeyOfAPressOnEachPlatform(): void {
    const declaration = WebViewDeclaration.fromJson({ keys: [{ name: "reload", keys: ["Mod+R", "F5"], macKeys: ["Mod+R"] }, { name: "newTab", keys: ["Mod+T"] }] });
    const press = (key: string, code: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}): { key: string; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean } =>
      ({ key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers });

    Assert.areEqual("reload", declaration.findKey(press("r", "KeyR", { ctrlKey: true }), "win32"));
    Assert.areEqual("reload", declaration.findKey(press("F5", "F5"), "linux"));
    Assert.areEqual("reload", declaration.findKey(press("r", "KeyR", { metaKey: true }), "darwin"));
    Assert.isNull(declaration.findKey(press("F5", "F5"), "darwin"));
    Assert.areEqual("newTab", declaration.findKey(press("t", "KeyT", { metaKey: true }), "darwin"));
    Assert.isNull(declaration.findKey(press("t", "KeyT"), "win32"));
    Assert.isNull(new WebViewDeclaration().findKey(press("r", "KeyR", { ctrlKey: true }), "win32"));
  }

  @TestMethod
  public refusesARepeatedKeyNameAKeyTwiceOnOnePlatformAndMoreThanThirtyTwoNames(): void {
    const key = (name: string, keys: readonly string[], macKeys: readonly string[] = keys): WebViewKey =>
      new WebViewKey(name, keys.map(t => KeyChord.parse(t)), macKeys.map(t => KeyChord.parse(t)));
    const many = [...Array.from({ length: 24 }, (_, index) => `F${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `Mod+Shift+F${index + 1}`)]
      .map((t, index) => key(`key${index}`, [t]));

    Assert.areEqual("keys", Assert.throws(() => new WebViewDeclaration([], [], [key("reload", ["Mod+R"]), key("reload", ["F5"])]), ArgumentException).parameterName);
    Assert.areEqual("keys", Assert.throws(() => new WebViewDeclaration([], [], [key("reload", ["Mod+R"], ["Mod+R"]), key("refresh", ["F5"], ["Mod+R"])]), ArgumentException).parameterName);
    Assert.areEqual("keys", Assert.throws(() => new WebViewDeclaration([], [], [key("reload", ["Ctrl+R"], ["Mod+R"]), key("refresh", ["Mod+R"], ["F5"])]), ArgumentException).parameterName);
    Assert.areEqual("keys", Assert.throws(() => new WebViewDeclaration([], [], many), ArgumentException).parameterName);
    Assert.areEqual(32, new WebViewDeclaration([], [], many.slice(0, 32)).keys.length);
    Assert.areEqual(2, new WebViewDeclaration([], [], [key("reload", ["Mod+R"]), key("refresh", ["F5"], ["Ctrl+R"])]).keys.length);
  }

  @TestMethod
  public namesThePathThatIsInvalid(): void {
    Assert.areEqual("$.methods.1.name", Assert.throws(() => WebViewDeclaration.fromJson({ methods: [{ name: "Page.enable" }, { name: "Target.createTarget" }] }), JsonException).path);
    Assert.areEqual("$.methods", Assert.throws(() => WebViewDeclaration.fromJson({ methods: [{ name: "Page.enable" }, { name: "Page.enable" }] }), JsonException).path);
    Assert.areEqual("$.events", Assert.throws(() => WebViewDeclaration.fromJson({ events: "Page.loadEventFired" }), JsonException).path);
    Assert.areEqual("$.method", Assert.throws(() => WebViewDeclaration.fromJson({ method: [] }), JsonException).path);
    Assert.areEqual("$.keys.0.keys", Assert.throws(() => WebViewDeclaration.fromJson({ keys: [{ name: "back", keys: ["Alt+ArrowLeft"] }] }), JsonException).path);
  }
}
