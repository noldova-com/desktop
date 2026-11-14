/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppShortcut, AppShortcutList, AppWindow, AppWindowList, KeyChord, QualifiedName, Request, type Response, ShellMethods } from "@noldova/desktop.protocol";
import { AppSurface, ClientClosure, ClientClosures, type Registration, RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class AppSurfaceTests {
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
  private static readonly WINDOWS: AppWindowList = new AppWindowList([new AppWindow(132_406, 4210), new AppWindow(null, 4210)]);
  private static readonly SHORTCUTS: AppShortcutList = new AppShortcutList([
    new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true),
    new AppShortcut(KeyChord.parse("Mod+Q"), null, false)
  ]);

  @TestMethod
  public startsEmptyAndHoldsTheWholeListsTheMainProcessReports(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const empty = [surface.windows.length, surface.shortcuts.length].join(" ");

    surface.receiveWindows(1, AppSurfaceTests.WINDOWS);
    surface.receiveShortcuts(1, AppSurfaceTests.SHORTCUTS);

    Assert.areEqual("0 0", empty);
    Assert.areEqual(JSON.stringify(AppSurfaceTests.WINDOWS.windows.map(t => t.toJson())), JSON.stringify(surface.windows.map(t => t.toJson())));
    Assert.areEqual(JSON.stringify(AppSurfaceTests.SHORTCUTS.shortcuts.map(t => t.toJson())), JSON.stringify(surface.shortcuts.map(t => t.toJson())));
  }

  @TestMethod
  public tellsItsListenersOnlyWhenAListReallyChanges(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const heard: string[] = [];
    surface.onWindowsChanged(() => {
      heard.push(`windows ${surface.windows.length}`);
    });
    surface.onShortcutsChanged(() => {
      heard.push(`shortcuts ${surface.shortcuts.length}`);
    });

    surface.receiveWindows(1, AppSurfaceTests.WINDOWS);
    surface.receiveWindows(1, AppWindowList.fromJson(AppSurfaceTests.WINDOWS.toJson()));
    surface.receiveShortcuts(1, AppSurfaceTests.SHORTCUTS);
    surface.receiveShortcuts(1, AppShortcutList.fromJson(AppSurfaceTests.SHORTCUTS.toJson()));
    surface.receiveWindows(1, new AppWindowList([new AppWindow(132_406, 4210)]));
    surface.receiveShortcuts(1, new AppShortcutList([]));
    surface.receiveShortcuts(1, new AppShortcutList([]));

    Assert.areEqual("windows 2|shortcuts 2|windows 1|shortcuts 0", heard.join("|"));
  }

  @TestMethod
  public emptiesBothListsWhenTheConnectionThatReportedThemCloses(): void {
    const closures = new ClientClosures(new TextOutputFixture());
    const surface = new AppSurface(closures, "linux", new TextOutputFixture());
    const heard: string[] = [];
    surface.onWindowsChanged(() => {
      heard.push(`windows ${surface.windows.length}`);
    });
    surface.onShortcutsChanged(() => {
      heard.push(`shortcuts ${surface.shortcuts.length}`);
    });
    surface.receiveWindows(1, AppSurfaceTests.WINDOWS);
    surface.receiveShortcuts(1, AppSurfaceTests.SHORTCUTS);

    closures.report(new ClientClosure(1, 3));
    closures.report(new ClientClosure(2, null));
    const kept = [surface.windows.length, surface.shortcuts.length].join(" ");
    closures.report(new ClientClosure(1, null));
    closures.report(new ClientClosure(1, null));

    Assert.areEqual("2 2", kept);
    Assert.areEqual("windows 2|shortcuts 2|windows 0|shortcuts 0", heard.join("|"));
  }

  @TestMethod
  public tellsItsListenersWhenTheMainProcessConnectsOrGoesWithNoWindowOpen(): void {
    const closures = new ClientClosures(new TextOutputFixture());
    const surface = new AppSurface(closures, "linux", new TextOutputFixture());
    const heard: string[] = [];
    surface.onWindowsChanged(() => {
      heard.push(`windows ${surface.windows.length}`);
    });
    surface.onShortcutsChanged(() => {
      heard.push(`shortcuts ${surface.shortcuts.length}`);
    });

    surface.receiveWindows(1, new AppWindowList([]));
    surface.receiveShortcuts(1, new AppShortcutList([]));
    surface.receiveWindows(1, new AppWindowList([]));
    closures.report(new ClientClosure(1, null));
    surface.receiveWindows(2, new AppWindowList([]));
    surface.receiveWindows(3, new AppWindowList([]));

    Assert.areEqual("windows 0|shortcuts 0|windows 0|shortcuts 0|windows 0|windows 0", heard.join("|"));
  }

  @TestMethod
  public keepsTheListsANewMainProcessReportedWhenTheOldOnesConnectionClosesLater(): void {
    const closures = new ClientClosures(new TextOutputFixture());
    const surface = new AppSurface(closures, "linux", new TextOutputFixture());
    surface.receiveWindows(1, AppSurfaceTests.WINDOWS);
    surface.receiveShortcuts(1, AppSurfaceTests.SHORTCUTS);

    surface.receiveWindows(4, new AppWindowList([new AppWindow(77, 5120)]));
    surface.receiveShortcuts(4, new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+B"), "desktop.toggleLeftDock", false)]));
    closures.report(new ClientClosure(1, null));

    Assert.areEqual("77 5120 Mod+B", [surface.windows[0]?.handle, surface.windows[0]?.processId, surface.shortcuts[0]?.key.text].join(" "));
  }

  @TestMethod
  public stopsTellingAListenerOnceItsRegistrationIsDisposed(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    let heard = 0;
    const windows = surface.onWindowsChanged(() => {
      heard++;
    });
    const shortcuts = surface.onShortcutsChanged(() => {
      heard++;
    });

    windows[Symbol.dispose]();
    shortcuts[Symbol.dispose]();
    surface.receiveWindows(1, AppSurfaceTests.WINDOWS);
    surface.receiveShortcuts(1, AppSurfaceTests.SHORTCUTS);

    Assert.areEqual(0, heard);
  }

  @TestMethod
  public skipsAListenerAnEarlierListenerStopsDuringTheSameChange(): void {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const heard: string[] = [];
    let second: Registration | null = null;
    surface.onWindowsChanged(() => {
      heard.push("first");
      second?.[Symbol.dispose]();
    });
    second = surface.onWindowsChanged(() => {
      heard.push("second");
    });

    surface.receiveWindows(1, AppSurfaceTests.WINDOWS);

    Assert.areEqual("first", heard.join("|"));
  }

  @TestMethod
  public writesAListenersFailureAndStillTellsTheOthers(): void {
    const diagnostics = new TextOutputFixture();
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", diagnostics);
    const heard: string[] = [];
    surface.onWindowsChanged(() => {
      throw new Error("first broke");
    });
    surface.onWindowsChanged(() => {
      heard.push("windows");
    });
    surface.onShortcutsChanged(() => {
      throw new Error("second broke");
    });
    surface.onShortcutsChanged(() => {
      heard.push("shortcuts");
    });

    surface.receiveWindows(1, AppSurfaceTests.WINDOWS);
    surface.receiveShortcuts(1, AppSurfaceTests.SHORTCUTS);

    Assert.areEqual("windows|shortcuts", heard.join("|"));
    Assert.areEqual([
      "A part failed to hear that the app's windows changed: Error: first broke",
      "A part failed to hear that the app's shortcuts changed: Error: second broke"
    ].join("|"), diagnostics.text.split("\n").filter(t => t.length > 0).join("|"));
  }

  @TestMethod
  public matchesAShortcutsKeyAsItsPlatformMatchesKeys(): void {
    const keys = ["Mod+Shift+Period", "Ctrl+Shift+Period", "Mod+Q", "Ctrl+Q", "Mod+W"];
    const seen = ["linux", "win32", "darwin"].map(platform => {
      const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), platform, new TextOutputFixture());
      surface.receiveShortcuts(1, AppSurfaceTests.SHORTCUTS);
      return `${platform} ${keys.map(t => surface.hasShortcut(KeyChord.parse(t))).join(",")}`;
    });

    Assert.areEqual("linux true,true,true,true,false|win32 true,true,true,true,false|darwin true,false,true,false,false", seen.join("|"));
  }

  @TestMethod
  public givesPartsTheListsTheMainProcessReportsAndEmptiesThemWhenItsConnectionCloses(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([["watch", AppSurfaceTests.PART]]));
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      mainProcess.sendMessages(
        new Request("main:1", ShellMethods.appWindowsChanged, AppSurfaceTests.WINDOWS.toJson()),
        new Request("main:2", ShellMethods.appShortcutsChanged, AppSurfaceTests.SHORTCUTS.toJson()));
      const answers = await RuntimeHostFixture.readResponsesAsync(mainProcess, 2);
      const reported = await RuntimeHostFixture.callAsync(cli, "cli:1", AppSurfaceTests.READ, null);
      mainProcess[Symbol.dispose]();
      const isEmptied = await WaitFixture.untilAsync(async () => {
        const read = await RuntimeHostFixture.callAsync(cli, `cli:${Date.now()}`, AppSurfaceTests.READ, null);
        return JsonReader.fromValue(read.payload).readObjectArray("windows").length === 0;
      }, 10_000);
      const emptied = await RuntimeHostFixture.callAsync(cli, "cli:2", AppSurfaceTests.READ, null);

      Assert.areEqual("null|null", `${AppSurfaceTests.describe(answers.get("main:1"))}|${AppSurfaceTests.describe(answers.get("main:2"))}`);
      Assert.areEqual(JSON.stringify({ windows: AppSurfaceTests.WINDOWS.toJson()["windows"], shortcuts: AppSurfaceTests.SHORTCUTS.toJson()["shortcuts"], heard: ["windows", "shortcuts"] }),
        AppSurfaceTests.describe(reported));
      Assert.isTrue(isEmptied, "The lists stayed after the main process's connection closed.");
      Assert.areEqual(JSON.stringify({ windows: [], shortcuts: [], heard: ["windows", "shortcuts", "windows", "shortcuts"] }), AppSurfaceTests.describe(emptied));
    });
  }

  private static describe(response: Response | undefined): string {
    return JSON.stringify(response?.payload ?? null);
  }
}
