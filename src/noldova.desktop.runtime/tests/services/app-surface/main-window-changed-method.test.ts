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
import { FailureCode, MainWindow, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { MethodFailureException } from "../../../src/exceptions/method-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { AppSurface } from "../../../src/services/app-surface/app-surface.js";
import { MainWindowChangedMethod } from "../../../src/services/app-surface/main-window-changed-method.js";
import { ClientClosures } from "../../../src/services/endpoint/client-closures.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class MainWindowChangedMethodTests {
  @TestMethod
  public async givesTheSurfaceTheMainWindowTheMainProcessReports(): Promise<void> {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const method = new MainWindowChangedMethod(surface);

    const answer = await method.handleAsync(new RequestContext("main", new MainWindow("Notes", true, true).toJson(), new AbortController().signal, 1));

    Assert.isNull(answer);
    Assert.areEqual(JSON.stringify({ title: "Notes", isVisible: true, isPainted: true }), JSON.stringify(surface.mainWindow?.toJson() ?? null));
  }

  @TestMethod
  public async refusesAMainWindowFromAnotherClientOrFromAWindowOrAnInvalidOne(): Promise<void> {
    const surface = new AppSurface(new ClientClosures(new TextOutputFixture()), "linux", new TextOutputFixture());
    const method = new MainWindowChangedMethod(surface);
    const window = new MainWindow("Notes", true, true).toJson();

    const fromCli = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("cli", window, new AbortController().signal, 2)), MethodFailureException);
    const fromWindow = await Assert.throwsAsync(() => method.handleAsync(new RequestContext("main", window, new AbortController().signal, 1, 3)), MethodFailureException);
    Assert.throws(() => method.handleAsync(new RequestContext("main", { title: "Notes" }, new AbortController().signal, 1)), JsonException);

    Assert.areEqual(
      `${FailureCode.Unauthorized}: Only the main process reports its main window.|${FailureCode.Unauthorized}`,
      `${fromCli.failure.code}: ${fromCli.failure.message}|${fromWindow.failure.code}`);
    Assert.isNull(surface.mainWindow);
  }

  @TestMethod
  public refusesAMainWindowFromAnyoneButTheMainProcessItselfAndAnInvalidOneOverTheProtocol(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const window = new MainWindow("Notes", true, true).toJson();

      const fromCli = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.mainWindowChanged, window);
      mainProcess.sendMessages(
        new Request("main:1", ShellMethods.mainWindowChanged, window, undefined, 3),
        new Request("main:2", ShellMethods.mainWindowChanged, { title: "Notes" }));
      const fromMain = await RuntimeHostFixture.readResponsesAsync(mainProcess, 2);
      const read = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.mainWindow, null);

      Assert.areEqual("Unauthorized: Only the main process reports its main window.", `${fromCli.failure?.code}: ${fromCli.failure?.message}`);
      Assert.areEqual([FailureCode.Unauthorized, FailureCode.InvalidParams].join("|"), ["main:1", "main:2"].map(t => fromMain.get(t)?.failure?.code).join("|"));
      Assert.areEqual("null", JSON.stringify(read.payload ?? null));
    });
  }
}
