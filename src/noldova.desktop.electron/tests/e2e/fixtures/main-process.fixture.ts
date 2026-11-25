/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { type ElectronApplication, type Page, type TestInfo, _electron, expect } from "@playwright/test";

import { SettingsSnapshot, StopPolicy } from "@noldova/desktop.protocol";
import { DataDirectory, DiscoveryReader, Endpoint, OwnershipLock, RuntimeBuild, RuntimeClient, type RuntimeDiscovery } from "@noldova/desktop.runtime";

import { AnswerMissingException } from "../exceptions/answer-missing.exception.ts";
import { AppNotRunningException } from "../exceptions/app-not-running.exception.ts";
import { AppNotStartedException } from "../exceptions/app-not-started.exception.ts";
import { AppProcessesNotExitedException } from "../exceptions/app-processes-not-exited.exception.ts";
import { DiscoveryFileMissingException } from "../exceptions/discovery-file-missing.exception.ts";
import { FontFacesMissingException } from "../exceptions/font-faces-missing.exception.ts";
import { FontFacesNotLoadedException } from "../exceptions/font-faces-not-loaded.exception.ts";
import { MainProcessNotAnsweredException } from "../exceptions/main-process-not-answered.exception.ts";
import { MainProcessSilentException } from "../exceptions/main-process-silent.exception.ts";
import { PageUnreachableException } from "../exceptions/page-unreachable.exception.ts";
import { RuntimeConnectionsMiscountedException } from "../exceptions/runtime-connections-miscounted.exception.ts";
import { RuntimeNotStartedException } from "../exceptions/runtime-not-started.exception.ts";
import { RuntimeNotStoppedException } from "../exceptions/runtime-not-stopped.exception.ts";
import { RuntimeOwnerUnknownException } from "../exceptions/runtime-owner-unknown.exception.ts";
import { CleanupSteps } from "./cleanup-steps.ts";
import { ErrorCodeFixture } from "./error-code.fixture.ts";
import { ErrorOutputClassifier, type IClassifiedLine } from "./error-output.classifier.ts";
import { HeldLock } from "./held-lock.ts";
import { MainProcessAnswer, type IMainProcessAnswerRecord } from "./main-process-answer.ts";
import { MainProcessLogFixture } from "./main-process-log.fixture.ts";
import { OffCursorPlacement } from "./off-cursor-placement.ts";
import { PageBridgeFixture } from "./page-bridge.fixture.ts";
import { ProcessListFixture } from "./process-list.fixture.ts";
import { ProcessRecord } from "./process-record.ts";
import { ProcessStartTimes } from "./process-start-times.ts";
import { ProcessTree } from "./process-tree.ts";
import { ProcessorLoadFixture } from "./processor-load.fixture.ts";
import { RunRecords } from "./run-records.ts";
import { type ISignalExit, SignalExitReport } from "./signal-exit-report.ts";
import { TestRoots } from "./test-roots.ts";
import { UiRun } from "./ui-run.ts";
import { WaitFixture } from "./wait.fixture.ts";

interface IMainProcessSilence {
  readonly action: string;
  readonly since: number;
  readonly processorMilliseconds: number | null;
}

export class MainProcessFixture {
  private static readonly APP: string = path.resolve("_build", "development-package");
  private static readonly EXECUTABLE_RECORD: string = path.resolve("_build", "development-app", "path.txt");
  private static readonly VIEWPORT_WIDTH: number = 1920;
  private static readonly VIEWPORT_HEIGHT: number = 1080;
  private static readonly PIXEL_RATIO_DIGITS: number = 6;
  private static readonly LAUNCH_ARGUMENTS: readonly string[] = [
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--force-color-profile=srgb",
    ...process.platform === "darwin" ? ["-ApplePersistenceIgnoreState", "YES"] : []
  ];
  private static readonly PLATFORM_LOG_ANNOTATION: string = "platform-log";
  private static readonly DEVICE_FOLDER: string = "device";
  private static readonly RUNTIME_STOP_TIMEOUT: number = 15_000;
  private static readonly OWNERSHIP_INTERVAL: number = 50;
  private static readonly NO_SUCH_PROCESS: string = "ESRCH";
  private static readonly NOT_A_DATABASE: number = 26;
  private static readonly LAUNCH_WAIT: number = 20_000;
  private static readonly LAUNCH_LIMIT: number = 60_000;
  private static readonly LAUNCH_INTERVAL: number = 250;
  private static readonly FAILED_TITLE: string = "Noldova Desktop Sample could not start";
  private static readonly FAILED_DETAIL: string = ".nol-startup-detail";
  private static readonly CLIENT_NAME: string = "ui-test";
  private static readonly PROCESS_EXIT_TIMEOUT: number = 30_000;
  private static readonly REMOVE_RETRIES: number = 3;
  private static readonly LOCKED_CODES: readonly string[] = ["EBUSY", "EPERM", "ENOTEMPTY"];
  private static readonly TRACE_FILE: string = "trace.zip";
  private static readonly WINDOWS_FILE: string = "windows.json";
  private static readonly DIAGNOSTIC_TIMEOUT: number = 10_000;
  private static readonly MAIN_PROCESS_TIMEOUT: number = 10_000;
  private static readonly QUIT_TIMEOUT: number = 30_000;
  private static readonly SILENCE_FILE: string = "main-process.txt";
  private static readonly THREADS_FILE: string = "main-process-threads.txt";
  private static readonly SIGNAL_EXIT_FILE: string = "main-process-signal.txt";
  private static readonly THREADS_TIMEOUT: number = 20_000;
  private static readonly MAIN_WINDOW: string = "main-window";
  private static readonly CHECKPOINT_ANNOTATION: string = "checkpoint";
  private static readonly PROCESS_SNAPSHOT_ANNOTATION: string = "process-snapshot";
  private static readonly SETTINGS_METHOD: string = "desktop.settings";
  private static readonly APPEARANCE_SETTINGS: readonly string[] = ["theme", "mode", "interfaceFont", "codeFont", "panelSize", "messageSize", "codeSize"];
  private static readonly SETTINGS_TIMEOUT: number = 5_000;
  private static readonly QUIT_ACTION: string = "quit";
  private static readonly QUIT_QUESTION: string = "nol-quit-dialog";
  private static readonly NO_ANSWER: unique symbol = Symbol("no answer");
  private static readonly RUNTIME_ENDED: RegExp = /^main: \S+ The runtime ended its connection to the main process, so the main process connects again\.$/;

