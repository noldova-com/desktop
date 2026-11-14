/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type Event, QuitAnswer, QuitAnswered, ShellClients, ShellEvents, ShellMethods, StopPolicy, StopRequest } from "@noldova/desktop.protocol";
import { DataDirectory, DiscoveryReader, Endpoint, RuntimeBuild, RuntimeClient } from "@noldova/desktop.runtime";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";
import { WaitFixture } from "../fixtures/wait.fixture.js";

@TestClass
export class CliTests {
  private static readonly CLEANUP_GRACE: number = 5_000;

  @TestMethod
  public async usesTheGivenDataDirectoryOrElseTheDevelopmentOrPersonalOne(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const development = { ...fixture.environment, [CliFixture.CHECKOUT_VARIABLE]: fixture.root };

    const personal = await fixture.runAsync(["status"]);
    const checkout = await fixture.runAsync(["status"], null, development);
    const variable = await fixture.runAsync(["status"], null, { ...development, [CliFixture.DATA_DIRECTORY_VARIABLE]: path.join(fixture.root, "chosen") });
    const relative = await fixture.runAsync(["status", "--data-dir=relative-data"]);

    Assert.areEqual(`No runtime is running for ${path.join(fixture.homeFolder, ".noldova", "desktop")}.\n`, personal.error);
    Assert.areEqual(`No runtime is running for ${path.join(fixture.root, "_build", "data")}.\n`, checkout.error);
    Assert.areEqual(`No runtime is running for ${path.join(fixture.root, "chosen")}.\n`, variable.error);
    Assert.areEqual(`No runtime is running for ${path.resolve("relative-data")}.\n`, relative.error);
  }

