/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import type { IWindowWait } from "../../../src/interfaces/i-window-wait.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { PackagedWindow } from "../../../src/services/packaging/packaged-window.js";
import type { StartedProcess } from "../../../src/services/processes/started-process.js";

class WindowWaitFixture implements IWindowWait {
  private readonly answers: readonly ProcessResult[];
  private time: number = 0;

  public readonly limit: number;
  public hasExited: boolean = false;
  public failure: Error | null = null;
  public queries: number = 0;
  public pauses: number = 0;

  public constructor(answers: readonly ProcessResult[], limit: number = 1_000) {
    this.answers = answers;
    this.limit = limit;
  }

  public get mainProcess(): Pick<StartedProcess, "hasExited" | "ending"> {
    return { hasExited: this.hasExited, ending: "exited with code 3" };
  }

  public static answer(title: string, isVisible: boolean, isPainted: boolean): ProcessResult {
    return new ProcessResult(0, JSON.stringify({ window: { title, isVisible, isPainted } }), String.empty);
  }

  public queryAsync(): Promise<ProcessResult> {
    if (!Object.isNull(this.failure))
      return Promise.reject(this.failure);
    const answer = this.answers[this.queries++];
    Assert.isDefined(answer, "The wait asked for more answers than the test gave.");
    return Promise.resolve(answer);
  }

  public readTailAsync(): Promise<string> {
    return Promise.resolve("main.log: the window stayed hidden");
  }

  public pauseAsync(): Promise<void> {
    this.pauses++;
    this.time += 500;
    return Promise.resolve();
  }

  public now(): number {
    return this.time;
  }
}

@TestClass
export class PackagedWindowTests {
  @TestMethod
  public acceptsAShownWindowTitledWithTheProductsName(): void {
    Assert.areEqual("The installed app's main window is shown, titled \"Atlas\".", PackagedWindow.verify({ window: { title: "Atlas", isVisible: true, isPainted: true } }, "Atlas"));
  }

  @TestMethod
  public acceptsAShownWindowTitledWithAPageAndTheProductsName(): void {
    Assert.areEqual("The installed app's main window is shown, titled \"Providers — Atlas\".", PackagedWindow.verify({ window: { title: "Providers — Atlas", isVisible: true, isPainted: true } }, "Atlas"));
  }

  @TestMethod
  public async refusesAWrongTitleAndNamesBoth(): Promise<void> {
    for (const title of ["Electron", "Atlas — Providers", "Providers - Atlas", " — Atlas", "Providers — Atlas Beta"]) {
      const error = await Assert.throwsAsync(() => Promise.resolve(PackagedWindow.verify({ window: { title, isVisible: true, isPainted: true } }, "Atlas")), BuildException);

      Assert.areEqual(`The installed app's main window is titled ${JSON.stringify(title)} instead of "Atlas" or a page's title and " — Atlas".`, error.message);
    }
  }

  @TestMethod
  public async refusesAHiddenWindow(): Promise<void> {
    const error = await Assert.throwsAsync(() => Promise.resolve(PackagedWindow.verify({ window: { title: "Atlas", isVisible: false, isPainted: false } }, "Atlas")), BuildException);

    Assert.areEqual("The installed app's main window \"Atlas\" is not shown.", error.message);
  }

  @TestMethod
  public async refusesAShownWindowWhosePageHasntPainted(): Promise<void> {
    const error = await Assert.throwsAsync(() => Promise.resolve(PackagedWindow.verify({ window: { title: "Atlas", isVisible: true, isPainted: false } }, "Atlas")), BuildException);

    Assert.areEqual("The installed app's main window \"Atlas\" is shown, but its page hasn't painted.", error.message);
  }

  @TestMethod
  public async refusesAStatusWithoutAMainWindow(): Promise<void> {
    const missing = await Assert.throwsAsync(() => Promise.resolve(PackagedWindow.verify({ modules: [] }, "Atlas")), BuildException);
    const empty = await Assert.throwsAsync(() => Promise.resolve(PackagedWindow.verify({ window: null }, "Atlas")), BuildException);
    const partial = await Assert.throwsAsync(() => Promise.resolve(PackagedWindow.verify({ window: { title: "Atlas" } }, "Atlas")), BuildException);
    const unpainted = await Assert.throwsAsync(() => Promise.resolve(PackagedWindow.verify({ window: { title: "Atlas", isVisible: true } }, "Atlas")), BuildException);

    Assert.areEqual("The installed app's status --json reported no main window: null", missing.message);
    Assert.areEqual("The installed app's status --json reported no main window: null", empty.message);
    Assert.areEqual("The installed app's status --json reported no main window: {\"title\":\"Atlas\"}", partial.message);
    Assert.areEqual("The installed app's status --json reported no main window: {\"title\":\"Atlas\",\"isVisible\":true}", unpainted.message);
  }

  @TestMethod
  public async waitsWhileTheWindowIsHiddenOrMissingOrUnpaintedUntilItIsShownPainted(): Promise<void> {
    const wait = new WindowWaitFixture([
      new ProcessResult(1, String.empty, "No runtime answered."),
      WindowWaitFixture.answer("Atlas", false, false),
      WindowWaitFixture.answer("Atlas", true, false),
      WindowWaitFixture.answer("Atlas", true, true)
    ], 1_500);

    const report = await PackagedWindow.waitAsync(wait, "Atlas");

    Assert.areEqual("The installed app's main window is shown, titled \"Atlas\". 4 3", `${report} ${wait.queries} ${wait.pauses}`);
  }

  @TestMethod
  public async givesUpAtTheLimitWithTheLastAnswerAndTheLogTail(): Promise<void> {
    const wait = new WindowWaitFixture(Array.from({ length: 5 }, () => WindowWaitFixture.answer("Atlas", false, false)));

    const error = await Assert.throwsAsync(() => PackagedWindow.waitAsync(wait, "Atlas"), BuildException);

    Assert.areEqual([
      "The installed app's main window was not shown within 1000 ms. The installed app's main window \"Atlas\" is not shown.",
      "The last status --json exited with 0:",
      "{\"window\":{\"title\":\"Atlas\",\"isVisible\":false,\"isPainted\":false}}",
      "main.log: the window stayed hidden"
    ].join("\n"), error.message);
    Assert.areEqual("3 2", `${wait.queries} ${wait.pauses}`);
  }

  @TestMethod
  public async stopsOnceTheMainProcessHasExited(): Promise<void> {
    const wait = new WindowWaitFixture([new ProcessResult(1, String.empty, "No runtime answered."), WindowWaitFixture.answer("Atlas", true, true)]);
    wait.hasExited = true;

    const error = await Assert.throwsAsync(() => PackagedWindow.waitAsync(wait, "Atlas"), BuildException);

    Assert.areEqual("The main process exited with code 3 before its main window was shown. The installed app's status --json reported no main window: null\nmain.log: the window stayed hidden",
      error.message);
    Assert.areEqual("1 0", `${wait.queries} ${wait.pauses}`);
  }

  @TestMethod
  public async passesOnAFailedQuery(): Promise<void> {
    const wait = new WindowWaitFixture([]);
    wait.failure = new BuildException("The status command could not start.");

    const error = await Assert.throwsAsync(() => PackagedWindow.waitAsync(wait, "Atlas"), BuildException);

    Assert.areEqual("The status command could not start. 0", `${error.message} ${wait.pauses}`);
  }
}