  private readonly testInfo: TestInfo;
  private readonly processRecord: ProcessRecord;
  private readonly environment: Readonly<Record<string, string>>;
  private readonly extraArguments: readonly string[];
  private readonly output: ErrorOutputClassifier = new ErrorOutputClassifier();
  private electronApplication: ElectronApplication | null = null;
  private page: Page | null = null;
  private childProcess: ChildProcess | null = null;
  private viewport: { width: number; height: number } | null;
  private readonly recorded: Set<number> = new Set();
  private readonly startTimes: Map<number, number> = new Map();
  private placement: string = "The window had not been moved off the cursor.";
  private cursorOutsideSince: number = Date.now();
  private isPageUnreachable: boolean = false;
  private silence: IMainProcessSilence | null = null;
  private lastAnswer: IMainProcessAnswerRecord | null = null;
  private mainProcessId: number | null = null;
  private step: string = SignalExitReport.START_STEP;
  private readonly killed: Set<number> = new Set();
  private readonly signalExits: ISignalExit[] = [];
  private readonly crashOutput: string[] = [];
  private readonly mainProcessOutput: string[] = [];
  private isRuntimeEndAccepted: boolean = false;
  private isTraced: boolean = true;

  public readonly failures: string[] = [];
  public readonly diagnostics: string[] = [];
  public closeMilliseconds: number | null = null;
  public readonly root: string;
  public readonly dataDirectory: string;
  public readonly deviceDirectory: string;

  private constructor(
    testInfo: TestInfo, processRecord: ProcessRecord, root: string, environment: Readonly<Record<string, string>>, extraArguments: readonly string[], placesWindow: boolean, deviceDirectory: string | null) {
    this.testInfo = testInfo;
    this.processRecord = processRecord;
    this.extraArguments = extraArguments;
    this.viewport = placesWindow ? null : { width: MainProcessFixture.VIEWPORT_WIDTH, height: MainProcessFixture.VIEWPORT_HEIGHT };
    this.root = root;
    this.dataDirectory = TestRoots.dataDirectoryOf(root);
    this.deviceDirectory = deviceDirectory ?? path.join(root, MainProcessFixture.DEVICE_FOLDER);
    this.environment = environment;
  }

