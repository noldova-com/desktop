/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingKey, SettingScope, SettingValue } from "@noldova/desktop.protocol";
import {
  EventRegistry, MethodRegistry, ServiceRegistry, SettingNotReadableException, SettingNotWritableException, SettingScopeNotAllowedException, SettingScopeNotOwnedException, SettingUnknownException
} from "@noldova/desktop.runtime";

import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { ModuleContextFixture } from "../../fixtures/module-context.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";

@TestClass
export class ModuleSettingsTests {
  @TestMethod
  public async readsItsOwnItsDependenciesAndTheShellsSettingsAndChangesOnlyItsOwn(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(ModuleContextFixture.SETTINGS);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    const folder = new SettingScope(QualifiedName.parse("notes.folder"), "f1");
    const tasks = new SettingScope(QualifiedName.parse("tasks.list"), "l1");

    context.settings.write("notes.sortBy", "title");
    context.settings.write("notes.sortBy", "date", folder);
    const read = ["notes.sortBy", "tasks.size", "desktop.mode"].map(t => context.settings.read(t));
    const scoped = context.settings.read("notes.sortBy", folder);
    context.settings.reset("notes.sortBy", folder);
    context.settings.setScopeParent(folder, tasks);
    context.settings.setScopeParent(folder, null);
    context.settings.removeScope(folder);

    Assert.areEqual("title,a,a,date,title", [...read, scoped, context.settings.read("notes.sortBy", folder)].join(","));
    Assert.areEqual("The module notes may only read its own settings, its dependencies' and the shell's, not clock.speed.",
      Assert.throws(() => context.settings.read("clock.speed"), SettingNotReadableException).message);
    Assert.throws(() => context.settings.read("notes.missing"), SettingUnknownException);
    const unlisted = Assert.throws(() => context.settings.read("notes.sortBy", tasks), SettingScopeNotAllowedException);
    Assert.areEqual("InvalidParams: The setting notes.sortBy does not list the scope tasks.list.", `${unlisted.failure.code}: ${unlisted.message}`);
    Assert.areEqual("The module notes may only change its own settings, not tasks.size.",
      Assert.throws(() => context.settings.write("tasks.size", "b"), SettingNotWritableException).message);
    Assert.throws(() => context.settings.reset("desktop.mode"), SettingNotWritableException);
    Assert.throws(() => context.settings.setScopeParent(tasks, null), SettingScopeNotOwnedException);
    Assert.throws(() => context.settings.setScopeParent(folder, new SettingScope(QualifiedName.parse("clock.dial"), "d1")), SettingScopeNotOwnedException);
    Assert.throws(() => context.settings.removeScope(tasks), SettingScopeNotOwnedException);
  }

  @TestMethod
  public async followsAReadableSettingUntilWithdrawn(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(ModuleContextFixture.SETTINGS);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    const seen: string[] = [];
    context.settings.onChanged("tasks.size", t => seen.push(String(t.value)));

    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("desktop.mode")), "b"));
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "c"));
    context[Symbol.dispose]();
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "d"));

    Assert.areEqual("c", seen.join(","));
    Assert.throws(() => context.settings.onChanged("clock.speed", () => undefined), SettingNotReadableException);
  }
}
