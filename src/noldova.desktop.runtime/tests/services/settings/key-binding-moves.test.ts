/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SettingKey, SettingValue } from "@noldova/desktop.protocol";
import { ModuleDeclaration, ShellSettings } from "@noldova/desktop.runtime";

import { KeyBindingMoves } from "../../../src/services/settings/key-binding-moves.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";

@TestClass
export class KeyBindingMovesTests {
  private static readonly KEY: SettingKey = new SettingKey(ShellSettings.keyBindings);
  private static readonly NOTES: ModuleDeclaration = KeyBindingMovesTests.declare("notes", { "notes.create": ["notes.add", "notes.new"], "notes.page": ["notes.sheet"] });
  private static readonly TASKS: ModuleDeclaration = KeyBindingMovesTests.declare("tasks", { "tasks.start": ["tasks.run"] });

  @TestMethod
  public async movesTheBindingForACommandsFormerNameToTheCommandInOneWrite(): Promise<void> {
    await using settings = await KeyBindingMovesTests.createAsync({ "desktop.stopAgents": "Mod+Shift+Period", "notes.add": "Mod+K", "tasks.run": null });
    const writes = KeyBindingMovesTests.countWrites(settings);

    KeyBindingMoves.move(settings.service, [KeyBindingMovesTests.NOTES, KeyBindingMovesTests.TASKS]);

    Assert.areEqual(JSON.stringify({ "desktop.stopAgents": "Mod+Shift+Period", "notes.create": "Mod+K", "tasks.start": null }), JSON.stringify(settings.service.read(KeyBindingMovesTests.KEY)));
    Assert.areEqual(1, writes.length);
  }

  @TestMethod
  public async keepsTheBindingThePersonSetForTheCommandOrTheFirstFormerNameTheirBindingsHoldAndDropsTheOthers(): Promise<void> {
    await using set = await KeyBindingMovesTests.createAsync({ "notes.add": "Mod+K", "notes.create": "Mod+J" });
    await using both = await KeyBindingMovesTests.createAsync({ "notes.new": "Mod+L", "notes.add": "Mod+K" });

    KeyBindingMoves.move(set.service, [KeyBindingMovesTests.NOTES]);
    KeyBindingMoves.move(both.service, [KeyBindingMovesTests.NOTES]);

    Assert.areEqual(JSON.stringify({ "notes.create": "Mod+J" }), JSON.stringify(set.service.read(KeyBindingMovesTests.KEY)));
    Assert.areEqual(JSON.stringify({ "notes.create": "Mod+L" }), JSON.stringify(both.service.read(KeyBindingMovesTests.KEY)));
  }

  @TestMethod
  public async leavesABindingForAFormerNameNoModuleInTheBuildGivesOrThatADocumentHad(): Promise<void> {
    const bindings = { "old.add": "Mod+K", "notes.sheet": "Mod+L", "tasks.run": "Mod+M" };
    await using settings = await KeyBindingMovesTests.createAsync(bindings);
    await using empty = await SettingsFixture.createAsync(ShellSettings.definitionsFor("linux"));
    const writes = KeyBindingMovesTests.countWrites(settings);
    const emptyWrites = KeyBindingMovesTests.countWrites(empty);

    KeyBindingMoves.move(settings.service, [KeyBindingMovesTests.NOTES]);
    KeyBindingMoves.move(empty.service, [KeyBindingMovesTests.NOTES]);

    Assert.areEqual(JSON.stringify(bindings), JSON.stringify(settings.service.read(KeyBindingMovesTests.KEY)));
    Assert.areEqual("0,0", [writes.length, emptyWrites.length].join(","));
  }

  @TestMethod
  public async movesABindingOnceThoughTheRuntimeStartsTwice(): Promise<void> {
    await using settings = await KeyBindingMovesTests.createAsync({ "notes.add": "Mod+K" });
    const writes = KeyBindingMovesTests.countWrites(settings);

    KeyBindingMoves.move(settings.service, [KeyBindingMovesTests.NOTES]);
    KeyBindingMoves.move(settings.service, [KeyBindingMovesTests.NOTES]);

    Assert.areEqual(JSON.stringify({ "notes.create": "Mod+K" }), JSON.stringify(settings.service.read(KeyBindingMovesTests.KEY)));
    Assert.areEqual(1, writes.length);
  }

  private static declare(id: string, formerNames: Readonly<Record<string, readonly string[]>>): ModuleDeclaration {
    const [command, document] = Object.keys(formerNames);
    const contributions = new Map([["commands", [`${id}.close`, String(command)]], ["documents", Object.isUndefined(document) ? [] : [document]]]);
    return new ModuleDeclaration(id, "1.0.0", id, "Used by the tests.", new Map(), null, contributions, [], null, [], null, false, new Map(), null, null, null, new Map(Object.entries(formerNames)));
  }

  private static async createAsync(bindings: JsonObject): Promise<SettingsFixture> {
    const settings = await SettingsFixture.createAsync(ShellSettings.definitionsFor("linux"));
    settings.service.write(new SettingValue(KeyBindingMovesTests.KEY, bindings));
    return settings;
  }

  private static countWrites(settings: SettingsFixture): unknown[] {
    const writes: unknown[] = [];
    settings.service.onChanged(t => writes.push(t));
    return writes;
  }
}
