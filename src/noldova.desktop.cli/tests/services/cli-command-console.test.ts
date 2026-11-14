/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliCommandConsoleTests {
  @TestMethod
  public async writesLinesAndReadsEachLineOfTheInputInOrderUntilItEnds(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const text = await fixture.runModuleAsync(build, ["probe", "chat"], "Ada\nBob\nCid\n");
    const json = await fixture.runModuleAsync(build, ["probe", "chat", "--json"], "Ada\nBob\nCid\n");

    Assert.areEqual(0, text.code, text.error);
    Assert.areEqual("Hello.\nName? Again? Once more? Last? After? Bye, Ada.\nDone.\n", text.output);
    Assert.areEqual(String.empty, text.error);
    Assert.areEqual(0, json.code, json.error);
    Assert.areEqual("[\"Ada\",\"Bob\",\"Cid\",null,null]\n", json.output);
    Assert.areEqual("Hello.\nBye, Ada.\n", json.error);
  }

  @TestMethod
  public async hearsTheEventsTheRuntimeSendsItsConnectionUntilEachListenerIsDisposed(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const result = await fixture.runModuleAsync(build, ["probe", "listen", "--json"]);

    Assert.areEqual(0, result.code, result.error);
    Assert.areEqual("[\"first\",\"FIRST\",\"SECOND\"]\n", result.output);
  }

  @TestMethod
  public async failsTheCommandWhenOneOfItsEventListenersThrows(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const result = await fixture.runModuleAsync(build, ["probe", "listen-badly", "--json"]);

    Assert.areEqual(1, result.code, result.error);
    Assert.areEqual(JSON.stringify({ code: "Failed", message: "The command failed: The probe's listener tripped." }), result.error.trimEnd());
    Assert.areEqual(String.empty, result.output);
  }

  @TestMethod
  public async endsACommandWaitingForInputAtCtrlCAndAnswersItsAsksWithNull(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const input = new PassThrough({ encoding: "utf8" });

    try {
      const running = fixture.runModuleAsync(build, ["probe", "ask", "--json"], input);
      await ProbeBuildFixture.waitUntilWaitingAsync(build.locate(ProbeBuildFixture.ASK_WAITING_MARKER));
      fixture.signals.emit("SIGINT");
      const result = await running;

      Assert.areEqual(6, result.code, result.error);
      Assert.areEqual("Cancelled", JsonReader.parse(result.error).readString("code"));
      Assert.areEqual(String.empty, result.output);
      await ProbeBuildFixture.waitUntilWaitingAsync(build.locate(ProbeBuildFixture.ASK_ENDED_MARKER));
    }
    finally {
      input.end();
    }
  }

  @TestMethod
  public async failsACommandWaitingForInputWhenTheRuntimeGoesAway(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    const host = await fixture.startHostAsync(build.declarationsFile);
    const input = new PassThrough({ encoding: "utf8" });

    try {
      const running = fixture.runModuleAsync(build, ["probe", "ask", "--json"], input);
      await ProbeBuildFixture.waitUntilWaitingAsync(build.locate(ProbeBuildFixture.ASK_WAITING_MARKER));
      host.requestStop("test");
      await host.waitForStopAsync();
      const result = await running;

      Assert.areEqual(1, result.code, result.error);
      Assert.areEqual(JSON.stringify({ code: "Disconnected", message: "The runtime went away while the command ran." }), result.error.trimEnd());
      Assert.areEqual(String.empty, result.output);
      await ProbeBuildFixture.waitUntilWaitingAsync(build.locate(ProbeBuildFixture.ASK_ENDED_MARKER));
    }
    finally {
      input.end();
    }
  }

  @TestMethod
  public async runsHandlersThatTakeOnlyTheValuesOrTheValuesAndTheSignalAsBefore(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const twoArguments = await fixture.runModuleAsync(build, ["probe", "call-runtime", "hi"]);
    const oneArgument = await fixture.runModuleAsync(build, ["probe", "echo-values", "hi", "--level", "2", "--json"]);

    Assert.areEqual(0, twoArguments.code, twoArguments.error);
    Assert.areEqual("The runtime answered hi.\n", twoArguments.output);
    Assert.areEqual(0, oneArgument.code, oneArgument.error);
    Assert.areEqual("hi", JsonReader.parse(oneArgument.output).readString("text"));
  }
}
