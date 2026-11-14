/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, QuitAnswer, QuitAnswered, Request, ShellEvents, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

@TestClass
export class QuitAnsweredMethodTests {
  @TestMethod
  public failsWithAConflictWhenTheMainProcessesSaveFailedAndIgnoresAnAnswerNoQuitAwaits(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const early = await RuntimeHostFixture.callAsync(mainProcess, "main:1", ShellMethods.quitAnswered, new QuitAnswered(QuitAnswer.Stayed).toJson());
      const stranger = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.quitAnswered, new QuitAnswered(QuitAnswer.Stayed).toJson());
      cli.sendMessages(new Request("cli:2", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.quitting);
      await RuntimeHostFixture.callAsync(mainProcess, "main:2", ShellMethods.quitAnswered, new QuitAnswered(QuitAnswer.SaveFailed).toJson());
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);
      const invalid = await RuntimeHostFixture.callAsync(mainProcess, "main:3", ShellMethods.quitAnswered, { answer: "Quitting" });

      Assert.areEqual("null|null", `${JSON.stringify(early.payload)}|${JSON.stringify(stranger.payload)}`);
      Assert.areEqual("Conflict|Noldova Desktop Sample stayed open: a window could not save.", `${answer.failure?.code}|${answer.failure?.message}`);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
    });
  }
}
