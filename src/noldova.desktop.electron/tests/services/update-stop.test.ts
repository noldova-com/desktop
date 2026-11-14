/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, Response, UpdateProcess, UpdateReady } from "@noldova/desktop.protocol";
import { ConnectionClosedException, type IProcessStarter, Installation, UpdateBarrier, UpdateBarrierState } from "@noldova/desktop.runtime";
import {
  AppImageRestart, DatabasesNotBackedUpException, type IUpdateTarget, InstallerNotHeldException, InstallerUnsignedException, ProcessesNotExitedException,
  UpdateHolderNotFoundException, UpdateRefusedException, UpdateRuntimeNotReachedException, UpdateStop, UpdateStopException, UpdateStopFailedUnexpectedlyException,
  UpdateUnderWayException, UpdateUnsavedException, WorkStartedMeanwhileException
} from "@noldova/desktop.electron";

import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { FakeProcessPresence } from "../fixtures/fake-process-presence.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { LinuxLaunchFixture } from "../fixtures/linux-launch.fixture.js";

@TestClass
export class UpdateStopTests {
  private static readonly SELF: number = 4120;
  private static readonly REFUSED: Failure = new Failure(FailureCode.Updating, "Noldova Desktop Sample is preparing to install an update.");

  private readonly presence: FakeProcessPresence = new FakeProcessPresence();
  private readonly connections: Map<string, FakeRuntimeConnection> = new Map();
  private readonly asked: (readonly string[])[] = [];
  private readonly waits: number[] = [];
  private readonly lines: string[] = [];
  private readonly changes: Map<string, () => void> = new Map();
  private answer: boolean = true;
  private rereads: boolean = false;
  private isWaitedOut: boolean = false;
  private onAsk: (() => void) | undefined;
  private onWait: (() => void) | undefined;
  private time: number = 0;
  private onConnect: ((dataDirectory: string) => Promise<void>) | undefined;
  private onQuestion: ((readWorkAsync: () => Promise<readonly string[]>, waitForChangeAsync: (signal: AbortSignal) => Promise<void>) => Promise<void>) | undefined;

  public constructor() {
    this.onQuestion = undefined;
    this.onAsk = undefined;
    this.onWait = undefined;
    this.onConnect = undefined;
  }

  @TestMethod
  public handsOffOnceEveryRuntimeAndProcessHasExitedAndTheOtherMainProcessesHaveQuit(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const second = await this.recordAsync(installation, folder, "second");
      const program = new UpdateProcess(7001, 1500, 1501, "program");
      const other = new UpdateProcess(4130, 1500, 1501, "main");
      const self = new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "main");
      const unconnected = new UpdateProcess(4140, 1500, 1501, "main");
      this.ready(first, [program, other, self]);
      this.ready(second, []);
      this.presence.running.add(7001).add(4130).add(4140).add(UpdateStopTests.SELF);
      await installation.recordMainProcessAsync(self);
      await installation.recordMainProcessAsync(other);
      await installation.recordMainProcessAsync(unconnected);
      const states: string[] = [];
      this.presence.onCheck = t => {
        if (t.processId === 7001 && this.waits.length === 1)
          this.presence.running.delete(7001);
        if ((t.processId === 4130 || t.processId === 4140) && this.waits.length > 1) {
          states.push(`${t.processId} ${JsonReader.parse(String(this.readBarrier(installation))).readString("state")}`);
          this.presence.running.delete(t.processId);
        }
      };
      let handedOff = String.empty;

      const result = await this.create(installation).runAsync("0.3.0", async () => {
        handedOff = await readFile(installation.barrierFile, "utf8");
        return null;
      });

