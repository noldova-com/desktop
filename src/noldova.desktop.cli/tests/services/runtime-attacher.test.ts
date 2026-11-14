/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellClients, ShellEvents, ShellMethods, UpdateReady, UpdateRequest } from "@noldova/desktop.protocol";
import {
  DataDirectory, Installation, LaunchSettings, ProcessPresence, RuntimeBuild, RuntimeEntry, RuntimeLauncher, UpdateBarrier, UpdateBarrierState
} from "@noldova/desktop.runtime";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";
import { WatchLimitFixture } from "../fixtures/watch-limit.fixture.js";

@TestClass
export class RuntimeAttacherTests {
  @TestMethod
  public async reportsAnUpdateStillUnderWayAfterWaitingForIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const device = path.join(fixture.root, "device");
    await RuntimeAttacherTests.holdBarrierAsync(Installation.locate(device, process.execPath, process.platform));

    const waited = await fixture.runAsync(fixture.withDataDirectory(["commands", "--device-dir", device, "--json"]), null, { ...fixture.environment, SystemRoot: process.env["SystemRoot"] }, String.empty, undefined, 300);

    Assert.areEqual(8, waited.code);
    Assert.areEqual(JSON.stringify({ code: "Updating", message: "Noldova Desktop Sample is installing an update." }), waited.error.trim());
    Assert.isFalse(existsSync(new DataDirectory(fixture.dataDirectory).logsFolder), "no runtime was started");
  }

  @TestMethod
  public async writesTheInstallationWatchFallbackToItsErrorsWhileItWaitsForAnUpdate(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const device = path.join(fixture.root, "device");
    await RuntimeAttacherTests.holdBarrierAsync(Installation.locate(device, process.execPath, process.platform));
    using _watches = new WatchLimitFixture();

    const waited = await fixture.runAsync(fixture.withDataDirectory(["commands", "--device-dir", device, "--json"]), null, { ...fixture.environment, SystemRoot: process.env["SystemRoot"] }, String.empty, undefined, 300);

    Assert.areEqual(8, waited.code);
    Assert.areEqual(1, waited.error.split("so the command line checks whether the update has ended every 1000 ms instead").length - 1);
  }

  @TestMethod
  public async answersARuntimePreparingForAnUpdateAndReportsTheUpdate(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const installation = Installation.locate(fixture.deviceFolder, process.execPath, process.platform);
    await fixture.startHostAsync(build.declarationsFile, installation);
    await RuntimeAttacherTests.holdBarrierAsync(installation);
    const settings = new LaunchSettings(new DataDirectory(fixture.dataDirectory), process.execPath, RuntimeEntry.entryPath, fixture.environment, process.platform);
    const mainProcess = await new RuntimeLauncher(settings, RuntimeBuild.identity, new Installation(installation, () => Promise.resolve(false)), () => undefined).attachAsync("main", { onEvent: () => undefined, onDisconnected: () => undefined });

    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]));
    await ProbeBuildFixture.waitUntilWaitingAsync(ProbeBuildFixture.markerPath(fixture.dataDirectory));
    const prepared = await mainProcess.callAsync(ShellMethods.update, new UpdateRequest(installation).toJson());
    const answered = await running;
    const refused = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]), null, fixture.environment, String.empty, undefined, 300);
    mainProcess.close();

    Assert.areEqual(`${process.pid} cli`, UpdateReady.fromJson(prepared.payload).processes.map(t => `${t.processId} ${t.role}`).join("|"));
    Assert.areEqual(8, answered.code);
    Assert.areEqual("Updating", JsonReader.parse(answered.error).readString("code"));
    Assert.areEqual(8, refused.code);
    Assert.areEqual(JSON.stringify({ code: "Updating", message: "Noldova Desktop Sample is preparing to install an update." }), refused.error.trim());
  }

  @TestMethod
  public async reportsTheUpdateToAQuitThatWaitsWhenTheRuntimePreparesForOne(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const installation = Installation.locate(fixture.deviceFolder, process.execPath, process.platform);
    await fixture.startHostAsync(build.declarationsFile, installation);
    await RuntimeAttacherTests.holdBarrierAsync(installation);
    const settings = new LaunchSettings(new DataDirectory(fixture.dataDirectory), process.execPath, RuntimeEntry.entryPath, fixture.environment, process.platform);
    const asked = Promise.withResolvers<void>();
    const mainProcess = await new RuntimeLauncher(settings, RuntimeBuild.identity, new Installation(installation, () => Promise.resolve(false)), () => undefined).attachAsync(ShellClients.mainProcess, {
      onEvent: t => {
        if (t.name.equals(ShellEvents.quitting))
          asked.resolve();
      },
      onDisconnected: () => undefined
    });

    const quitting = fixture.runAsync(fixture.withDataDirectory(["quit", "--json"]));
    await asked.promise;
    await mainProcess.callAsync(ShellMethods.update, new UpdateRequest(installation).toJson());
    const answered = await quitting;
    mainProcess.close();

    Assert.areEqual("8|Updating", `${answered.code}|${JsonReader.parse(answered.error).readString("code")}`);
  }

  @TestMethod
  public async writesTheWatchFallbackToItsErrorsWhenTheDiscoveryFolderCannotBeWatched(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    using _watches = new WatchLimitFixture();
    const discoveryFolder = new DataDirectory(fixture.dataDirectory).discoveryFolder;

    const result = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));

    Assert.areEqual(3, result.code);
    Assert.isTrue(result.error.startsWith(`The folder ${discoveryFolder} could not be watched for changes, so the launcher checks it every 100 ms instead: Error: ENOSPC`),
      result.error);
    Assert.areEqual("NoRuntime", JsonReader.parse(result.error.split("\n")[1] ?? String.empty).readString("code"));
  }

  private static async holdBarrierAsync(folder: string): Promise<void> {
    const [holder] = await ProcessPresence.create(process.platform).stampAsync([[process.pid, "main"]]);
    Assert.isDefined(holder);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "barrier.json"), JSON.stringify(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing, null).toJson()));
  }
}
