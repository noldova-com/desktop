/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildIdentity } from "@noldova/desktop.protocol";
import { DataDirectory, RuntimeBuild } from "@noldova/desktop.runtime";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliFailureTests {
  @TestMethod
  public async reportsThatNoRuntimeIsRunningWithoutStartingOne(): Promise<void> {
    await using fixture = await CliFixture.createAsync();

    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]));
    const json = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));
    const commands = await fixture.runAsync(fixture.withDataDirectory(["commands", "--no-start"]));

    Assert.areEqual(3, status.code);
    Assert.areEqual(`No runtime is running for ${fixture.dataDirectory}.\n`, status.error);
    Assert.areEqual(3, json.code);
    Assert.areEqual(JSON.stringify({ code: "NoRuntime", message: `No runtime is running for ${fixture.dataDirectory}.` }), json.error.trim());
    Assert.areEqual(3, commands.code);
    Assert.isFalse(existsSync(new DataDirectory(fixture.dataDirectory).logsFolder), "no runtime was started");
  }

  @TestMethod
  public async refusesAnotherBuildsRuntimeUnlessTakingItOver(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using older = await ProbeBuildFixture.createAsync("0.0.0");
    await using newer = await ProbeBuildFixture.createAsync("999.0.0");
    const host = await fixture.startHostAsync(newer.declarationsFile);

    const fromNewer = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]), newer);
    const fromOlder = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]), older);
    const quitFromOlder = await fixture.runAsync(fixture.withDataDirectory(["quit", "--json"]), older);
    const work = host.work.begin("Indexing the project");
    const busy = await fixture.runAsync(fixture.withDataDirectory(["commands", "--take-over", "--json"]), newer);
    work[Symbol.dispose]();
    const takenOver = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "\"taken\"", "--take-over"]), newer);

    Assert.areEqual(4, fromNewer.code);
    const refusal = JsonReader.parse(fromNewer.error);
    Assert.areEqual("BuildMismatch", refusal.readString("code"));
    Assert.areEqual(RuntimeBuild.identity.fingerprint, refusal.readObject("details").readObject("identity").readString("fingerprint"));
    Assert.areEqual(4, fromOlder.code);
    Assert.areEqual("BuildMismatch", JsonReader.parse(fromOlder.error).readString("code"));
    Assert.areEqual("4|BuildMismatch", `${quitFromOlder.code}|${JsonReader.parse(quitFromOlder.error).readString("code")}`);
    Assert.areEqual(4, busy.code);
    Assert.areEqual(JSON.stringify({ descriptions: ["Indexing the project"] }), JSON.stringify(JsonReader.parse(busy.error).readValue("details")));
    Assert.areEqual(0, takenOver.code, takenOver.error);
    Assert.areEqual("\"taken\"\n", takenOver.output);
    Assert.areEqual("request", await host.waitForStopAsync());
  }

  @TestMethod
  public async reportsDataFromBeforeTheShellWithoutMovingIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await mkdir(fixture.dataDirectory, { recursive: true });
    const old = path.join(fixture.dataDirectory, "noldova-desktop.db");
    await writeFile(old, "old data");
    await fixture.startHostAsync(build.declarationsFile);

    const result = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]));

    Assert.areEqual(5, result.code);
    const failure = JsonReader.parse(result.error);
    Assert.areEqual("PreShellData", failure.readString("code"));
    Assert.areEqual(fixture.dataDirectory, failure.readObject("details").readString("location"));
    Assert.areEqual("old data", await readFile(old, "utf8"));
  }

  @TestMethod
  public async reportsADataDirectoryItCannotUse(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const file = path.join(fixture.root, "file");
    await writeFile(file, "not a folder");

    const result = await fixture.runAsync(["commands", "--data-dir", path.join(file, "data")], build);

    Assert.areEqual(5, result.code);
    Assert.isTrue(result.error.startsWith("The data directory cannot be used: "), result.error);
  }

  @TestMethod
  public async reportsARuntimeOfAnotherProgram(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const discoveryFile = new DataDirectory(fixture.dataDirectory).discoveryFile;
    const discovery = JsonReader.parse(await readFile(discoveryFile, "utf8"));
    await writeFile(discoveryFile, JSON.stringify({ ...discovery.toJson(), token: "x".repeat(discovery.readString("token").length) }));

    const result = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));

    Assert.areEqual(5, result.code);
    Assert.areEqual("Unauthorized", JsonReader.parse(result.error).readString("code"));
  }

  @TestMethod
  public async reportsAnUnknownCommandAndOneThatFails(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);

    const unknown = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.nothing", "--json"]));
    const refused = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.fail"]));
    const refusedJson = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.fail", "--json"]));

    Assert.areEqual(1, unknown.code);
    Assert.areEqual("NotFound", JsonReader.parse(unknown.error).readString("code"));
    Assert.areEqual(1, refused.code);
    Assert.areEqual("The runtime failed to handle the request.\n", refused.error);
    Assert.areEqual("{\"code\":\"Internal\",\"message\":\"The runtime failed to handle the request.\"}\n", refusedJson.error);
  }

  @TestMethod
  public async reportsACommandStoppedAtItsTimeoutOrByAnInterruption(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const marker = ProbeBuildFixture.markerPath(fixture.dataDirectory);

    const timedOut = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--timeout", "1", "--json"]));
    await rm(marker, { force: true });
    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]));
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code);
    Assert.areEqual("DeadlineExceeded", JsonReader.parse(timedOut.error).readString("code"));
    Assert.areEqual(6, interrupted.code);
    Assert.areEqual("Cancelled", JsonReader.parse(interrupted.error).readString("code"));
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
  }

  @TestMethod
  public async reportsARuntimeThatEndsDuringACommandAndOneThatCannotStart(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const marker = ProbeBuildFixture.markerPath(fixture.dataDirectory);

    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]), build);
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    await fixture.stopRuntimeAsync();
    const lost = await running;
    const broken = { identity: new BuildIdentity("1.0.0", RuntimeBuild.identity.protocolVersion, "broken"), entryPath: path.join(fixture.root, "missing-entry.js") };
    const notStarted = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]), broken);

    Assert.areEqual(1, lost.code);
    Assert.areEqual("Disconnected", JsonReader.parse(lost.error).readString("code"));
    Assert.areEqual(1, notStarted.code);
    Assert.areEqual("Failed", JsonReader.parse(notStarted.error).readString("code"));
  }

  @TestMethod
  public async reportsACommandLeftUnansweredOnAnOpenConnectionAsUnavailable(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");

    let unanswered: { code: number; output: string; error: string };
    try {
      unanswered = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.block", "--timeout", "1", "--json"]), build);
    }
    finally {
      await ProbeBuildFixture.markAsync(ProbeBuildFixture.releasePath(fixture.dataDirectory));
    }
    const answered = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "1", "--json"]), build);

    Assert.areEqual(1, unanswered.code);
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "The runtime did not answer desktop.runCommand in time." }), JSON.stringify(JsonReader.parse(unanswered.error).toJson()));
    Assert.isTrue(existsSync(ProbeBuildFixture.markerPath(fixture.dataDirectory)), "the probe's command started blocking the runtime");
    Assert.areEqual(0, answered.code);
    Assert.areEqual("1\n", answered.output);
  }

  @TestMethod
  public async letsAnUnexpectedErrorReachItsCaller(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const starter = { startAsync: (): Promise<number> => Promise.reject(new RangeError("The starter broke.")) };

    const run = fixture.runAsync(fixture.withDataDirectory(["commands"]), null, fixture.environment, String.empty, starter);

    Assert.areEqual("The starter broke.", (await Assert.throwsAsync(() => run, RangeError)).message);
  }
}
