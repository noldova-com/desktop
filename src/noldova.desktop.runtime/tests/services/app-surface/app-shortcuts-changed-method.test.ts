/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppShortcut, AppShortcutList, FailureCode, KeyChord } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { AppShortcutsChangedMethod } from "../../../src/services/app-surface/app-shortcuts-changed-method.js";
import { AppSurface } from "../../../src/services/app-surface/app-surface.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class AppShortcutsChangedMethodTests {
  private static readonly SHORTCUTS: AppShortcutList = new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true)]);

  @TestMethod
  public givesTheSurfaceTheShortcutsTheMainProcessReports(): Promise<void> {
    return AppShortcutsChangedMethodTests.runAsync(async (method, surface) => {
      const answer = await method.handleAsync(new RequestContext("main", AppShortcutsChangedMethodTests.SHORTCUTS.toJson(), new AbortController().signal, 1));

      Assert.isNull(answer);
      Assert.areEqual(JSON.stringify(AppShortcutsChangedMethodTests.SHORTCUTS.shortcuts.map(t => t.toJson())), JSON.stringify(surface.shortcuts.map(t => t.toJson())));
    });
  }

  @TestMethod
  public refusesAReportFromAnotherClientOrFromAWindow(): Promise<void> {
    return AppShortcutsChangedMethodTests.runAsync(async (method, surface) => {
      const contexts = [
        new RequestContext("cli", AppShortcutsChangedMethodTests.SHORTCUTS.toJson(), new AbortController().signal, 2),
        new RequestContext("main", AppShortcutsChangedMethodTests.SHORTCUTS.toJson(), new AbortController().signal, 1, 3)
      ];

      for (const context of contexts) {
        const exception = await Assert.throwsAsync(() => method.handleAsync(context), MethodFailureException);
        Assert.areEqual(`${FailureCode.Unauthorized}: Only the main process reports the app's windows and shortcuts.`, `${exception.failure.code}: ${exception.failure.message}`);
      }
      Assert.areEqual(0, surface.shortcuts.length);
    });
  }

  @TestMethod
  public refusesAnInvalidList(): Promise<void> {
    return AppShortcutsChangedMethodTests.runAsync((method, surface) => {
      Assert.throws(() => method.handleAsync(new RequestContext("main", { shortcuts: [{ key: "Mod+Nope", command: null, isGlobal: false }] }, new AbortController().signal, 1)), JsonException);

      Assert.areEqual(0, surface.shortcuts.length);
      return Promise.resolve();
    });
  }

  private static runAsync(action: (method: AppShortcutsChangedMethod, surface: AppSurface) => Promise<void>): Promise<void> {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    return action(new AppShortcutsChangedMethod(surface), surface);
  }
}
