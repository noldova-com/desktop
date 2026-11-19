/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";
import {
  QualifiedName,
  SettingDefinition,
  SettingEntry,
  SettingKey,
  SettingKind,
  SettingLocality,
  SettingOption,
  SettingScope,
  SettingType,
  SettingChange,
  SettingsSnapshot
} from "@noldova/desktop.protocol";

import { ActionNotConfirmedException } from "../../../src/app/exceptions/action-not-confirmed.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";
import { SettingsService } from "../../../src/app/services/settings.service";
import { FailureFixture } from "../../fixtures/failure.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("SettingsService", () => {
  const mode = QualifiedName.parse("desktop.mode");
  const size = QualifiedName.parse("desktop.panelSize");
  const definitions = [
    new SettingDefinition(mode, "Mode", "Light or dark.", SettingType.text(10), "System", SettingLocality.Shared, [], "Appearance", "Theme"),
    new SettingDefinition(size, "Size", "Text size.", SettingType.number(12, 18, 1), 13, SettingLocality.Device, [], "Appearance", "Text")
  ];
  const snapshot = (modeValue: JsonValue): unknown => ({
    payload: new SettingsSnapshot(definitions, [new SettingEntry(mode, modeValue, modeValue !== "System"), new SettingEntry(size, 13, false)]).toJson()
  });
  const change = (name: QualifiedName, value: JsonValue, scope: SettingScope | null = null, isSet: boolean = true): JsonValue =>
    new SettingChange(new SettingKey(name, scope), value, isSet).toJson();
  let bridge: PreloadBridgeFixture;
  let service: SettingsService;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    bridge.responses.set("desktop.settings", snapshot("Dark"));
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => PreloadBridgeFixture.remove());

  it("loads the definitions and the values in effect, and reads them by name", async () => {
    const value = service.value("desktop.mode");
    expect([service.definitions().length, value(), service.read("desktop.mode")]).toEqual([0, undefined, undefined]);

    await service.loadAsync();

    expect(service.definitions().map(t => t.name.text)).toEqual(["desktop.mode", "desktop.panelSize"]);
    expect([value(), service.read("desktop.panelSize"), service.read("desktop.other")]).toEqual(["Dark", 13, undefined]);
    expect(["desktop.mode", "desktop.panelSize", "desktop.other"].map(t => service.isSet(t)())).toEqual([true, false, false]);
    expect(bridge.requests).toEqual([["desktop.settings", {}]]);
  });

  it("shows the keys that a setting's title, description and option titles name by a token in the platform's own form, and a token that names no key as written", async () => {
    const send = QualifiedName.parse("desktop.send");
    const options = [new SettingOption("mod", "{key:Mod+Enter}"), new SettingOption("plain", "Enter"), new SettingOption("odd", "{key:Mod+Entr}")];
    const keyed = new SettingDefinition(send, "Send with {key:Mod+Enter}", "{key:Alt+Enter} adds a line.", SettingType.choice(options), "mod", SettingLocality.Shared, [], "Chat", "Composer");
    const texts = (definition: SettingDefinition): readonly string[] => [definition.title, definition.description, ...definition.type.options.map(t => `${t.value}=${t.title}`)];
    bridge.responses.set("desktop.settings", { payload: new SettingsSnapshot([keyed, ...definitions], []).toJson() });

    await service.loadAsync();
    const windows = service.definitions().map(texts);
    bridge.platform = "linux";
    await service.loadAsync();
    const linux = service.definitions().map(texts);
    bridge.platform = "darwin";
    await service.loadAsync();

    const others = [["Mode", "Light or dark."], ["Size", "Text size."]];
    expect(windows).toEqual([["Send with Ctrl+Enter", "Alt+Enter adds a line.", "mod=Ctrl+Enter", "plain=Enter", "odd={key:Mod+Entr}"], ...others]);
    expect(linux).toEqual(windows);
    expect(service.definitions().map(texts)).toEqual([["Send with Cmd+Enter", "Option+Enter adds a line.", "mod=Cmd+Enter", "plain=Enter", "odd={key:Mod+Entr}"], ...others]);
    const [shown, mode, size] = service.definitions();
    expect([shown?.name, shown?.type.kind, shown?.defaultValue, shown?.locality, shown?.page, shown?.group]).toEqual([send, SettingKind.Choice, "mod", SettingLocality.Shared, "Chat", "Composer"]);
    expect([mode?.type, size?.type]).toEqual([definitions[0]?.type, definitions[1]?.type]);
  });

  it("asks the runtime to set and reset a value, for the application or a scope", async () => {
    const scope = new SettingScope(QualifiedName.parse("chat.conversation"), "c1");

    await service.setAsync("desktop.mode", "Light");
    await service.setAsync("chat.sendWithEnter", false, scope);
    await service.resetAsync("desktop.mode");
    await service.resetAsync("chat.sendWithEnter", scope);

    expect(bridge.requests).toEqual([
      ["desktop.setSetting", { name: "desktop.mode", value: "Light" }],
      ["desktop.setSetting", { name: "chat.sendWithEnter", scope: { name: "chat.conversation", id: "c1" }, value: false }],
      ["desktop.resetSetting", { name: "desktop.mode" }],
      ["desktop.resetSetting", { name: "chat.sendWithEnter", scope: { name: "chat.conversation", id: "c1" } }]
    ]);
  });

  it("asks the runtime for a setting's entry, for the application or a scope", async () => {
    const scope = new SettingScope(QualifiedName.parse("chat.conversation"), "c1");
    bridge.responses.set("desktop.readSetting", { payload: new SettingEntry(mode, "Light", true).toJson() });

    const entries = [await service.readAsync("desktop.mode", null), await service.readAsync("desktop.mode", scope)];

    expect(entries).toEqual([new SettingEntry(mode, "Light", true), new SettingEntry(mode, "Light", true)]);
    expect(bridge.requests).toEqual([
      ["desktop.readSetting", { name: "desktop.mode" }],
      ["desktop.readSetting", { name: "desktop.mode", scope: { name: "chat.conversation", id: "c1" } }]
    ]);
  });

  it("rejects a change the runtime did not confirm because the connection ended as an action not confirmed, and passes any other failure on", async () => {
    bridge.responses.set("desktop.setSetting", { failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });
    bridge.responses.set("desktop.resetSetting", { failure: { code: "Unavailable", message: "The runtime did not answer desktop.resetSetting in time." } });

    const set = await service.setAsync("desktop.mode", "Light").catch((error: unknown) => error);
    const reset = await service.resetAsync("desktop.mode").catch((error: unknown) => error);

    expect([set instanceof ActionNotConfirmedException, FailureFixture.of(set, Error).message])
      .toEqual([true, "The runtime did not confirm the change to the setting desktop.mode because the connection to it ended."]);
    expect([reset instanceof RuntimeRequestException, FailureFixture.of(reset, RuntimeRequestException).code]).toEqual([true, "Unavailable"]);
  });

  it("follows changes, keeping only those without a scope as values and whether each is stored, and tells each listener until it stops", async () => {
    await service.loadAsync();
    const isModeSet = service.isSet("desktop.mode");
    const heard: string[] = [];
    const stop = service.onChanged(t => heard.push(`${t.key.name.text}=${String(t.value)}${Object.isNull(t.key.scope) ? String.empty : ` in ${t.key.scope.id}`}`));

    bridge.publishEvent("desktop.settingsChanged", change(mode, "Light"));
    bridge.publishEvent("desktop.settingsChanged", change(mode, "Dark", new SettingScope(QualifiedName.parse("chat.conversation"), "c1")));
    bridge.publishEvent("desktop.notifications", { notifications: [] });
    stop();
    bridge.publishEvent("desktop.settingsChanged", change(size, 15));
    const wasModeSet = isModeSet();
    bridge.publishEvent("desktop.settingsChanged", change(mode, "System", null, false));

    expect(heard).toEqual(["desktop.mode=Light", "desktop.mode=Dark in c1"]);
    expect([service.read("desktop.mode"), service.read("desktop.panelSize")]).toEqual(["System", 15]);
    expect([wasModeSet, isModeSet(), service.isSet("desktop.panelSize")()]).toEqual([true, false, true]);
  });

  it("keeps a change that arrives during a load over the loaded value, and ignores a load that a later one overtook", async () => {
    let answerFirst: (value: unknown) => void = () => undefined;
    bridge.responses.set("desktop.settings", new Promise(resolve => answerFirst = resolve));
    const first = service.loadAsync();
    bridge.responses.set("desktop.settings", snapshot("System"));
    const second = service.loadAsync();
    bridge.publishEvent("desktop.settingsChanged", change(size, 16));

    await second;
    answerFirst(snapshot("Dark"));
    await first;

    expect([service.read("desktop.mode"), service.read("desktop.panelSize")]).toEqual(["System", 16]);
    bridge.responses.set("desktop.settings", snapshot("Light"));
    await service.loadAsync();
    expect([service.read("desktop.mode"), service.read("desktop.panelSize")]).toEqual(["Light", 13]);
  });
});
