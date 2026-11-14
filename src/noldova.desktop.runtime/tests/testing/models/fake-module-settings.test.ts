/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName, SettingChange, SettingKey, SettingScope } from "@noldova/desktop.protocol";
import type { IModuleSettings } from "@noldova/desktop.runtime";
import { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";

@TestClass
export class FakeModuleSettingsTests {
  private static readonly NAME: string = "terminal.theme";
  private static readonly FOLDER: SettingScope = new SettingScope(QualifiedName.parse("notes.folder"), "f1");
  private static readonly MEMBERS: Readonly<Record<keyof IModuleSettings, FakeMember<IModuleSettings>>> = {
    read: ["answered", t => t.read(FakeModuleSettingsTests.NAME)],
    write: ["told", t => t.write(FakeModuleSettingsTests.NAME, "dark")],
    reset: ["told", t => t.reset(FakeModuleSettingsTests.NAME)],
    onChanged: ["kept", t => t.onChanged(FakeModuleSettingsTests.NAME, () => undefined)],
    setScopeParent: ["told", t => t.setScopeParent(FakeModuleSettingsTests.FOLDER, null)],
    removeScope: ["told", t => t.removeScope(FakeModuleSettingsTests.FOLDER)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeModuleSettingsTests.MEMBERS), await FakeMembersFixture.observeAsync<IModuleSettings>(() => new FakeModuleSettings(), FakeModuleSettingsTests.MEMBERS));
  }

  @TestMethod
  public raisesAChangeToTheListenersOfItsSettingOnly(): void {
    const settings = new FakeModuleSettings();
    const heard: string[] = [];
    settings.onChanged("terminal.theme", t => heard.push(`theme ${String(t.value)}`));
    settings.onChanged("terminal.font", t => heard.push(`font ${String(t.value)}`));

    settings.raiseChanged("terminal.theme", new SettingChange(new SettingKey(QualifiedName.parse("terminal.theme")), "dark", true));

    Assert.areEqual("theme dark", heard.join("|"));
  }

  @TestMethod
  public stopsAtAListenerThatThrowsAsTheRuntimeDoes(): void {
    const settings = new FakeModuleSettings();
    const heard: string[] = [];
    settings.onChanged("terminal.theme", () => heard.push("first"));
    settings.onChanged("terminal.theme", () => {
      throw FakeRaisersFixture.FAILURE;
    });
    settings.onChanged("terminal.theme", () => heard.push("last"));

    const thrown = Assert.throws(() => settings.raiseChanged("terminal.theme", new SettingChange(new SettingKey(QualifiedName.parse("terminal.theme")), "dark", true)), Error);

    Assert.areEqual("first", heard.join("|"));
    Assert.isTrue(thrown === FakeRaisersFixture.FAILURE && settings.errors.length === 0);
  }
}
