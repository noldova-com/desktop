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
import { AppShortcut, AppShortcutList, KeyChord } from "@noldova/desktop.protocol";

@TestClass
export class AppShortcutTests {
  @TestMethod
  public carriesTheKeyItsCommandOrNoneAndWhetherItIsGlobalThroughTheWire(): void {
    const list = new AppShortcutList([
      new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true),
      new AppShortcut(KeyChord.parse("Mod+Q"), null, false)
    ]);

    const copy = AppShortcutList.fromJson(JsonReader.parse(JSON.stringify(list.toJson())).toJson());

    Assert.areEqual(JSON.stringify({ shortcuts: [
      { key: "Mod+Shift+Period", command: "desktop.stopAgentControl", isGlobal: true },
      { key: "Mod+Q", command: null, isGlobal: false }
    ] }), JSON.stringify(list.toJson()));
    Assert.areEqual("Mod+Shift+Period desktop.stopAgentControl true Mod+Q null false", copy.shortcuts.flatMap(t => [t.key.text, String(t.command), String(t.isGlobal)]).join(" "));
  }

  @TestMethod
  public refusesABlankCommand(): void {
    for (const command of [String.empty, " "])
      Assert.areEqual("command", Assert.throws(() => new AppShortcut(KeyChord.parse("Mod+B"), command, false), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheFieldThatIsMissingInvalidOrUnknown(): void {
    Assert.areEqual("$.shortcuts.0.key", Assert.throws(() => AppShortcutList.fromJson({ shortcuts: [{ key: "Mod+Nope", command: null, isGlobal: false }] }), JsonException).path);
    Assert.areEqual("$.shortcuts.0.command", Assert.throws(() => AppShortcutList.fromJson({ shortcuts: [{ key: "Mod+B", command: 7, isGlobal: false }] }), JsonException).path);
    Assert.areEqual("$.shortcuts.0.isGlobal", Assert.throws(() => AppShortcutList.fromJson({ shortcuts: [{ key: "Mod+B", command: null }] }), JsonException).path);
    Assert.areEqual("$.shortcuts.0.label", Assert.throws(() => AppShortcutList.fromJson({ shortcuts: [{ key: "Mod+B", command: null, isGlobal: false, label: "B" }] }), JsonException).path);
  }
}