      Assert.isTrue(result.isHandedOff);
      Assert.isTrue(result.isHandoffRecorded);
      Assert.areEqual(JSON.stringify(new UpdateBarrier(new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "main"), "0.3.0", UpdateBarrierState.HandedOff, null).toJson()), handedOff);
      Assert.areEqual("4130 Closing|4140 Closing", states.join("|"));
      Assert.areEqual("desktop.work|desktop.update|desktop.work|desktop.stop", this.connections.get(first)?.calls.join("|"));
      Assert.areEqual("desktop.work|desktop.update|desktop.work|desktop.stop", this.connections.get(second)?.calls.join("|"));
      Assert.areEqual(JSON.stringify({ policy: "IfIdle" }), JSON.stringify(this.connections.get(first)?.payloads[3]));
      Assert.isTrue([...this.connections.values()].every(t => t.isClosed));
      Assert.areEqual("250|250", this.waits.join("|"));
      Assert.areEqual(1, this.presence.checked.filter(t => t === UpdateStopTests.SELF).length);
      Assert.areEqual(0, this.asked.length);
    });
  }

  @TestMethod
  public cancelsWithNothingChangedWhenThePersonKeepsTheWork(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.answer = false;
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      let isHandedOff = false;

      const result = await this.create(installation).runAsync("0.3.0", async () => {
        isHandedOff = true;
        return null;
      });

      Assert.isFalse(result.isHandedOff);
      Assert.isFalse(result.isHandoffRecorded);
      Assert.isFalse(isHandedOff);
      Assert.areEqual(JSON.stringify([[`A reply (${first})`]]), JSON.stringify(this.asked));
      Assert.areEqual("desktop.work", this.connection(first).calls.join("|"));
      Assert.isTrue(this.connection(first).isClosed);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public stopsOnlyTheWorkThePersonAgreedToAndSkipsADirectoryNotInUse(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const unused = await this.recordAsync(installation, folder, "unused");
      const idle = await this.recordAsync(installation, folder, "idle");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.ready(first, []);
      this.rereads = true;

      const result = await this.create(installation, t => t === unused).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result.isHandedOff);
      Assert.areEqual(JSON.stringify([[`A reply (${first})`], [`A reply (${first})`]]), JSON.stringify(this.asked));
      Assert.areEqual("desktop.work|desktop.work|desktop.update|desktop.work|desktop.stop", this.connection(first).calls.join("|"));
      Assert.isFalse(this.connections.has(unused));
      Assert.areEqual(JSON.stringify({ policy: "StopWork" }), JSON.stringify(this.connection(first).payloads[4]));
      Assert.areEqual("desktop.work|desktop.work|desktop.update|desktop.work|desktop.stop", this.connection(idle).calls.join("|"));
      Assert.areEqual(JSON.stringify({ policy: "IfIdle" }), JSON.stringify(this.connection(idle).payloads[4]));
    });
  }

  @TestMethod
  public dropsTheWorkOfARuntimeThatLeavesWhileThePersonWaits(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const second = await this.recordAsync(installation, folder, "second");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.connection(second).answers.set("desktop.work", Response.success("r", { descriptions: ["A command"], sequence: 1 }));
      this.rereads = true;
      this.onAsk = () => {
        this.connection(second).rejection = new ConnectionClosedException();
      };

      const result = await this.create(installation, t => t === second && this.asked.length > 0).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result.isHandedOff);
      Assert.areEqual(JSON.stringify([`A command (${second})`, `A reply (${first})`]), JSON.stringify([...this.asked[0] ?? []].sort()));
      Assert.areEqual(JSON.stringify([`A reply (${first})`]), JSON.stringify(this.asked[1]));
      Assert.isTrue(this.connection(second).isClosed);
      Assert.areEqual("desktop.work|desktop.work", this.connection(second).calls.join("|"));
      Assert.areEqual("desktop.work|desktop.work|desktop.update|desktop.work|desktop.stop", this.connection(first).calls.join("|"));
    });
  }

  @TestMethod
  public stopsTheWorkShownWhenThePersonChoseStopIncludingWorkThatStartedWhileTheyWaited(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.rereads = true;
      this.onAsk = () => {
        this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply", "A command"], sequence: 2 }));
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result.isHandedOff);
      Assert.areEqual(JSON.stringify([`A reply (${first})`, `A command (${first})`]), JSON.stringify(this.asked[1]));
      Assert.areEqual("desktop.work|desktop.work|desktop.update|desktop.work|desktop.stop", this.connection(first).calls.join("|"));
      Assert.areEqual(JSON.stringify({ policy: "StopWork" }), JSON.stringify(this.connection(first).payloads[4]));
    });
  }

  @TestMethod
  public wakesTheQuestionOnAChangeEvenOneBeforeItWaitsAndEndsTheWaitWithTheQuestion(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.answer = false;
      const outcomes: unknown[] = [];
      this.onQuestion = async (_read, waitForChange) => {
        const question = new AbortController();
        this.change(first);
        await waitForChange(question.signal);
        let isWoken = false;
        const waiting = waitForChange(question.signal).then(() => {
          isWoken = true;
        });
        await setImmediate();
        outcomes.push(isWoken);
        this.change(first);
        await waiting;
        const ended = waitForChange(question.signal).then(() => "woken", () => "ended");
        question.abort();
        outcomes.push(await ended);
        outcomes.push(await waitForChange(question.signal).then(() => "woken", () => "ended"));
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isFalse(result.isHandedOff);
      Assert.areEqual(JSON.stringify([false, "ended", "ended"]), JSON.stringify(outcomes));
    });
  }

  @TestMethod
  public wakesTheQuestionWhenARuntimeDisconnectsAndDropsItsWork(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const second = await this.recordAsync(installation, folder, "second");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.connection(second).answers.set("desktop.work", Response.success("r", { descriptions: ["A command"], sequence: 1 }));
      this.answer = false;
      const reads: (readonly string[])[] = [];
      this.onQuestion = async (read, waitForChange) => {
        this.connection(second).rejection = new ConnectionClosedException();
        this.change(second);
        await waitForChange(new AbortController().signal);
        reads.push(await read());
      };

      await this.create(installation).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.areEqual(JSON.stringify([[`A reply (${first})`]]), JSON.stringify(reads));
      Assert.isTrue(this.connection(second).isClosed);
    });
  }

  @TestMethod
  public failsWhenWorkStartsAgainAfterThePersonWaitedForItToFinish(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.isWaitedOut = true;

      const failure = await this.failAsync(installation, WorkStartedMeanwhileException);

      Assert.areEqual(`Work started while Noldova Desktop Sample prepared to update: A reply (${first})`, failure.message);
      Assert.areEqual("desktop.work|desktop.update|desktop.work", this.connection(first).calls.join("|"));
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public keepsItsReasonAndLogsABarrierItCannotRemoveEvenWhenItTriesAgain(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.isWaitedOut = true;
      using _rm = new FailingFileCallFixture("rm", installation.barrierFile, "EBUSY");

      const failure = await this.failAsync(installation, WorkStartedMeanwhileException);

      Assert.areEqual(`Work started while Noldova Desktop Sample prepared to update: A reply (${first})`, failure.message);
      Assert.areEqual(JSON.stringify([
        `The update's barrier could not be removed after the update stopped, even when tried again: Error: EBUSY: operation failed, rm '${installation.barrierFile}'`
      ]), JSON.stringify(this.lines));
      Assert.areEqual(1000, this.waits.at(-1));
      Assert.isTrue(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public removesItsBarrierWhenTheSecondTryWorks(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.isWaitedOut = true;
      const rm = new FailingFileCallFixture("rm", installation.barrierFile, "EBUSY");
      this.onWait = () => rm[Symbol.dispose]();
      try {
        const failure = await this.failAsync(installation, WorkStartedMeanwhileException);

        Assert.areEqual(`Work started while Noldova Desktop Sample prepared to update: A reply (${first})`, failure.message);
        Assert.areEqual("[]", JSON.stringify(this.lines));
        Assert.areEqual(JSON.stringify([1000]), JSON.stringify(this.waits));
        Assert.isFalse(existsSync(installation.barrierFile));
      }
      finally {
        rm[Symbol.dispose]();
      }
    });
  }

  @TestMethod
  public closesTheConnectionsItOpenedWhenAnotherDataDirectoryCannotBeReached(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const second = await this.recordAsync(installation, folder, "second");
      const unreachable = new UpdateRuntimeNotReachedException(second);
      this.onConnect = t => t === second ? Promise.reject(unreachable) : Promise.resolve();

      const failure = await this.failAsync(installation, UpdateRuntimeNotReachedException);

      Assert.areEqual(unreachable, failure);
      Assert.isTrue(this.connection(first).isClosed);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsWhenTheWorkCannotBeReadAgainForAnotherReason(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("desktop.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.rereads = true;
      const invalid = new Error("The frame was not valid.");
      this.onAsk = () => {
        this.connection(first).rejection = invalid;
      };

      const failure = await this.failAsync(installation, UpdateStopFailedUnexpectedlyException);

      Assert.areEqual("The update stopped on an unexpected error.", failure.message);
      Assert.areEqual(invalid, failure.cause);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsWithNothingChangedWhenAnotherUpdateHoldsTheBarrier(): Promise<void> {
    return this.runAsync(async installation => {
      const other = new UpdateBarrier(new UpdateProcess(4130, 1500, 1501, "main"), "0.4.0", UpdateBarrierState.Preparing, null);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(other.toJson()));
      this.presence.running.add(4130);

      const failure = await this.failAsync(installation, UpdateUnderWayException);

      Assert.areEqual("Another update of Noldova Desktop Sample is under way.", failure.message);
      Assert.areEqual(JSON.stringify(other.toJson()), this.readBarrier(installation));
    });
  }

  @TestMethod
  public failsWithNothingChangedWhenItCannotFindItsOwnProcessOrARuntimeWillNotSayItsWork(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.presence.isStamping = false;
      const unstamped = await this.failAsync(installation, UpdateHolderNotFoundException);
      this.presence.isStamping = true;
      this.connections.clear();
      this.connection(first).answers.set("desktop.work", Response.failure("r", UpdateStopTests.REFUSED));
      const unread = await this.failAsync(installation, UpdateRefusedException);

      Assert.areEqual("Noldova Desktop Sample could not find its own process in the process table.", unstamped.message);
      Assert.areEqual(`The runtime of ${first} could not prepare for the update: Noldova Desktop Sample is preparing to install an update.`, unread.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenWorkStartsMeanwhile(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const late = join(folder, "late");
      await mkdir(late);
      this.connection(late).answers.set("desktop.work", Response.success("r", { descriptions: ["A command"], sequence: 1 }));
      this.onConnect = async t => {
        if (t === first)
          await installation.recordAsync(late);
      };

      const failure = await this.failAsync(installation, WorkStartedMeanwhileException);

      Assert.areEqual(`Work started while Noldova Desktop Sample prepared to update: A command (${late})`, failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
      Assert.isTrue(this.connection(first).isClosed && this.connection(late).isClosed);
      Assert.areEqual("desktop.work|desktop.update|desktop.work", this.connection(first).calls.join("|"));
      Assert.areEqual("desktop.update|desktop.work", this.connection(late).calls.join("|"));
    });
  }

  @TestMethod
  public failsWhenWorkThePersonDidNotSeeStartedWhileTheyDecided(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const reads = [["A reply"], ["A reply", "A command"]];
      this.connection(first).deferred.set("desktop.work", () => Promise.resolve(Response.success("r", { descriptions: reads.shift() ?? [], sequence: 1 })));

      const failure = await this.failAsync(installation, WorkStartedMeanwhileException);

      Assert.areEqual(`Work started while Noldova Desktop Sample prepared to update: A command (${first})`, failure.message);
      Assert.areEqual(1, this.asked.length);
      Assert.areEqual("desktop.work|desktop.update|desktop.work", this.connection(first).calls.join("|"));
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenARecordedMainProcessDoesNotQuitInTime(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      await installation.recordMainProcessAsync(new UpdateProcess(4140, 1500, 1501, "main"));
      this.presence.running.add(4140);

      const failure = await this.failAsync(installation, ProcessesNotExitedException);

      Assert.areEqual("These processes did not exit within 10 seconds: main 4140", failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenARuntimeRefusesOrSomethingDidNotSave(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("desktop.update", Response.failure("r", UpdateStopTests.REFUSED));
      const refused = await this.failAsync(installation, UpdateRefusedException);
      this.connections.clear();
      this.connection(first).answers.set("desktop.update", Response.success("r", new UpdateReady(["Notes couldn't save", "A cli client did not answer in time."], []).toJson()));
      const unsaved = await this.failAsync(installation, UpdateUnsavedException);
      this.connections.clear();
      this.ready(first, []);
      this.connection(first).answers.set("desktop.stop", Response.failure("r", UpdateStopTests.REFUSED));
      const unstopped = await this.failAsync(installation, UpdateRefusedException);

      Assert.areEqual(`The runtime of ${first} could not prepare for the update: Noldova Desktop Sample is preparing to install an update.`, refused.message);
      Assert.areEqual(`Not everything of ${first} was saved: Notes couldn't save; A cli client did not answer in time.`, unsaved.message);
      Assert.areEqual(`The runtime of ${first} could not prepare for the update: Noldova Desktop Sample is preparing to install an update.`, unstopped.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenAProcessDoesNotExitInTimeOrCannotBeChecked(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.ready(first, [new UpdateProcess(7001, 1500, 1501, "program")]);
      this.presence.running.add(7001);
      const late = await this.failAsync(installation, ProcessesNotExitedException);
      const waited = this.waits.length;
      this.connections.clear();
      this.ready(first, []);
      const unreadable = new Error("ps exited with code 1.");
      this.presence.failure = unreadable;
      const unchecked = await this.failAsync(installation, UpdateStopFailedUnexpectedlyException);

      Assert.areEqual("These processes did not exit within 28 seconds: program 7001", late.message);
      Assert.areEqual(112, waited);
      Assert.areEqual("The update stopped on an unexpected error.", unchecked.message);
      Assert.areEqual(unreadable, unchecked.cause);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public waitsForARuntimeWhoseStopTakesAsLongAsItsProgramsStopMayTake(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.ready(first, [new UpdateProcess(7001, 1500, 1501, "program")]);
      this.presence.running.add(9000).add(7001);
      this.presence.onCheck = t => {
        if (this.time >= 18_000)
          this.presence.running.delete(t.processId);
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result.isHandedOff);
      Assert.areEqual(72, this.waits.length);
      Assert.isFalse(this.presence.running.has(9000));
    });
  }

  @TestMethod
  public recordsTheProcessThatTookTheHandoffSoTheBarrierHoldsWhileItRuns(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result.isHandedOff);
      Assert.isTrue(result.isHandoffRecorded);
      Assert.areEqual(JSON.stringify(new UpdateBarrier(
        new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "main"), "0.3.0", UpdateBarrierState.HandedOff, new UpdateProcess(5200, 1500, 1501, "handoff")).toJson()), this.readBarrier(installation));
    });
  }

  @TestMethod
  public keepsTheBarrierWithoutItsHandoffWhenThatProcessHasAlreadyEnded(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      this.presence.unstampedRoles.add("handoff");

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result.isHandedOff);
      Assert.isTrue(result.isHandoffRecorded);
      Assert.areEqual(JSON.stringify(new UpdateBarrier(new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "main"), "0.3.0", UpdateBarrierState.HandedOff, null).toJson()), this.readBarrier(installation));
    });
  }

  @TestMethod
  public reportsAndLogsAHandoffWhoseProcessCannotBeRead(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      this.presence.onStamp = t => {
        if (t[0]?.[1] === "handoff")
          throw new Error("The process table could not be read.");
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result.isHandedOff);
      Assert.isFalse(result.isHandoffRecorded);
      Assert.isTrue(this.lines.includes("The process that took over the update could not be read to record it in the update's barrier: Error: The process table could not be read."));
      Assert.areEqual(JSON.stringify(new UpdateBarrier(new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "main"), "0.3.0", UpdateBarrierState.HandedOff, null).toJson()), this.readBarrier(installation));
    });
  }

  @TestMethod
  public reportsAHandoffWhoseProcessTheBarrierCannotRecord(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      this.presence.onStamp = t => {
        if (t[0]?.[1] === "handoff")
          rmSync(installation.folder, { recursive: true, force: true });
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result.isHandedOff);
      Assert.isFalse(result.isHandoffRecorded);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public startsTheAppImageRestartOnceHandedOffAndBeforeTheHandoff(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      using _launch = new LinuxLaunchFixture();
      await this.recordAsync(installation, folder, "first");
      const steps: string[] = [];
      const restart = UpdateStopTests.createRestart(async () => {
        steps.push(`restart ${JsonReader.parse(await readFile(installation.barrierFile, "utf8")).readString("state")}`);
        return 0x3fffffff;
      });

      const result = await this.create(installation, undefined, restart).runAsync("0.3.0", () => {
        steps.push("handoff");
        return Promise.resolve(null);
      });

      Assert.isTrue(result.isHandedOff);
      Assert.areEqual("restart HandedOff|handoff", steps.join("|"));
    });
  }

  @TestMethod
  public endsTheAppImageRestartWhenTheHandoffFails(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      using _launch = new LinuxLaunchFixture();
      await this.recordAsync(installation, folder, "first");
      const waiting = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
      await once(waiting, "spawn");
      const exited = once(waiting, "exit");

      const refusal = new InstallerUnsignedException("setup.exe", "the signature is not trusted");

      const failure = await Assert.throwsAsync(() => this.create(installation, undefined, UpdateStopTests.createRestart(() => Promise.resolve(Number(waiting.pid))))
        .runAsync("0.3.0", () => Promise.reject(refusal)), InstallerUnsignedException);
      await exited;

      Assert.areEqual(refusal, failure);
      Assert.isNotNull(waiting.exitCode ?? waiting.signalCode);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsWithoutHandingOffWhenTheAppImageRestartCannotStart(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      using _launch = new LinuxLaunchFixture();
      await this.recordAsync(installation, folder, "first");
      let isCalled = false;
      const missing = new Error("Bash is missing.");

      const failure = await Assert.throwsAsync(() => this.create(installation, undefined, UpdateStopTests.createRestart(() => Promise.reject(missing)))
        .runAsync("0.3.0", () => {
          isCalled = true;
          return Promise.resolve(null);
        }), UpdateStopFailedUnexpectedlyException);

      Assert.areEqual("The update stopped on an unexpected error.", failure.message);
      Assert.areEqual(missing, failure.cause);
      Assert.isFalse(isCalled);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public removesTheBarrierWhenTheHandoffFails(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");

      const failure = await Assert.throwsAsync(() => this.create(installation)
        .runAsync("0.3.0", () => Promise.reject(new InstallerNotHeldException(32))), InstallerNotHeldException);

      Assert.areEqual("The update's installer couldn't be held unchanged for its start (Windows error 32).", failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public backsUpTheDatabasesOfEveryRecordedDataDirectoryBeforeTheHandoff(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const unused = await this.recordAsync(installation, folder, "unused");
      const empty = await this.recordAsync(installation, folder, "empty");
      for (const root of [first, unused])
        UpdateStopTests.writeDatabase(join(root, "desktop.sqlite"));
      let backups = String.empty;

      const result = await this.create(installation, t => t === unused).runAsync("0.3.0", async () => {
        backups = (await Promise.all([first, unused, empty].map(t => UpdateStopTests.listBackupsAsync(t)))).join("|");
        return null;
      });

      Assert.isTrue(result.isHandedOff);
      Assert.areEqual("desktop-before-update-<time>.sqlite|desktop-before-update-<time>.sqlite|", backups);
    });
  }

  @TestMethod
  public backsUpOnceEveryRuntimeHasStoppedAndExitedWhileTheBarrierHolds(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const unused = await this.recordAsync(installation, folder, "unused");
      const steps: string[] = [];

      const result = await this.create(installation, t => t === unused, null, t => {
        const barrier = JsonReader.parse(String(this.readBarrier(installation))).readString("state");
        steps.push(`${t === first ? "first" : "unused"} ${this.connection(first).calls.at(-1) ?? String.empty} ${String(this.presence.checked.includes(9000))} ${barrier}`);
        return Promise.resolve();
      }).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result.isHandedOff);
      Assert.areEqual("first desktop.stop true Preparing|unused desktop.stop true Preparing", steps.join("|"));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenADataDirectoryCannotBeBackedUp(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      await this.recordAsync(installation, folder, "second");
      const full = new Error("The disk is full.");
      const tried: string[] = [];
      let isHandedOff = false;

      const failure = await Assert.throwsAsync(() => this.create(installation, () => false, null, t => {
        tried.push(t);
        return Promise.reject(full);
      }).runAsync("0.3.0", () => {
        isHandedOff = true;
        return Promise.resolve(null);
      }), DatabasesNotBackedUpException);

      Assert.areEqual(`Noldova Desktop Sample couldn't back up the databases of ${tried.join(",")}, so the update didn't start: The disk is full.`, failure.message);
      Assert.areEqual(full, failure.cause);
      Assert.isFalse(isHandedOff);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public namesTheReasonABackupFailedWhenItIsNotAnError(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");

      const failure = await Assert.throwsAsync(() => this.create(installation, () => false, null, () => Promise.reject("busy"))
        .runAsync("0.3.0", () => Promise.resolve(null)), DatabasesNotBackedUpException);

      Assert.areEqual(`Noldova Desktop Sample couldn't back up the databases of ${first}, so the update didn't start: busy`, failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public logsAHandoffItCannotRecordInTheBarrier(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      this.presence.onStamp = t => {
        if (t[0]?.[1] === "handoff")
          rmSync(installation.folder, { recursive: true, force: true });
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result.isHandedOff);
      Assert.isFalse(result.isHandoffRecorded);
      Assert.areEqual(1, this.lines.length);
      Assert.isTrue(this.lines[0]?.startsWith("The process that took over the update could not be recorded in the update's barrier: ") === true, JSON.stringify(this.lines));
    });
  }

  private static writeDatabase(file: string): void {
    const database = new DatabaseSync(file);
    try {
      database.exec("CREATE TABLE notes (text TEXT) STRICT; INSERT INTO notes VALUES ('kept');");
    }
    finally {
      database.close();
    }
  }

  private static async listBackupsAsync(root: string): Promise<string> {
    const folder = join(root, "backups");
    const names = existsSync(folder) ? await readdir(folder) : [];
    return names.filter(t => t.endsWith(".sqlite")).map(t => t.replace(/\d{8}T\d{6}Z/, "<time>")).join(",");
  }

  private static createRestart(startAsync: () => Promise<number>): AppImageRestart | null {
    const starter: IProcessStarter = { startAsync };
    return AppImageRestart.find("linux", { APPIMAGE: "/home/person/Noldova Desktop Sample.AppImage", APPDIR: "/tmp/.mount_AbCdEf" }, "/tmp/.mount_AbCdEf/noldova-desktop", [], starter, UpdateStopTests.SELF,
      "/tmp/restart.log");
  }

  private create(
    installation: Installation,
    isUnused: (dataDirectory: string) => boolean = () => false,
    restart: AppImageRestart | null = null,
    backUpAsync?: (dataDirectory: string) => Promise<unknown>): UpdateStop {
    return new UpdateStop(
      installation,
      this.presence,
      async (t, onChange) => {
        this.changes.set(t, onChange);
        await this.onConnect?.(t);
        return isUnused(t) ? null : this.target(t);
      },
      async (t, read, waitForChange) => {
        this.asked.push(t);
        await this.onQuestion?.(read, waitForChange);
        this.onAsk?.();
        const shown = this.rereads ? await read() : t;
        if (this.rereads)
          this.asked.push(shown);
        if (!this.answer)
          return null;
        return this.isWaitedOut ? [] : shown;
      },
      UpdateStopTests.SELF,
      "0.2.0",
      () => this.time,
      t => {
        this.waits.push(t);
        this.onWait?.();
        this.time += t;
        return Promise.resolve();
      },
      restart,
      t => this.lines.push(t),
      backUpAsync);
  }

  private change(dataDirectory: string): void {
    this.changes.get(dataDirectory)?.();
  }

  private target(dataDirectory: string): IUpdateTarget {
    return { dataDirectory, runtime: new UpdateProcess(9000, 1500, 1501, "runtime"), connection: this.connection(dataDirectory) };
  }

  private connection(dataDirectory: string): FakeRuntimeConnection {
    const existing = this.connections.get(dataDirectory);
    if (!Object.isUndefined(existing))
      return existing;
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.update", Response.success("r", new UpdateReady([], []).toJson()));
    this.connections.set(dataDirectory, connection);
    return connection;
  }

  private ready(dataDirectory: string, processes: readonly UpdateProcess[]): void {
    this.connection(dataDirectory).answers.set("desktop.update", Response.success("r", new UpdateReady([], processes).toJson()));
  }

  private readBarrier(installation: Installation): string | null {
    return existsSync(installation.barrierFile) ? readFileSync(installation.barrierFile, "utf8") : null;
  }

  private async recordAsync(installation: Installation, folder: string, name: string): Promise<string> {
    const root = join(folder, name);
    await mkdir(root);
    await installation.recordAsync(root);
    return root;
  }

  private async failAsync<TException extends UpdateStopException>(installation: Installation, type: new (...arguments_: never[]) => TException): Promise<TException> {
    return await Assert.throwsAsync(() => this.create(installation).runAsync("0.3.0", () => Promise.resolve(null)), type);
  }

  private async runAsync(test: (installation: Installation, folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-update-stop-"));
    try {
      await test(new Installation(join(folder, "installation"), t => this.presence.isRunningAsync(t)), folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