  public static async launchAsync(
    testInfo: TestInfo,
    environment: Readonly<Record<string, string>> = {},
    dataFiles: Readonly<Record<string, string>> = {},
    extraArguments: readonly string[] = [],
    placesWindow: boolean = false,
    deviceDirectory: string | null = null): Promise<MainProcessFixture> {
    const run = UiRun.readCurrent();
    const root = await TestRoots.createAsync(run, testInfo.parallelIndex);
    const fixture = new MainProcessFixture(testInfo, new RunRecords(testInfo.project.outputDir).recordOf(run), root, environment, extraArguments, placesWindow, deviceDirectory);
    await fixture.recordAsync([]);
    await mkdir(fixture.dataDirectory);
    for (const [name, text] of Object.entries(dataFiles)) {
      const file = path.join(fixture.dataDirectory, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
    }
    try {
      await fixture.startAsync();
      await fixture.recordEnvironmentAsync();
    }
    catch (error) {
      await fixture.disposeAsync(true).catch((cleanup: unknown) => CleanupSteps.attachAsync(testInfo, [cleanup]));
      throw error;
    }
    return fixture;
  }

  public static async stopRuntimeAsync(dataDirectory: string): Promise<void> {
    const directory = new DataDirectory(dataDirectory);
    const discovery = await DiscoveryReader.readAsync(directory);
    const asked = !Object.isNull(discovery) && MainProcessFixture.isAlive(discovery.processId) ? discovery : null;
    const answer = Object.isNull(asked) ? "it had already withdrawn its discovery file" : await MainProcessFixture.askToStopAsync(asked);
    const seconds = MainProcessFixture.RUNTIME_STOP_TIMEOUT / 1000;
    const isReleased = (): boolean => !MainProcessFixture.isOwned(directory);
    if (Object.isNull(asked)) {
      if (!await WaitFixture.holdsWithinAsync(isReleased, MainProcessFixture.RUNTIME_STOP_TIMEOUT, MainProcessFixture.OWNERSHIP_INTERVAL))
        throw new RuntimeOwnerUnknownException(dataDirectory, seconds);
      return;
    }
    const hasEnded = await WaitFixture.holdsWithinAsync(
      () => isReleased() || !MainProcessFixture.isAlive(asked.processId), MainProcessFixture.RUNTIME_STOP_TIMEOUT, MainProcessFixture.OWNERSHIP_INTERVAL);
    if (!hasEnded && MainProcessFixture.killIfRunning(asked.processId))
      throw new RuntimeNotStoppedException(asked.processId, seconds, answer);
    const isTakenOver = async (): Promise<boolean> => {
      const current = await DiscoveryReader.readAsync(directory);
      return !Object.isNull(current) && current.processId !== asked.processId;
    };
    await WaitFixture.untilAsync(async () => isReleased() || await isTakenOver(),
      `the ended runtime to release ${dataDirectory}, or a runtime started again to publish its discovery`, MainProcessFixture.RUNTIME_STOP_TIMEOUT, MainProcessFixture.OWNERSHIP_INTERVAL);
  }

  public static isAlive(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  public static keepUnchanged(processIds: readonly number[], startTimes: ReadonlyMap<number, number>, current: ProcessStartTimes): number[] {
    return processIds.filter(t => !startTimes.has(t) || !current.hasEnded(t, startTimes.get(t) ?? Number.NaN));
  }

  public get recordedProcessIds(): readonly number[] {
    return [...this.recorded];
  }

  public get application(): ElectronApplication {
    if (Object.isNull(this.electronApplication))
      throw new AppNotRunningException();
    return this.electronApplication;
  }

  public get window(): Page {
    if (Object.isNull(this.page))
      throw new AppNotRunningException();
    return this.page;
  }

  public async stopTracingAsync(): Promise<void> {
    this.isTraced = false;
    await this.application.context().tracing.stop();
  }

  public async reopenAsync(): Promise<void> {
    expect(await this.closeAsync(true)).toBe(0);
    await this.startAsync();
  }

  public async restartAsync(beforeStart?: () => Promise<void>): Promise<void> {
    expect(await this.closeAsync()).toBe(0);
    await MainProcessFixture.stopRuntimeAsync(this.dataDirectory);
    await beforeStart?.();
    await this.startAsync();
  }

  public acceptRuntimeEnds(): void {
    this.isRuntimeEndAccepted = true;
  }

  public acceptFailures(pattern: RegExp): string[] {
    const accepted = this.failures.filter(t => pattern.test(t));
    this.failures.splice(0, this.failures.length, ...this.failures.filter(t => !pattern.test(t)));
    return accepted;
  }

  public async isVisibleAsync(): Promise<boolean> {
    return await this.answerAsync("say whether a window is visible", this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(t => t.isVisible())));
  }

  public static roundPixelRatio(ratio: number): number {
    return Number(ratio.toFixed(MainProcessFixture.PIXEL_RATIO_DIGITS));
  }

  public static describeCursorReturn(idleSeconds: number | null, milliseconds: number): string {
    const found = "The real cursor came back inside the window, so its position could reach the test's pointer events.";
    const seconds = Math.floor(milliseconds / 1000);
    if (Object.isNull(idleSeconds))
      return `${found} The system's idle time could not be read, so where the input came from is unknown.`;
    return idleSeconds < seconds
      ? `${found} The system last received input ${idleSeconds} s ago, within the ${seconds} s since the cursor was last outside, and the tests send it none, so the input came from outside the test.`
      : `${found} The system last received input ${idleSeconds} s ago, before the cursor was last outside ${seconds} s ago, so the window or a display moved under the still cursor.`;
  }

  public async readViewportAsync(): Promise<readonly number[]> {
    const [width, height, ratio] = await this.window.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
    return [width, height, MainProcessFixture.roundPixelRatio(ratio)];
  }

  public async useViewportAsync(width: number, height: number): Promise<void> {
    this.viewport = { width, height };
    await this.applyViewportAsync(this.viewport);
  }

  public async useWindowAsync(width: number, height: number): Promise<void> {
    await this.answerAsync(`size the window's content to ${width} × ${height}`, this.application.evaluate(({ BrowserWindow }, size) =>
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height), { width, height }));
    await expect.poll(() => this.answerAsync("read the window's content size", this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getContentSize())))
      .toEqual([width, height]);
    await expect.poll(async () => (await this.readViewportAsync()).slice(0, 2)).toEqual([width, height]);
  }

  public async zoomAsync(factor: number, width: number): Promise<void> {
    const ratio: number = await this.window.evaluate(() => devicePixelRatio) * factor / await this.readZoomAsync();
    await this.answerAsync(`zoom the page to ${factor}`, this.application.evaluate(({ BrowserWindow }, zoom) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(zoom), factor));
    await expect.poll(() => this.window.evaluate(() => innerWidth)).toBe(width);
    await expect.poll(() => this.window.evaluate(() => new Promise<number>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(devicePixelRatio))))))
      .toBeCloseTo(ratio);
  }

  public async checkpointAsync(name: string): Promise<Buffer> {
    const zoom = await this.readZoomAsync();
    const image = await this.window.screenshot({ scale: zoom === 1 ? "css" : "device" });
    if (!Object.isNull(this.viewport))
      expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([this.viewport.width, this.viewport.height]);
    await this.testInfo.attach(name, { body: image, contentType: "image/png" });
    this.testInfo.annotations.push({ type: MainProcessFixture.CHECKPOINT_ANNOTATION, description: JSON.stringify({ name, ...await this.readAppearanceAsync(zoom) }) });
    return image;
  }

  public async captureMainWindowAsync(): Promise<void> {
    const image = await this.checkpointAsync(MainProcessFixture.MAIN_WINDOW);
    const file = `${MainProcessFixture.MAIN_WINDOW}-${process.platform}-${process.arch}.png`;
    await writeFile(path.join(this.testInfo.project.outputDir, "..", file), image);
  }

  public async closeAsync(keepRuntime: boolean = false): Promise<number | null> {
    const child = this.requireProcess();
    const exited = Object.is(child.exitCode, null) ? new Promise<number | null>(resolve => child.once("exit", resolve)) : Promise.resolve(child.exitCode);
    const errors: unknown[] = [];
    try {
      await this.recordProcessesAsync();
    }
    catch (error) {
      if (Object.isNull(this.silence))
        errors.push(error);
    }
    const owned = await this.recordStartedAsync(child).catch((error: unknown) => {
      this.testInfo.annotations.push({
        type: MainProcessFixture.PROCESS_SNAPSHOT_ANNOTATION,
        description: `The processes Noldova Desktop Sample started could not be listed before it closed, so a process outside Electron's own that outlives it goes unnoticed: ${error instanceof Error ? error.message : String(error)}`
      });
      return [];
    });
    this.step = SignalExitReport.QUIT_STEP;
    try {
      const started = Date.now();
      const closed = this.application.close();
      closed.catch(() => undefined);
      await this.answerAsync(MainProcessFixture.QUIT_ACTION, Promise.race([closed, exited.then(() => undefined)]), MainProcessFixture.QUIT_TIMEOUT);
      this.closeMilliseconds = Date.now() - started;
    }
    catch (error) {
      if (Object.isNull(this.silence))
        errors.push(error);
      else
        this.failures.push(await this.killSilentAsync(this.silence));
      this.killed.add(child.pid ?? 0);
      child.kill("SIGKILL");
      errors.push(...await CleanupSteps.collectFailuresAsync([async () => {
        for (const processId of await this.listUnchangedAsync(owned))
          ProcessRecord.killIfRunning(processId);
      }]));
    }
    const exitCode = await exited;
    this.electronApplication = null;
    this.page = null;
    CleanupSteps.throwFailures([...errors, ...await CleanupSteps.collectFailuresAsync(keepRuntime ? [] : [() => MainProcessFixture.stopRuntimeAsync(this.dataDirectory)])]);
    return exitCode;
  }

  public async readRuntimeProcessIdAsync(): Promise<number | undefined> {
    return (await DiscoveryReader.readAsync(new DataDirectory(this.dataDirectory)))?.processId;
  }

  public breakRuntimeConnectionAsync(): Promise<void> {
    this.acceptRuntimeEnds();
    return this.reachRuntimeConnectionAsync("break its connection to the runtime", null);
  }

  public receiveInvalidFrameAsync(): Promise<void> {
    return this.reachRuntimeConnectionAsync("receive an invalid frame on its connection to the runtime", "This line is not a message.\n");
  }

  public async disposeAsync(hasFailed: boolean = this.testInfo.status !== this.testInfo.expectedStatus): Promise<void> {
    const isRunning = !Object.isNull(this.electronApplication) && Object.is(this.requireProcess().exitCode, null);
    if (isRunning && !Object.isNull(this.viewport) && Object.isNull(this.silence))
      await this.checkGuardAsync(this.viewport).catch((error: unknown) => this.failures.push(ErrorCodeFixture.messageOf(error)));
    const failures = await CleanupSteps.collectFailuresAsync([
      ...hasFailed || !Object.isNull(this.silence) ? [() => this.keepDiagnosticsAsync(isRunning)] : [],
      ...isRunning ? [() => this.closeAsync(true)] : [],
      () => MainProcessFixture.stopRuntimeAsync(this.dataDirectory),
      () => this.removeFolderAsync()
    ]);
    await this.reportSignalExitsAsync();
    if (this.isRuntimeEndAccepted)
      this.acceptFailures(MainProcessFixture.RUNTIME_ENDED);
    CleanupSteps.throwFailures(failures);
  }

  public async isCursorInsideAsync(): Promise<boolean> {
    return await this.answerAsync("say whether the cursor is inside the window", this.application.evaluate(({ BrowserWindow, screen }) => {
      const cursor = screen.getCursorScreenPoint();
      const bounds = BrowserWindow.getAllWindows()[0]?.getBounds();
      return bounds !== undefined && cursor.x >= bounds.x && cursor.y >= bounds.y && cursor.x < bounds.x + bounds.width && cursor.y < bounds.y + bounds.height;
    }));
  }

  private async reachRuntimeConnectionAsync(action: string, frame: string | null): Promise<void> {
    const discovery = await DiscoveryReader.readAsync(new DataDirectory(this.dataDirectory));
    if (Object.isNull(discovery))
      throw new DiscoveryFileMissingException(this.dataDirectory);
    const found = await this.answerAsync(action, this.application.evaluate((_, { port, frame }) => {
      const listing: unknown = "_getActiveHandles" in process ? process._getActiveHandles : undefined;
      const listed: unknown = typeof listing === "function" ? listing.call(process) : [];
      const handles: readonly unknown[] = Array.isArray(listed) ? listed : [];
      const standard: readonly object[] = [process.stdin, process.stdout, process.stderr];
      const { ChildProcess } = process.getBuiltinModule("node:child_process");
      const net = process.getBuiltinModule("node:net");
      const children: readonly unknown[] = handles.flatMap(t => t instanceof ChildProcess ? t.stdio : []);
      const sockets = handles.flatMap(t => t instanceof net.Socket && t.constructor.name === "Socket" ? [t] : []).map(socket => {
        const t: object = socket;
        const isChild = children.includes(t);
        const isRuntime = port === null
          ? socket.remoteAddress === undefined && socket.readable && socket.writable && !standard.includes(t) && !isChild
          : socket.remoteAddress === "127.0.0.1" && socket.remotePort === port;
        const address = socket.remoteAddress === undefined ? "no remote address" : `${socket.remoteAddress}:${String(socket.remotePort)}`;
        return {
          socket, isRuntime,
          description: `${address}, readable ${String(socket.readable)}, writable ${String(socket.writable)}, standard ${String(standard.includes(t))}, child stdio ${String(isChild)}`
        };
      });
      const matches = sockets.filter(t => t.isRuntime);
      if (matches.length === 1)
        for (const match of matches)
          setImmediate(() => frame === null ? match.socket.destroy() : match.socket.emit("data", frame));
      return { matched: matches.length, descriptions: sockets.map(t => t.description) };
    }, { port: Endpoint.parse(discovery.endpoint).port, frame }));
    if (found.matched !== 1)
      throw new RuntimeConnectionsMiscountedException(discovery.endpoint, found.matched, found.descriptions);
  }

  private async killSilentAsync(silence: IMainProcessSilence): Promise<string> {
    const processId = this.mainProcessId;
    const question = silence.action === MainProcessFixture.QUIT_ACTION ? await this.describeQuestionAsync() : null;
    if (!Object.isNull(question))
      this.silence = null;
    if (!Object.isNull(processId) && MainProcessFixture.isAlive(processId))
      process.kill(processId, "SIGKILL");
    return question ?? `The main process ${processId ?? "(id unknown)"} did not answer for ${Math.round((Date.now() - silence.since) / 1000)} s after it was asked to ${silence.action}, so the test killed it.`;
  }

  private async removeFolderAsync(): Promise<void> {
    await this.failIfRunningAsync(await ProcessListFixture.waitForSignalsAsync([...this.recorded], MainProcessFixture.PROCESS_EXIT_TIMEOUT));
    try {
      await TestRoots.removeAsync(this.root);
      return;
    }
    catch (error) {
      if (!MainProcessFixture.LOCKED_CODES.includes(ErrorCodeFixture.of(error) ?? String.empty))
        throw error;
    }
    await this.failIfRunningAsync(await ProcessListFixture.waitForExitAsync([...this.recorded], MainProcessFixture.PROCESS_EXIT_TIMEOUT));
    await TestRoots.removeAsync(this.root, MainProcessFixture.REMOVE_RETRIES);
  }

  private async recordProcessesAsync(): Promise<void> {
    const electron = await this.answerAsync("list its processes", this.application.evaluate(({ app }) => ({ main: process.pid, all: app.getAppMetrics().map(t => t.pid) })));
    this.mainProcessId = electron.main;
    for (const processId of electron.all)
      this.recorded.add(processId);
    const runtime = await this.readRuntimeProcessIdAsync();
    if (!Object.isUndefined(runtime))
      this.recorded.add(runtime);
    await this.recordAsync([...this.recorded]);
  }

  private async recordStartedAsync(child: ChildProcess): Promise<number[]> {
    if (Object.isUndefined(child.pid) || !Object.isNull(child.exitCode) || !Object.isNull(child.signalCode))
      return [];
    const tree = new ProcessTree(await ProcessListFixture.readTreeAsync());
    const started = tree.listDescendants(child.pid);
    const runtime = await this.readRuntimeProcessIdAsync();
    const runtimeTree = !Object.isUndefined(runtime) && started.includes(runtime) ? [runtime, ...tree.listDescendants(runtime)] : [];
    const startTimes = await ProcessListFixture.readStartTimesAsync(started.filter(t => !runtimeTree.includes(t)));
    for (const [processId, startTime] of startTimes) {
      this.recorded.add(processId);
      this.startTimes.set(processId, startTime);
    }
    await this.recordAsync([...this.recorded]);
    return [...startTimes.keys()];
  }

  private async listUnchangedAsync(processIds: readonly number[]): Promise<number[]> {
    const listed = processIds.filter(t => this.startTimes.has(t));
    return listed.length === 0 ? [...processIds] : MainProcessFixture.keepUnchanged(processIds, this.startTimes, await ProcessStartTimes.readAsync(listed));
  }

  private recordAsync(processIds: readonly number[]): Promise<void> {
    return this.processRecord.appendAsync(this.testInfo.workerIndex, { root: this.root, dataDirectory: this.dataDirectory, processIds });
  }

  private async failIfRunningAsync(processIds: readonly number[]): Promise<void> {
    const running = processIds.length === 0 ? [] : await this.listUnchangedAsync(processIds);
    if (running.length === 0)
      return;
    const described = await ProcessListFixture.describeAsync(running);
    throw new AppProcessesNotExitedException(described, MainProcessFixture.PROCESS_EXIT_TIMEOUT / 1000, this.root);
  }

  private async keepDiagnosticsAsync(isRunning: boolean): Promise<void> {
    const logs = new DataDirectory(this.dataDirectory).logsFolder;
    const files = existsSync(logs) ? (await readdir(logs)).sort() : [];
    for (const file of files)
      await this.keepAsync(file, "text/plain", () => readFile(path.join(logs, file)));
    if (!isRunning)
      return;
    const silence = this.silence;
    if (!Object.isNull(silence)) {
      const processId = this.mainProcessId;
      if (!Object.isNull(processId))
        await this.keepAsync(MainProcessFixture.THREADS_FILE, "text/plain", () => ProcessListFixture.describeThreadsAsync(processId),
          MainProcessFixture.THREADS_TIMEOUT);
      await this.keepAsync(MainProcessFixture.SILENCE_FILE, "text/plain", () => this.describeSilenceAsync(silence),
        MainProcessFixture.MAIN_PROCESS_TIMEOUT + MainProcessFixture.DIAGNOSTIC_TIMEOUT);
    }
    for (const [index, page] of this.application.windows().entries()) {
      await this.keepAsync(`page-${index}.png`, "image/png", () => this.isPageUnreachable ? Promise.reject(new PageUnreachableException()) : page.screenshot());
      await this.keepAsync(`page-${index}.html`, "text/html", () => this.isPageUnreachable ? Promise.reject(new PageUnreachableException()) : page.content());
    }
    await this.keepAsync(MainProcessFixture.WINDOWS_FILE, "application/json", async () => JSON.stringify(await this.answerAsync("describe its windows", this.application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map(t => ({
        id: t.id,
        isVisible: t.isVisible(),
        isDestroyed: t.isDestroyed(),
        url: t.webContents.getURL(),
        isLoading: t.webContents.isLoading(),
        isCrashed: t.webContents.isCrashed()
      })))), null, 2));
    if (!this.isTraced)
      return;
    await this.keepAsync(MainProcessFixture.TRACE_FILE, "application/zip", async () => {
      const trace = this.testInfo.outputPath(MainProcessFixture.TRACE_FILE);
      await this.application.context().tracing.stop({ path: trace });
      return await readFile(trace);
    });
  }

  private async keepAsync(name: string, contentType: string, capture: () => Promise<Buffer | string>, limit: number = MainProcessFixture.DIAGNOSTIC_TIMEOUT): Promise<void> {
    try {
      const body = await MainProcessFixture.withinAsync(capture(), limit);
      if (body === MainProcessFixture.NO_ANSWER)
        throw new AnswerMissingException(limit);
      await this.testInfo.attach(name, { body, contentType });
    }
    catch (error) {
      await this.testInfo.attach(`${name}.unavailable.txt`, { body: String(error), contentType: "text/plain" });
    }
  }

  private async describeQuestionAsync(): Promise<string | null> {
    const questions = await MainProcessFixture.withinAsync(Promise.all(this.application.windows().map(async (page, index) => {
      const question = page.getByRole("dialog").filter({ has: page.locator(MainProcessFixture.QUIT_QUESTION) });
      return await question.count() === 0 ? null : { index, text: await question.first().ariaSnapshot() };
    }).map(t => t.catch(() => null))), MainProcessFixture.DIAGNOSTIC_TIMEOUT);
    const asked = questions === MainProcessFixture.NO_ANSWER ? null : questions.find(t => !Object.isNull(t)) ?? null;
    return Object.isNull(asked) ? null : [
      `Noldova Desktop Sample did not quit within ${MainProcessFixture.QUIT_TIMEOUT / 1000} s because window ${asked.index} asked the question below, so the test killed it.`,
      "The test left work running: finish or stop it before the test ends.",
      asked.text
    ].join("\n");
  }

  private async describeSilenceAsync(silence: IMainProcessSilence): Promise<string> {
    const processorMilliseconds = await this.readProcessorMillisecondsAsync();
    const started = Date.now();
    const request = PageBridgeFixture.evaluateAsync(this.window, t => t.readBuild());
    const answer = await MainProcessFixture.withinAsync(request.then(() => null, (error: unknown) => String(error)), MainProcessFixture.MAIN_PROCESS_TIMEOUT);
    this.isPageUnreachable = answer === MainProcessFixture.NO_ANSWER;
    const described = answer === MainProcessFixture.NO_ANSWER
      ? `had no answer within ${MainProcessFixture.MAIN_PROCESS_TIMEOUT / 1000} s`
      : Object.isNull(answer) ? `was answered in ${Date.now() - started} ms` : `failed: ${answer}`;
    const time = (milliseconds: number | null): string => Object.isNull(milliseconds) ? "unknown" : `${milliseconds} ms`;
    return [
      `The main process ${this.mainProcessId ?? "(id unknown)"} stopped answering when it was asked to ${silence.action}, ${Math.round((Date.now() - silence.since) / 1000)} s before this report.`,
      `Its processor time was ${time(silence.processorMilliseconds)} when it stopped answering and ${time(processorMilliseconds)} now.`,
      `The window's request to it, desktop.readBuild(), ${described}.`,
      this.placement
    ].join("\n");
  }

  private async readZoomAsync(): Promise<number> {
    return await this.answerAsync("report its zoom", this.application.browserWindow(this.window).then(t => t.evaluate(u => u.webContents.getZoomFactor())));
  }

  private async readAppearanceAsync(zoom: number): Promise<object> {
    const settings = await this.readSettingsAsync();
    const page = await this.window.evaluate(() => ({ colorScheme: getComputedStyle(document.documentElement).colorScheme, viewport: { width: innerWidth, height: innerHeight }, pixelRatio: devicePixelRatio }));
    return { ...settings, colorScheme: page.colorScheme, zoom, viewport: page.viewport, pixelRatio: MainProcessFixture.roundPixelRatio(page.pixelRatio) };
  }

  private async readSettingsAsync(): Promise<object> {
    const request = PageBridgeFixture.evaluateAsync(this.window, (t, method) => t.request(method, {}), MainProcessFixture.SETTINGS_METHOD);
    try {
      const answer = await MainProcessFixture.withinAsync(request, MainProcessFixture.SETTINGS_TIMEOUT);
      if (answer === MainProcessFixture.NO_ANSWER)
        return { settings: null, settingsProblem: `${MainProcessFixture.SETTINGS_METHOD} had no answer within ${MainProcessFixture.SETTINGS_TIMEOUT} ms.` };
      if (typeof answer !== "object" || Object.isNull(answer) || !("payload" in answer))
        return { settings: null, settingsProblem: `${MainProcessFixture.SETTINGS_METHOD} answered ${JSON.stringify(answer)}.` };
      const values = new Map(SettingsSnapshot.fromJson(answer.payload).entries.map(t => [t.name.text, t.value]));
      const missing = MainProcessFixture.APPEARANCE_SETTINGS.filter(t => !values.has(`desktop.${t}`));
      if (missing.length > 0)
        return { settings: null, settingsProblem: `${MainProcessFixture.SETTINGS_METHOD} had no value for ${missing.map(t => `desktop.${t}`).join(", ")}.` };
      return { settings: Object.fromEntries(MainProcessFixture.APPEARANCE_SETTINGS.map(t => [t, values.get(`desktop.${t}`)])) };
    }
    catch (error) {
      return { settings: null, settingsProblem: `${MainProcessFixture.SETTINGS_METHOD} failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async answerAsync<T>(action: string, evaluation: Promise<T>, limit: number = MainProcessFixture.MAIN_PROCESS_TIMEOUT): Promise<T> {
    if (!Object.isNull(this.silence)) {
      evaluation.catch(() => undefined);
      throw new MainProcessSilentException(this.silence.action, action);
    }
    const asked = Date.now();
    const answer = await MainProcessFixture.withinAsync(evaluation.finally(() => {
      this.lastAnswer = { action, at: Date.now() };
    }), limit);
    if (answer !== MainProcessFixture.NO_ANSWER)
      return answer;
    const lastAnswerLine = MainProcessAnswer.describeLast(this.lastAnswer, asked);
    const processorMilliseconds = await this.readProcessorMillisecondsAsync();
    this.silence = { action, since: asked, processorMilliseconds };
    throw new MainProcessNotAnsweredException(
      limit / 1000, action, lastAnswerLine,
      await MainProcessLogFixture.describeMainProcessFailuresAsync(new DataDirectory(this.dataDirectory).mainProcessLog, this.mainProcessOutput), this.placement);
  }

  private async readProcessorMillisecondsAsync(): Promise<number | null> {
    return Object.isNull(this.mainProcessId) ? null : await ProcessListFixture.readProcessorMillisecondsAsync(this.mainProcessId).catch(() => null);
  }

  private static async withinAsync<T>(work: Promise<T>, limit: number): Promise<T | typeof MainProcessFixture.NO_ANSWER> {
    work.catch(() => undefined);
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<typeof MainProcessFixture.NO_ANSWER>(resolve => {
      timer = setTimeout(() => resolve(MainProcessFixture.NO_ANSWER), limit);
    });
    try {
      return await Promise.race([work, deadline]);
    }
    finally {
      clearTimeout(timer);
    }
  }

  private async startAsync(): Promise<void> {
    const application = await _electron.launch({
      executablePath: await readFile(MainProcessFixture.EXECUTABLE_RECORD, "utf8"),
      args: [
        MainProcessFixture.APP,
        `--data-dir=${this.dataDirectory}`,
        `--device-dir=${this.deviceDirectory}`,
        ...MainProcessFixture.LAUNCH_ARGUMENTS,
        ...this.extraArguments
      ],
      cwd: this.root,
      env: Object.fromEntries(Object.entries({ ...process.env, ...SignalExitReport.ENVIRONMENT, ...this.environment }).filter((t): t is [string, string] => !Object.isUndefined(t[1])))
    });
    this.electronApplication = application;
    this.childProcess = application.process();
    this.watchSignalExit(application.process());
    const launched = application.process().pid;
    await this.recordAsync(Object.isUndefined(launched) ? [] : [launched]);
    this.mainProcessId = null;
    this.lastAnswer = null;
    this.mainProcessOutput.splice(0);
    application.process().stderr?.on("data", (data: Buffer) => this.readOutput(this.output.classify(data.toString())));
    application.process().stderr?.on("end", () => this.readOutput(this.output.flush()));
    application.on("console", t => {
      if (t.type() === "error")
        this.failures.push(`main: ${t.text()}`);
    });
    if (this.isTraced)
      await application.context().tracing.start({ screenshots: true, snapshots: true });
    const window = await application.firstWindow();
    window.on("console", t => {
      if (t.type() === "error")
        this.failures.push(`renderer: ${t.text()}`);
    });
    window.on("pageerror", t => this.failures.push(`renderer: ${t.message}`));
    this.page = window;
    await expect.poll(() => this.isVisibleAsync()).toBe(true);
    await this.waitForRuntimeAsync();
    await MainProcessFixture.loadFontsAsync(window);
    await this.recordProcessesAsync();
    if (!Object.isNull(this.viewport))
      await this.applyViewportAsync(this.viewport);
    this.step = SignalExitReport.TEST_STEP;
  }

  private watchSignalExit(child: ChildProcess): void {
    this.step = SignalExitReport.START_STEP;
    child.once("exit", (_, signal) => {
      if (!Object.isNull(signal) && !this.killed.has(child.pid ?? 0))
        this.signalExits.push({ processId: child.pid, signal, step: this.step, drained: SignalExitReport.drainAsync(child) });
    });
  }

  private async reportSignalExitsAsync(): Promise<void> {
    const exits = this.signalExits.splice(0);
    await Promise.all([...exits.map(t => t.drained), ...Object.isNull(this.childProcess) ? [] : [SignalExitReport.drainAsync(this.childProcess)]]);
    const stack = this.crashOutput.splice(0);
    if (exits.length === 0 && stack.length > 0)
      this.testInfo.annotations.push({ type: SignalExitReport.CRASH_ANNOTATION, description: stack.join("\n") });
    for (const exit of exits) {
      const report = SignalExitReport.describe(exit, stack);
      await this.testInfo.attach(MainProcessFixture.SIGNAL_EXIT_FILE, { body: report, contentType: "text/plain" });
      this.failures.push(report);
    }
  }

  private async waitForRuntimeAsync(): Promise<void> {
    const directory = new DataDirectory(this.dataDirectory);
    const load = new ProcessorLoadFixture();
    const started = Date.now();
    let held: HeldLock | null = null;
    let isExtended = false;
    const isStarted = await WaitFixture.holdsWithinAsync(async () => {
      if ((await DiscoveryReader.readAsync(directory))?.productVersion === RuntimeBuild.identity.productVersion)
        return true;
      const elapsed = Date.now() - started;
      const isHeld = MainProcessFixture.isOwned(directory);
      if (isHeld)
        held = new HeldLock(held?.from ?? elapsed, elapsed);
      const failure = await this.readStartupFailureAsync();
      if (!Object.isNull(failure))
        throw await this.describeLaunchFailureAsync(`the window reports that Noldova Desktop Sample could not start (${failure})`, held, load);
      if (elapsed >= MainProcessFixture.LAUNCH_WAIT && !isHeld)
        throw await this.describeLaunchFailureAsync(`no runtime published discovery within ${elapsed / 1000} s, and none holds the data directory`, held, load);
      if (elapsed >= MainProcessFixture.LAUNCH_WAIT && !isExtended) {
        this.testInfo.setTimeout(this.testInfo.timeout + MainProcessFixture.LAUNCH_LIMIT - MainProcessFixture.LAUNCH_WAIT);
        isExtended = true;
      }
      load.sample();
      return false;
    }, MainProcessFixture.LAUNCH_LIMIT, MainProcessFixture.LAUNCH_INTERVAL);
    if (!isStarted)
      throw await this.describeLaunchFailureAsync(`no runtime published discovery within ${(Date.now() - started) / 1000} s, though one holds the data directory`, held, load);
  }

  private static async loadFontsAsync(window: Page): Promise<void> {
    const [count, failed] = await window.evaluate(async () => {
      const faces = [...document.fonts];
      await Promise.allSettled(faces.map(t => t.load()));
      return [faces.length, faces.filter(t => t.status !== "loaded").map(t => `${t.family} ${t.weight} ${t.style}`)] as const;
    });
    if (count === 0)
      throw new FontFacesMissingException();
    if (failed.length > 0)
      throw new FontFacesNotLoadedException(failed);
  }

  private async describeLaunchFailureAsync(reason: string, held: HeldLock | null, load: ProcessorLoadFixture): Promise<RuntimeNotStartedException> {
    const lock = Object.isNull(held) ? "never held" : `held from ${held.from / 1000} s to ${held.to / 1000} s`;
    const naming = await ProcessListFixture.describeNamingAsync(this.dataDirectory).catch((error: unknown) => `unknown (${String(error)})`);
    return new RuntimeNotStartedException(reason, lock, naming, load.describe());
  }

  private async readStartupFailureAsync(): Promise<string | null> {
    if (await this.window.getByRole("heading", { name: MainProcessFixture.FAILED_TITLE }).count() === 0)
      return null;
    return (await this.window.locator(MainProcessFixture.FAILED_DETAIL).allTextContents())[0] ?? String.empty;
  }

  private async applyViewportAsync(viewport: { width: number; height: number }): Promise<void> {
    await this.moveOffCursorAsync();
    await this.window.setViewportSize(viewport);
    await expect.poll(() => this.readViewportAsync()).toEqual([viewport.width, viewport.height, 1]);
  }

  private async checkGuardAsync(viewport: { width: number; height: number }): Promise<void> {
    const shown = await this.window.evaluate(() => [Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio)]).catch(() => null);
    if (!Object.isNull(shown) && (shown[0] !== viewport.width || shown[1] !== viewport.height))
      this.failures.push(`The workflow ended at a ${shown.join(" × ")} viewport instead of ${viewport.width} × ${viewport.height}, so its viewport was lost.`);
    if (await this.isCursorInsideAsync()) {
      const idle = await this.answerAsync("read the system's idle time", this.application.evaluate(({ powerMonitor }) => powerMonitor.getSystemIdleTime())).catch(() => null);
      this.failures.push(MainProcessFixture.describeCursorReturn(idle, Date.now() - this.cursorOutsideSince));
    }
  }

  private async moveOffCursorAsync(): Promise<void> {
    await this.answerAsync("unmaximize the window", this.application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (window?.isMaximized() === true)
        window.unmaximize();
    }));
    await expect.poll(() => this.answerAsync("say whether the window is maximized", this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized())))
      .toBe(false);
    const state = await this.answerAsync("read the cursor, the window's bounds and the displays", this.application.evaluate(({ BrowserWindow, screen }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window === undefined ? null : { cursor: screen.getCursorScreenPoint(), bounds: window.getBounds(), displays: screen.getAllDisplays().map(t => t.bounds) };
    }));
    if (!Object.isNull(state)) {
      this.placement = `Before the move, the cursor was at ${state.cursor.x},${state.cursor.y}, the window at ${OffCursorPlacement.describe(state.bounds)} ` +
        `and the displays at ${state.displays.map(t => OffCursorPlacement.describe(t)).join("; ")}.`;
      const placed = await OffCursorPlacement.placeAsync(state.bounds, state.cursor, state.displays, target => this.answerAsync(`move the window to ${OffCursorPlacement.describe(target)}`,
        this.application.evaluate(({ BrowserWindow }, next) => {
          const window = BrowserWindow.getAllWindows()[0];
          if (window === undefined)
            throw new Error("The window is gone.");
          window.setBounds(next);
          return window.getBounds();
        }, target)), OffCursorPlacement.isFittingOnly(process.platform, process.env));
      this.placement += ` After the move, the window was at ${OffCursorPlacement.describe(placed)}.`;
    }
    await expect.poll(() => this.isCursorInsideAsync(), { message: this.placement }).toBe(false);
    this.cursorOutsideSince = Date.now();
    await this.answerAsync("send the window a pointer leave", this.application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.sendInputEvent({ type: "mouseLeave", x: 0, y: 0 })));
    await expect.poll(() => this.window.evaluate(() => document.querySelector(":hover") === null)).toBe(true);
  }

  private requireProcess(): ChildProcess {
    if (Object.isNull(this.childProcess))
      throw new AppNotStartedException();
    return this.childProcess;
  }

  private static isOwned(directory: DataDirectory): boolean {
    try {
      return OwnershipLock.isOwned(directory);
    }
    catch (error) {
      if (ErrorCodeFixture.errcodeOf(error) === MainProcessFixture.NOT_A_DATABASE)
        return false;
      throw error;
    }
  }

  private static killIfRunning(processId: number): boolean {
    try {
      process.kill(processId);
      return true;
    }
    catch (error) {
      if (ErrorCodeFixture.of(error) === MainProcessFixture.NO_SUCH_PROCESS)
        return false;
      throw error;
    }
  }

  private static async askToStopAsync(discovery: RuntimeDiscovery): Promise<string> {
    try {
      const client = await RuntimeClient.connectAsync(Endpoint.parse(discovery.endpoint), discovery.token, RuntimeBuild.identity, MainProcessFixture.CLIENT_NAME,
        { onEvent: () => undefined, onDisconnected: () => undefined });
      try {
        const response = await client.stopAsync(StopPolicy.StopWork);
        return response.failure?.message ?? "it agreed";
      }
      finally {
        client.close();
      }
    }
    catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private static readRevision(): string {
    const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "unknown";
  }

  private readOutput(lines: readonly IClassifiedLine[]): void {
    for (const line of lines)
      if (line.kind === "platform-log")
        this.testInfo.annotations.push({ type: MainProcessFixture.PLATFORM_LOG_ANNOTATION, description: line.text });
      else if (line.kind === "diagnostic")
        this.diagnostics.push(line.text);
      else if (line.kind === "crash")
        this.crashOutput.push(line.text);
      else {
        this.mainProcessOutput.push(line.text);
        this.failures.push(`main: ${line.text}`);
      }
  }

  private async recordEnvironmentAsync(): Promise<void> {
    const electron = await this.answerAsync("report its versions",
      this.application.evaluate(() => ({ electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome })));
    const environment = {
      os: `${os.type()} ${os.release()}`,
      cpu: `${os.arch()} ${os.cpus()[0]?.model ?? "unknown"}`,
      runner: process.env["ImageOS"] ? `${process.env["ImageOS"]} ${process.env["ImageVersion"] ?? String.empty}`.trim() : "local",
      revision: MainProcessFixture.readRevision(),
      playwright: this.testInfo.config.version,
      electron: electron.electron,
      electronNode: electron.node,
      chrome: electron.chrome,
      hostNode: process.versions.node
    };
    this.testInfo.annotations.push({ type: "environment", description: JSON.stringify(environment) });
  }
}
