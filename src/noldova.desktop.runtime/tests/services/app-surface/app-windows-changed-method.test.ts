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
import { AppShortcut, AppShortcutList, AppWindow, AppWindowList, FailureCode, KeyChord, QualifiedName, Request, type Response, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { AppSurface } from "../../../src/services/app-surface/app-surface.js";
import { AppWindowsChangedMethod } from "../../../src/services/app-surface/app-windows-changed-method.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class AppWindowsChangedMethodTests {
  private static readonly READ: QualifiedName = new QualifiedName("watch", "echo");
  private static readonly PART: string = [
    "export class RuntimePart {",
    "  async activateAsync(context) {",
    "    const heard = [];",
    "    context.appWindows.onChanged(() => heard.push(\"windows\"));",
    "    context.shortcuts.onChanged(() => heard.push(\"shortcuts\"));",
    "    context.registerMethod(`${context.moduleId}.echo`, { handleAsync: async () => ({",
    "      windows: context.appWindows.list().map(t => t.toJson()),",
    "      shortcuts: context.shortcuts.list().map(t => t.toJson()),",
    "      heard",
    "    }) });",
    "  }",
    String.empty,
    "  async deactivateAsync() {",
    "  }",
    "}",
    String.empty
  ].join("\n");
  private static readonly WINDOWS: AppWindowList = new AppWindowList([new AppWindow(132_406, 4210)]);
  private static readonly SHORTCUTS: AppShortcutList = new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true)]);

  @TestMethod
  public givesTheSurfaceTheWindowsTheMainProcessReports(): Promise<void> {
    return AppWindowsChangedMethodTests.runAsync(async (method, surface) => {
      const answer = await method.handleAsync(new RequestContext("main", AppWindowsChangedMethodTests.WINDOWS.toJson(), new AbortController().signal, 1));

      Assert.isNull(answer);
      Assert.areEqual(JSON.stringify(AppWindowsChangedMethodTests.WINDOWS.windows.map(t => t.toJson())), JSON.stringify(surface.windows.map(t => t.toJson())));
    });
  }

  @TestMethod
  public refusesAReportFromAnotherClientOrFromAWindow(): Promise<void> {
    return AppWindowsChangedMethodTests.runAsync(async (method, surface) => {
      const contexts = [
        new RequestContext("cli", AppWindowsChangedMethodTests.WINDOWS.toJson(), new AbortController().signal, 2),
        new RequestContext("main", AppWindowsChangedMethodTests.WINDOWS.toJson(), new AbortController().signal, 1, 3)
      ];

      for (const context of contexts) {
        const exception = await Assert.throwsAsync(() => method.handleAsync(context), MethodFailureException);
        Assert.areEqual(`${FailureCode.Unauthorized}: Only the main process reports the app's windows and shortcuts.`, `${exception.failure.code}: ${exception.failure.message}`);
      }
      Assert.areEqual(0, surface.windows.length);
    });
  }

  @TestMethod
  public refusesAnInvalidList(): Promise<void> {
    return AppWindowsChangedMethodTests.runAsync((method, surface) => {
      Assert.throws(() => method.handleAsync(new RequestContext("main", { windows: [{ handle: 0, processId: 4210 }] }, new AbortController().signal, 1)), JsonException);

      Assert.areEqual(0, surface.windows.length);
      return Promise.resolve();
    });
  }

  @TestMethod
  public refusesAWindowsOrShortcutsReportFromAnyoneButTheMainProcessItselfAndAnInvalidOneOverTheProtocol(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([["watch", AppWindowsChangedMethodTests.PART]]));
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      cli.sendMessages(
        new Request("cli:1", ShellMethods.appWindowsChanged, AppWindowsChangedMethodTests.WINDOWS.toJson()),
        new Request("cli:2", ShellMethods.appShortcutsChanged, AppWindowsChangedMethodTests.SHORTCUTS.toJson()));
      const fromCli = await RuntimeHostFixture.readResponsesAsync(cli, 2);
      mainProcess.sendMessages(
        new Request("main:1", ShellMethods.appWindowsChanged, AppWindowsChangedMethodTests.WINDOWS.toJson(), undefined, 3),
        new Request("main:2", ShellMethods.appShortcutsChanged, AppWindowsChangedMethodTests.SHORTCUTS.toJson(), undefined, 3),
        new Request("main:3", ShellMethods.appWindowsChanged, { windows: [{ handle: 0, processId: 4210 }] }),
        new Request("main:4", ShellMethods.appShortcutsChanged, { shortcuts: [{ key: "Mod+Nope", command: null, isGlobal: false }] }));
      const fromMain = await RuntimeHostFixture.readResponsesAsync(mainProcess, 4);
      const read = await RuntimeHostFixture.callAsync(cli, "cli:3", AppWindowsChangedMethodTests.READ, null);

      Assert.areEqual(
        "Unauthorized: Only the main process reports the app's windows and shortcuts.|Unauthorized: Only the main process reports the app's windows and shortcuts.",
        ["cli:1", "cli:2"].map(t => `${fromCli.get(t)?.failure?.code}: ${fromCli.get(t)?.failure?.message}`).join("|"));
      Assert.areEqual([FailureCode.Unauthorized, FailureCode.Unauthorized, FailureCode.InvalidParams, FailureCode.InvalidParams].join("|"),
        ["main:1", "main:2", "main:3", "main:4"].map(t => fromMain.get(t)?.failure?.code).join("|"));
      Assert.areEqual(JSON.stringify({ windows: [], shortcuts: [], heard: [] }), AppWindowsChangedMethodTests.describe(read));
    });
  }

  private static runAsync(action: (method: AppWindowsChangedMethod, surface: AppSurface) => Promise<void>): Promise<void> {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    return action(new AppWindowsChangedMethod(surface), surface);
  }

  private static describe(response: Response | undefined): string {
    return JSON.stringify(response?.payload ?? null);
  }
}