  @TestMethod
  public async passesACommandsArgumentsFromTheCommandLineAFileOrStandardInput(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const argumentsFile = path.join(fixture.root, "arguments.json");
    await writeFile(argumentsFile, "{\"from\":\"file\"}");

    const inline = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{\"from\":\"line\"}", "--json"]));
    const file = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--args-file", argumentsFile, "--json"]));
    const input = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "-", "--json"]), null, fixture.environment, "[1,2]");

    Assert.areEqual("{\"from\":\"line\"}\n", inline.output);
    Assert.areEqual("{\"from\":\"file\"}\n", file.output);
    Assert.areEqual("[1,2]\n", input.output);
  }

  @TestMethod
  public async refusesInvalidArguments(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const missing = path.join(fixture.root, "missing.json");

    const invalid = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{a"]));
    const unreadable = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--args-file", missing]));
    const badName = await fixture.runAsync(fixture.withDataDirectory(["run", "Not a name"]));

    Assert.areEqual(2, invalid.code);
    Assert.isTrue(invalid.error.startsWith("The command's arguments are not valid JSON: "), invalid.error);
    Assert.areEqual(2, unreadable.code);
    Assert.isTrue(unreadable.error.startsWith(`The arguments file ${missing} could not be read: `), unreadable.error);
    Assert.areEqual(2, badName.code);
  }

  @TestMethod
  public async startsARuntimeThatLaterCallsAttachTo(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");

    const first = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "1"]), build);
    const processId = await fixture.readRuntimeProcessIdAsync();
    const second = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "2", "--no-start"]), build);
    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]), build);

    Assert.areEqual(0, first.code, first.error);
    Assert.areEqual("1\n", first.output);
    Assert.isNotNull(processId);
    Assert.areNotEqual(process.pid, processId);
    Assert.areEqual("2\n", second.output);
    Assert.areEqual(processId, await fixture.readRuntimeProcessIdAsync());
    Assert.isTrue(status.output.includes("Modules: probe (active)\n"), status.output);
  }

  @TestMethod
  public async opensTheMainProcessWithTheSameDataDirectory(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const development = { ...fixture.environment, [CliFixture.CHECKOUT_VARIABLE]: fixture.root, ELECTRON_RUN_AS_NODE: "1" };
    const developmentData = path.join(fixture.root, "_build", "data");

    const fromCheckout = await fixture.runAsync(["open"], null, development);
    const installed = await fixture.runAsync(fixture.withDataDirectory(["open", "--json"]));
    fixture.opener.failure = new Error("No such program.");
    const failed = await fixture.runAsync(fixture.withDataDirectory(["open"]));

    Assert.areEqual(0, fromCheckout.code);
    Assert.areEqual(`Noldova Desktop Sample is opening with ${developmentData}.\n`, fromCheckout.output);
    const [checkoutOpen, installedOpen] = fixture.opener.opened;
    Assert.areEqual(process.execPath, checkoutOpen?.executable);
    Assert.areEqual(
      JSON.stringify([path.join(fixture.root, "node_modules", "@noldova", "desktop.electron", "main.js"), `--data-dir=${developmentData}`]),
      JSON.stringify(checkoutOpen?.launchArguments));
    Assert.isUndefined(checkoutOpen?.environment["ELECTRON_RUN_AS_NODE"]);
    Assert.areEqual(JSON.stringify([`--data-dir=${fixture.dataDirectory}`]), JSON.stringify(installedOpen?.launchArguments));
    Assert.areEqual(JSON.stringify({ dataDirectory: fixture.dataDirectory }), installed.output.trim());
    Assert.areEqual(1, failed.code);
    Assert.areEqual("Noldova Desktop Sample could not be started.\n", failed.error);
  }

  @TestMethod
  public async quitsTheRunningMainProcessAndSaysWhatHappened(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const noRuntime = await fixture.runAsync(fixture.withDataDirectory(["quit"]));
    await fixture.startHostAsync(build.declarationsFile);

    const noMainProcess = [await fixture.runAsync(fixture.withDataDirectory(["quit"])), await fixture.runAsync(fixture.withDataDirectory(["quit", "--json"]))];
    const answers: (QuitAnswer | null)[] = [QuitAnswer.Stayed, QuitAnswer.SaveFailed, null];
    await CliTests.connectMainProcessAsync(fixture, t => {
      const answer = answers.shift() ?? null;
      if (Object.isNull(answer))
        t.close();
      else
        void t.callAsync(ShellMethods.quitAnswered, new QuitAnswered(answer).toJson());
    });
    const kept = await fixture.runAsync(fixture.withDataDirectory(["quit"]));
    const saveFailed = await fixture.runAsync(fixture.withDataDirectory(["quit", "--json"]));
    const unanswered = await fixture.runAsync(fixture.withDataDirectory(["quit"]));
    await CliTests.connectMainProcessAsync(fixture, t => void t.callAsync(ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson()));
    const quit = await fixture.runAsync(fixture.withDataDirectory(["quit"]));
    const afterQuit = await fixture.runAsync(fixture.withDataDirectory(["quit", "--json"]));

    Assert.areEqual(`3|No runtime is running for ${fixture.dataDirectory}.\n`, `${noRuntime.code}|${noRuntime.error}`);
    Assert.areEqual("0|No main process is running.\n|0|{\"outcome\":\"NoMainProcess\"}\n", noMainProcess.map(t => `${t.code}|${t.output}`).join("|"));
    Assert.areEqual("6|Noldova Desktop Sample stayed open: it was kept open while work was in progress.\n", `${kept.code}|${kept.error}`);
    Assert.areEqual("1|{\"code\":\"Conflict\",\"message\":\"Noldova Desktop Sample stayed open: a window could not save.\"}\n", `${saveFailed.code}|${saveFailed.error}`);
    Assert.areEqual("1|Noldova Desktop Sample did not say whether it quit: its main process's connection ended before it answered.\n", `${unanswered.code}|${unanswered.error}`);
    Assert.areEqual("0|Noldova Desktop Sample quit.\n|3", `${quit.code}|${quit.output}|${afterQuit.code}`);
  }

  @TestMethod
  public async stopsWaitingForAQuitAtItsTimeoutAHangUpOrAnInterruptionAndRefusesOtherOptions(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    let asked = 0;
    const mainProcess = await CliTests.connectMainProcessAsync(fixture, () => asked++);

    const timedOut = await fixture.runAsync(fixture.withDataDirectory(["quit", "--timeout", "1", "--json"]));
    const hungUp = fixture.runAsync(fixture.withDataDirectory(["quit", "--json"]));
    await WaitFixture.untilAsync(() => Promise.resolve(asked === 2), 15_000);
    fixture.signals.emit("SIGHUP");
    const afterHangUp = await hungUp;
    const interrupted = fixture.runAsync(fixture.withDataDirectory(["quit", "--json"]));
    await WaitFixture.untilAsync(() => Promise.resolve(asked === 3), 15_000);
    fixture.signals.emit("SIGINT");
    const stopped = [afterHangUp, await interrupted];
    const refused = [await fixture.runAsync(fixture.withDataDirectory(["quit", "--no-start"])), await fixture.runAsync(fixture.withDataDirectory(["quit", "--args-file", "x.json"]))];
    mainProcess.close();

    Assert.areEqual("6|DeadlineExceeded", `${timedOut.code}|${JsonReader.parse(timedOut.error).readString("code")}`);
    Assert.areEqual("6|Cancelled,6|Cancelled", stopped.map(t => `${t.code}|${JsonReader.parse(t.error).readString("code")}`).join(","));
    Assert.areEqual("0,0", ["SIGHUP", "SIGINT"].map(t => fixture.signals.listenerCount(t)).join(","));
    Assert.areEqual("2,2", refused.map(t => t.code).join(","));
    Assert.areEqual(3, asked);
  }

  @TestMethod
  public async stopsAModuleCommandAtItsTimeoutOrAnInterruptionAndThenItsParts(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const marker = build.locate(ProbeBuildFixture.CLI_WAITING_MARKER);

    const timedOut = await fixture.runModuleAsync(build, ["probe", "wait-forever", "--timeout", "1", "--json"]);
    let afterTimeout = String.empty;
    const isSettled = await WaitFixture.untilAsync(async () => {
      afterTimeout = await build.readPartsLogAsync();
      return afterTimeout !== "activate probe\n" && (afterTimeout === String.empty || afterTimeout.endsWith("\n"));
    }, 15_000);
    await rm(marker, { force: true });
    await rm(build.locate(ProbeBuildFixture.PARTS_LOG), { force: true });
    const running = fixture.runModuleAsync(build, ["probe", "wait-forever", "--json"]);
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code, timedOut.error);
    Assert.areEqual("DeadlineExceeded", JsonReader.parse(timedOut.error).readString("code"));
    Assert.isTrue(isSettled && [String.empty, "activate probe\ndeactivate probe\n"].includes(afterTimeout), afterTimeout);
    Assert.areEqual(6, interrupted.code, interrupted.error);
    Assert.areEqual("Cancelled", JsonReader.parse(interrupted.error).readString("code"));
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
    Assert.areEqual("activate probe\ndeactivate probe\n", await build.readPartsLogAsync());
  }

  @TestMethod
  public async letsAModuleCommandsCleanupRequestReachTheRuntimeAfterItsTimeoutOrAnInterruption(): Promise<void> {
    await using fixture = await CliFixture.createAsync(CliTests.CLEANUP_GRACE);
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const waiting = build.locate(ProbeBuildFixture.CLI_WAITING_MARKER);
    const cleaned = build.locate(ProbeBuildFixture.CLEANED_UP_MARKER);

    const timedOut = await fixture.runModuleAsync(build, ["probe", "tidy", "--timeout", "1", "--json"]);
    const isCleanedAtTimeout = existsSync(cleaned);
    await rm(waiting, { force: true });
    await rm(cleaned, { force: true });
    const running = fixture.runModuleAsync(build, ["probe", "tidy", "--json"]);
    await ProbeBuildFixture.waitUntilWaitingAsync(waiting);
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code, timedOut.error);
    Assert.areEqual("DeadlineExceeded", JsonReader.parse(timedOut.error).readString("code"));
    Assert.isTrue(isCleanedAtTimeout);
    Assert.areEqual(6, interrupted.code, interrupted.error);
    Assert.areEqual("Cancelled", JsonReader.parse(interrupted.error).readString("code"));
    Assert.isTrue(existsSync(cleaned));
    Assert.areEqual(String.empty, interrupted.output);
  }

  @TestMethod
  public async cutsOffACleanupRequestThatOutlivesTheGraceAndEndsAtOnceAtASecondInterruption(): Promise<void> {
    await using fixture = await CliFixture.createAsync(CliTests.CLEANUP_GRACE);
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const waiting = build.locate(ProbeBuildFixture.CLI_WAITING_MARKER);
    const sent = build.locate(ProbeBuildFixture.CLEANUP_SENT_MARKER);
    const interruptAsync = async (times: number): Promise<{ code: number; error: string; afterFirst: number; afterLast: number }> => {
      await rm(waiting, { force: true });
      await rm(sent, { force: true });
      const running = fixture.runModuleAsync(build, ["probe", "tidy-slowly", "--json"]);
      await ProbeBuildFixture.waitUntilWaitingAsync(waiting);
      const first = performance.now();
      fixture.signals.emit("SIGINT");
      await ProbeBuildFixture.waitUntilWaitingAsync(sent);
      const last = performance.now();
      if (times > 1)
        fixture.signals.emit("SIGINT");
      const result = await running;
      const end = performance.now();
      return { ...result, afterFirst: end - first, afterLast: end - last };
    };

    const cutOff = await interruptAsync(1);
    const ended = await interruptAsync(2);

    Assert.areEqual("6|Cancelled,6|Cancelled", [cutOff, ended].map(t => `${t.code}|${JsonReader.parse(t.error).readString("code")}`).join(","));
    Assert.isFalse(existsSync(build.locate(ProbeBuildFixture.CLEANED_UP_MARKER)));
    Assert.isTrue(cutOff.afterFirst >= CliTests.CLEANUP_GRACE - 100, `The interruption ended the command after ${cutOff.afterFirst} ms, before its ${CliTests.CLEANUP_GRACE} ms grace.`);
    Assert.isTrue(ended.afterLast < 2_500, `The second interruption ended the command after ${ended.afterLast} ms.`);
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
  }

  @TestMethod
  public async stopsAModuleCommandWhosePartNeverFinishesStartingWithoutWaitingForThatPart(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const marker = build.locate(ProbeBuildFixture.STALLED_MARKER);

    const timedOut = await fixture.runModuleAsync(build, ["stalled", "run", "--timeout", "1", "--json"]);
    const afterTimeout = await build.readPartsLogAsync();
    await rm(marker, { force: true });
    await rm(build.locate(ProbeBuildFixture.PARTS_LOG), { force: true });
    const running = fixture.runModuleAsync(build, ["stalled", "run", "--json"]);
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code, timedOut.error);
    Assert.areEqual("DeadlineExceeded", JsonReader.parse(timedOut.error).readString("code"));
    Assert.areEqual(6, interrupted.code, interrupted.error);
    Assert.areEqual("Cancelled", JsonReader.parse(interrupted.error).readString("code"));
    Assert.isTrue([String.empty, "activate stalled\n"].includes(afterTimeout), afterTimeout);
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
    Assert.areEqual("activate stalled\n", await build.readPartsLogAsync());
  }

  @TestMethod
  public async stopsAModuleCommandWhenItsModuleTurnsOffAndThenItsPartsButNotTheCommandsOfOtherModules(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await build.addSwitchedModulesAsync();
    await fixture.startHostAsync(build.declarationsFile);
    const off = "It is off; the setting switchy.enabled turns it on.";
    const probe = fixture.runModuleAsync(build, ["probe", "wait-forever", "--json"]);
    await ProbeBuildFixture.waitUntilWaitingAsync(build.locate(ProbeBuildFixture.CLI_WAITING_MARKER));

    const switchy = await fixture.runModuleAsync(build, ["switchy", "sleep", "--json", "--timeout", "15"]);
    const status = await fixture.runModuleAsync(build, ["status", "--json"]);
    fixture.signals.emit("SIGINT");
    const interrupted = await probe;
    const modules = JsonReader.parse(status.output).readObjectArray("modules");

    Assert.areEqual(7, switchy.code, switchy.error);
    Assert.areEqual(JSON.stringify({ code: "ModuleNotActive", message: `The module switchy is not active: ${off}`, details: { module: "switchy", cause: off } }),
      switchy.error.trimEnd());
    Assert.areEqual("Off", modules.find(t => t.readString("id") === "switchy")?.readString("state"));
    Assert.areEqual(6, interrupted.code, interrupted.error);
    Assert.areEqual("Cancelled", JsonReader.parse(interrupted.error).readString("code"));
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
    Assert.areEqual("activate probe\nactivate switchy\ndeactivate switchy\ndeactivate probe\n", await build.readPartsLogAsync());
  }

  private static async connectMainProcessAsync(fixture: CliFixture, onQuitting: (client: RuntimeClient) => void): Promise<RuntimeClient> {
    const discovery = await DiscoveryReader.readAsync(new DataDirectory(fixture.dataDirectory));
    const connected = Promise.withResolvers<RuntimeClient>();
    const client = await RuntimeClient.connectAsync(Endpoint.parse(String(discovery?.endpoint)), String(discovery?.token), RuntimeBuild.identity, ShellClients.mainProcess, {
      onEvent: (event: Event) => {
        if (event.name.equals(ShellEvents.quitting))
          void connected.promise.then(onQuitting);
      },
      onDisconnected: () => undefined
    });
    connected.resolve(client);
    return client;
  }
}
