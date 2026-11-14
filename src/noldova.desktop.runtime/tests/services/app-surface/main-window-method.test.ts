/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MainWindow, Request, type Response, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RequestContext } from "../../../src/models/request-context.js";
import { AppSurface } from "../../../src/services/app-surface/app-surface.js";
import { MainWindowMethod } from "../../../src/services/app-surface/main-window-method.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class MainWindowMethodTests {
  @TestMethod
  public async answersNullBeforeTheMainProcessReportsAWindowAndTheWindowAfter(): Promise<void> {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const method = new MainWindowMethod(surface);
    const context = new RequestContext("cli", null, new AbortController().signal, 2);

    const before = await method.handleAsync(context);
    surface.receiveMainWindow(1, new MainWindow("Notes", false, false));
    const after = await method.handleAsync(context);

    Assert.isNull(before);
    Assert.areEqual(JSON.stringify({ title: "Notes", isVisible: false, isPainted: false }), JSON.stringify(after));
  }

  @TestMethod
  public answersTheMainWindowTheMainProcessReportsAndForgetsItWhenItsConnectionCloses(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const before = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.mainWindow, null);
      mainProcess.sendMessages(
        new Request("main:1", ShellMethods.mainWindowChanged, new MainWindow("Notes", false, false).toJson()),
        new Request("main:2", ShellMethods.mainWindowChanged, new MainWindow("Notes", true, true).toJson()));
      const answers = await RuntimeHostFixture.readResponsesAsync(mainProcess, 2);
      const reported = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.mainWindow, null);
      mainProcess[Symbol.dispose]();
      const isForgotten = await WaitFixture.untilAsync(async () => {
        const read = await RuntimeHostFixture.callAsync(cli, `cli:${Date.now()}`, ShellMethods.mainWindow, null);
        return Object.isNull(read.payload ?? null);
      }, 10_000);

      Assert.areEqual("null|null|null", [before, answers.get("main:1"), answers.get("main:2")].map(t => MainWindowMethodTests.describe(t)).join("|"));
      Assert.areEqual(JSON.stringify({ title: "Notes", isVisible: true, isPainted: true }), MainWindowMethodTests.describe(reported));
      Assert.isTrue(isForgotten, "The main window stayed after the main process's connection closed.");
    });
  }

  private static describe(response: Response | undefined): string {
    return JSON.stringify(response?.payload ?? null);
  }
}
