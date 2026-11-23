/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingDefinition, SettingKey, SettingLocality, SettingScope, SettingType, SettingValue } from "@noldova/desktop.protocol";
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

  @TestMethod
  public async readsAndFollowsADeviceSettingForTheRuntimesOwnDeviceOnceItKnowsIt(): Promise<void> {
    const width = new SettingDefinition(QualifiedName.parse("tasks.width"), "tasks.width", "A setting.", SettingType.text(20), "a", SettingLocality.Device, [], "Page", "Group");
    await using settings = await SettingsFixture.createAsync([...ModuleContextFixture.SETTINGS, width]);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    const write = (device: string, value: string): void => settings.service.write(new SettingValue(new SettingKey(width.name, null, device), value));
    const seen: string[] = [];
    write("d1", "b");
    write("d2", "c");

    const unknown = [settings.service.device, context.settings.read("tasks.width")];
    settings.service.useDevice("d1");
    context.settings.onChanged("tasks.width", t => seen.push(`${String(t.key.device)}:${String(t.value)}`));
    const known = [settings.service.device, context.settings.read("tasks.width"), context.settings.read("tasks.width", null, "d2")];
    write("d2", "e");
    write("d1", "f");
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "g"));

    Assert.areEqual("null,a d1,b,c d1:f", [unknown, known, seen].map(t => t.map(u => String(u)).join(",")).join(" "));
  }

  @TestMethod
  public async tellsAPartTheMomentItsDeviceSettingHoldsTheDevicesValueWithNoValueStored(): Promise<void> {
    const height = new SettingDefinition(QualifiedName.parse("tasks.height"), "tasks.height", "A setting.", SettingType.text(20), "h", SettingLocality.Device, [], "Page", "Group");
    await using settings = await SettingsFixture.createAsync([...ModuleContextFixture.SETTINGS, height]);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    const ended = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    const withdrawn = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    const seen: string[] = [];
    context.settings.onChanged("tasks.height", t => seen.push(`change ${String(t.value)}`));
    context.settings.onDeviceKnown(() => seen.push(`known ${String(context.settings.isDeviceKnown)} ${String(context.settings.read("tasks.height"))}`));
    withdrawn.settings.onDeviceKnown(() => seen.push("withdrawn"));
    withdrawn[Symbol.dispose]();
    ended[Symbol.dispose]();
    ended.settings.onDeviceKnown(() => seen.push("ended"));

    const before = [context.settings.isDeviceKnown, seen.length];
    settings.service.useDevice("d1");

    Assert.areEqual("false,0 known true h true", [before.join(","), seen.join("|"), context.settings.isDeviceKnown].join(" "));
  }

  @TestMethod
  public async tellsAModuleFollowingADeviceSettingItsStoredValueOnceTheRuntimeLearnsItsDevice(): Promise<void> {
    const width = new SettingDefinition(QualifiedName.parse("tasks.width"), "tasks.width", "A setting.", SettingType.text(20), "a", SettingLocality.Device, [], "Page", "Group");
    const height = new SettingDefinition(QualifiedName.parse("tasks.height"), "tasks.height", "A setting.", SettingType.text(20), "h", SettingLocality.Device, [], "Page", "Group");
    await using settings = await SettingsFixture.createAsync([...ModuleContextFixture.SETTINGS, width, height]);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    settings.service.write(new SettingValue(new SettingKey(width.name, null, "d1"), "b"));
    settings.service.write(new SettingValue(new SettingKey(width.name, null, "d2"), "c"));
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse("tasks.size")), "g"));
    const seen: string[] = [];
    for (const name of ["tasks.width", "tasks.height", "tasks.size"])
      context.settings.onChanged(name, t => seen.push(`${t.key.name.text}:${String(t.key.device)}:${String(t.value)}`));

    const before = context.settings.read("tasks.width");
    settings.service.useDevice("d1");

    Assert.areEqual("a tasks.width:d1:b b", [before, seen.join(","), context.settings.read("tasks.width")].join(" "));
  }
}
