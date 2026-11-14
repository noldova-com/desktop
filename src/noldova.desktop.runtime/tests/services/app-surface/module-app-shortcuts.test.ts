/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppShortcut, AppShortcutList, KeyChord } from "@noldova/desktop.protocol";

import { AppSurface } from "../../../src/services/app-surface/app-surface.js";
import { ModuleAppShortcuts } from "../../../src/services/app-surface/module-app-shortcuts.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleAppShortcutsTests {
  private static readonly SHORTCUTS: AppShortcutList = new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true)]);

  @TestMethod
  public listsAndMatchesTheSurfacesShortcuts(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const shortcuts = new ModuleAppShortcuts(surface, []);

    surface.receiveShortcuts(1, ModuleAppShortcutsTests.SHORTCUTS);

    Assert.areEqual(JSON.stringify(ModuleAppShortcutsTests.SHORTCUTS.shortcuts.map(t => t.toJson())), JSON.stringify(shortcuts.list().map(t => t.toJson())));
    Assert.isTrue(shortcuts.has(KeyChord.parse("Mod+Shift+Period")));
    Assert.isFalse(shortcuts.has(KeyChord.parse("Mod+Q")));
  }

  @TestMethod
  public keepsEachListenersRegistrationAndStopsTellingItOnceRemoved(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const registrations: Disposable[] = [];
    const shortcuts = new ModuleAppShortcuts(surface, registrations);
    let heard = 0;

    const remove = shortcuts.onChanged(() => heard++);
    surface.receiveShortcuts(1, ModuleAppShortcutsTests.SHORTCUTS);
    remove();
    surface.receiveShortcuts(1, new AppShortcutList([]));

    Assert.areEqual(1, heard);
    Assert.areEqual(1, registrations.length);
  }

  @TestMethod
  public stopsTellingAListenerWhenTheModulesRegistrationsAreDisposed(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const registrations: Disposable[] = [];
    const shortcuts = new ModuleAppShortcuts(surface, registrations);
    let heard = 0;
    shortcuts.onChanged(() => heard++);

    for (const registration of registrations)
      registration[Symbol.dispose]();
    surface.receiveShortcuts(1, ModuleAppShortcutsTests.SHORTCUTS);

    Assert.areEqual(0, heard);
  }
}
