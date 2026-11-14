/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppWindow, AppWindowList } from "@noldova/desktop.protocol";

import { AppSurface } from "../../../src/services/app-surface/app-surface.js";
import { ModuleAppWindows } from "../../../src/services/app-surface/module-app-windows.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleAppWindowsTests {
  private static readonly WINDOWS: AppWindowList = new AppWindowList([new AppWindow(132_406, 4210)]);

  @TestMethod
  public listsTheSurfacesWindows(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const windows = new ModuleAppWindows(surface, []);
    const before = windows.list().length;

    surface.receiveWindows(1, ModuleAppWindowsTests.WINDOWS);

    Assert.areEqual(0, before);
    Assert.areEqual(JSON.stringify(ModuleAppWindowsTests.WINDOWS.windows.map(t => t.toJson())), JSON.stringify(windows.list().map(t => t.toJson())));
  }

  @TestMethod
  public keepsEachListenersRegistrationAndStopsTellingItOnceRemoved(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const registrations: Disposable[] = [];
    const windows = new ModuleAppWindows(surface, registrations);
    let heard = 0;

    const remove = windows.onChanged(() => heard++);
    surface.receiveWindows(1, ModuleAppWindowsTests.WINDOWS);
    remove();
    surface.receiveWindows(1, new AppWindowList([]));

    Assert.areEqual(1, heard);
    Assert.areEqual(1, registrations.length);
  }

  @TestMethod
  public stopsTellingAListenerWhenTheModulesRegistrationsAreDisposed(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const registrations: Disposable[] = [];
    const windows = new ModuleAppWindows(surface, registrations);
    let heard = 0;
    windows.onChanged(() => heard++);

    for (const registration of registrations)
      registration[Symbol.dispose]();
    surface.receiveWindows(1, ModuleAppWindowsTests.WINDOWS);

    Assert.areEqual(0, heard);
  }
}
