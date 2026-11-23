/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/// <reference types="node" />

import type { SpawnSyncOptions, SpawnSyncReturns } from "node:child_process";
import type { Stats } from "node:fs";
import type { Writable } from "node:stream";

import type {
  AppDetailsOptions, BrowserWindowConstructorOptions, CustomScheme, KeyboardInputEvent, MenuItemConstructorOptions, MessageBoxOptions, MessageBoxReturnValue, NavigationEntry, NotificationConstructorOptions, OpenDialogOptions,
  OpenDialogReturnValue, Rectangle, RenderProcessGoneDetails, SaveDialogOptions, SaveDialogReturnValue, TitleBarOverlayOptions, WindowOpenHandlerResponse
} from "electron";
import { type CancellationToken, type Logger, type ProgressInfo, Provider, type ResolvedUpdateFileInfo, type UpdateInfo } from "electron-updater";

import { type ArgumentException, Exception, type ExceptionOptions } from "@noldova/context.exceptions";
import type { JsonException, JsonObject, JsonValue } from "@noldova/context.json";
import type { Event, Failure, FileGrant, NotificationBroadcast, QualifiedName, QuitAnswer, Response, RuntimeHandover, StopPolicy, UpdateProcess, WebViewDeclaration, WindowStateKey, WorkReport } from "@noldova/desktop.protocol";
import {
  type AttachOptions, type ConnectionException, type DataDirectory, type DiagnosticRedactor, type Installation, type IProcessStarter, type IRuntimeClientListener, type IWindowsProcessApi,
  LaunchException, type LaunchSettings, type ProcessPresence, type SystemCommand, type UpdateBarrier, type UpdateBarrierStatus
} from "@noldova/desktop.runtime";

export { LinkPolicy } from "@noldova/desktop.protocol";

/**
 * Where starting or attaching to the runtime stands, as the window shows it.
 */
export declare enum StartupStateKind {
  /**
   * The main process is starting or attaching to the runtime.
   */
  Connecting = "Connecting",

  /**
   * The data directory holds data from before the shell; the person may move it aside.
   */
  PreShellData = "PreShellData",

  /**
   * An older build's runtime has work in progress; the person chooses to wait for it or stop it.
   */
  WorkInProgress = "WorkInProgress",

  /**
   * The main process waits for an older build's work to finish.
   */
  WaitingForWork = "WaitingForWork",

  /**
   * A newer build's runtime owns the data directory and this build cannot start it.
   */
  NewerBuild = "NewerBuild",

  /**
   * The runtime could not be started or reached; the person may try again.
   */
  Failed = "Failed",

  /**
   * Noldova Desktop Sample is saving the window's work and closing for an update.
   */
  Updating = "Updating",

  /**
   * The main process is connected to the runtime.
   */
  Ready = "Ready"
}

/**
 * What became of a file a window part asked to save, as the main process answers it.
 */
export declare enum FileSaveOutcome {
  /**
   * The bytes were written to the file the person chose.
   */
  Saved = "Saved",

  /**
   * The person cancelled the save dialog, or the window closed while it was open; nothing was written.
   */
  Cancelled = "Cancelled",

  /**
   * The request was refused or the file could not be written; the main process's log says why.
   */
  Failed = "Failed"
}

/**
 * The person's answer when quitting while work is in progress, as the window sends it.
 */
export declare enum QuitChoice {
  /**
   * Wait for the work to finish, then quit.
   */
  Wait = "Wait",

  /**
   * Stop the work and quit.
   */
  Stop = "Stop",

  /**
   * Keep Noldova Desktop Sample open.
   */
  Cancel = "Cancel"
}

/**
 * What installing the command on the macOS PATH did.
 */
export declare enum PathCommandOutcome {
  /**
   * The link now points to the command inside the app.
   */
  Installed = "Installed",

  /**
   * The link already pointed to the command inside this app, so nothing changed.
   */
  AlreadyInstalled = "AlreadyInstalled",

  /**
   * A file that is not a link has the link's name; it is left alone.
   */
  Occupied = "Occupied",

  /**
   * This build has no command to link, as in a development start.
   */
  Missing = "Missing",

  /**
   * The person cancelled the system's administrator prompt.
   */
  Cancelled = "Cancelled"
}

/**
 * How quitting goes on after the question about work in progress.
 */
export declare enum QuitOutcome {
  /**
   * Quit, stopping the runtime only if it is idle; no work is in progress, it finished, or it could not be read.
   */
  Quit = "Quit",

  /**
   * Quit, stopping the runtime's work and the runtime.
   */
  StopWork = "StopWork",

  /**
   * Stop quitting; Noldova Desktop Sample stays open.
   */
  Stay = "Stay"
}

/**
 * What becomes of an error a window's page reports, under its {@link WindowErrorLimit}.
 */
export declare enum WindowErrorAdmission {
  /**
   * Write the error to the log.
   */
  Write = "Write",

  /**
   * Leave the error out, and write once that the rest of the period's errors are left out.
   */
  Notice = "Notice",

  /**
   * Leave the error out without a word; the notice was already written.
   */
  Drop = "Drop"
}

/**
 * What an IP address reaches, as a web view's origin check judges it.
 */
export declare enum WebAddressKind {
  /**
   * An address on the internet.
   */
  Public = "Public",

  /**
   * This machine: `127.0.0.0/8` or `::1`.
   */
  Loopback = "Loopback",

  /**
   * The local network: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, the shared address space `100.64.0.0/10`, or `fc00::/7`.
   */
  Private = "Private",

  /**
   * A link-local address, `169.254.0.0/16` or `fe80::/10`, which is never allowed.
   */
  LinkLocal = "LinkLocal",

  /**
   * An unspecified address, `0.0.0.0/8` or `::`, which is never allowed.
   */
  Unspecified = "Unspecified"
}

/**
 * How the main process failed, for {@link MainProcessRecovery}.
 */
export declare enum MainProcessFailureKind {
  /**
   * An exception it did not catch.
   */
  UncaughtException = "UncaughtException",

  /**
   * A rejection it did not handle.
   */
  UnhandledRejection = "UnhandledRejection"
}

/**
 * A window that can show the question about work in progress.
 */
export interface IQuitPrompt {
  /**
   * Shows the question, or takes it away.
   *
   * @param question The question, or `null` to take it away.
   * @returns Whether the window can show it.
   * @example
   * ```ts
   * import type { IQuitPrompt } from "@noldova/desktop.electron";
   *
   * export function dismiss(prompt: IQuitPrompt): boolean {
   *   return prompt.show(null);
   * }
   * ```
   */
  show(question: QuitQuestion | null): boolean;
}

/**
 * Decides whether a window may close.
 */
export interface ICloseGuard {
  /**
   * Decides whether the window may close: another window stays open, or Noldova Desktop Sample keeps running without windows. When
   * it is the last window and Noldova Desktop Sample cannot keep running, the guard quits Noldova Desktop Sample instead and keeps the window open
   * until the quit closes it.
   *
   * @param prompt The closing window.
   * @returns A promise of whether the window may close.
   * @example
   * ```ts
   * import type { ICloseGuard, IQuitPrompt } from "@noldova/desktop.electron";
   *
   * export function mayCloseAsync(guard: ICloseGuard, prompt: IQuitPrompt): Promise<boolean> {
   *   return guard.canCloseAsync(prompt);
   * }
   * ```
   */
  canCloseAsync(prompt: IQuitPrompt): Promise<boolean>;
}

/**
 * What {@link QuitFlow} asks of the main process as Noldova Desktop Sample closes windows and quits.
 */
export interface IQuitHost {
  /**
   * Whether Noldova Desktop Sample has decided to quit and is closing its windows.
   *
   * @returns Whether Noldova Desktop Sample is exiting.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/desktop.electron";
   *
   * export function isQuitting(host: IQuitHost): boolean {
   *   return host.isExiting();
   * }
   * ```
   */
  isExiting(): boolean;

  /**
   * Whether Noldova Desktop Sample keeps running when its last window closes: on macOS, and while the tray icon really shows.
   *
   * @returns Whether Noldova Desktop Sample keeps running without windows.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/desktop.electron";
   *
   * export function staysInBackground(host: IQuitHost): boolean {
   *   return host.keepsRunningWithoutWindows();
   * }
   * ```
   */
  keepsRunningWithoutWindows(): boolean;

  /**
   * Whether a window is the last one open.
   *
   * @param prompt The window.
   * @returns Whether no other window is open.
   * @example
   * ```ts
   * import type { IQuitHost, IQuitPrompt } from "@noldova/desktop.electron";
   *
   * export function closesLast(host: IQuitHost, prompt: IQuitPrompt): boolean {
   *   return host.isLast(prompt);
   * }
   * ```
   */
  isLast(prompt: IQuitPrompt): boolean;

  /**
   * Asks every open window to save, as closing it would.
   *
   * @returns A promise of whether every window saved; a window whose save failed keeps Noldova Desktop Sample open.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/desktop.electron";
   *
   * export function saveAsync(host: IQuitHost): Promise<boolean> {
   *   return host.saveAllAsync();
   * }
   * ```
   */
  saveAllAsync(): Promise<boolean>;

  /**
   * Asks the runtime to stop unless another client uses it, which keeps it running with its work.
   *
   * @param policy How the runtime treats work in progress when no other client uses it.
   * @returns A promise of whether the runtime refused because work is in progress under {@link StopPolicy.IfIdle}.
   * @example
   * ```ts
   * import { StopPolicy } from "@noldova/desktop.protocol";
   * import type { IQuitHost } from "@noldova/desktop.electron";
   *
   * export function isBusyAsync(host: IQuitHost): Promise<boolean> {
   *   return host.stopAsync(StopPolicy.IfIdle);
   * }
   * ```
   */
  stopAsync(policy: StopPolicy): Promise<boolean>;

  /**
   * Finds the window that asks the question about work in progress, opening one when none is open.
   *
   * @returns A promise of the window once its page has painted, or `null` when it closed first.
   * @example
   * ```ts
   * import type { IQuitHost, IQuitPrompt } from "@noldova/desktop.electron";
   *
   * export function findAsync(host: IQuitHost): Promise<IQuitPrompt | null> {
   *   return host.findPromptAsync();
   * }
   * ```
   */
  findPromptAsync(): Promise<IQuitPrompt | null>;

  /**
   * Asks the application to quit, which starts {@link QuitFlow.quitAsync}.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/desktop.electron";
   *
   * export function startQuitting(host: IQuitHost): void {
   *   host.quit();
   * }
   * ```
   */
  quit(): void;

  /**
   * Closes every window without asking again and quits the application.
   * @example
   * ```ts
   * import type { IQuitHost } from "@noldova/desktop.electron";
   *
   * export function end(host: IQuitHost): void {
   *   host.exit();
   * }
   * ```
   */
  exit(): void;
}

/**
 * The question a window shows about work in progress when the person quits.
 */
export declare class QuitQuestion {
  /**
   * The work in progress, as the person reads it.
   */
  public readonly descriptions: readonly string[];

  /**
   * Whether the person chose to wait and Noldova Desktop Sample quits when the work finishes.
   */
  public readonly isWaiting: boolean;

  /**
   * Whether Noldova Desktop Sample asks before it stops for an update rather than before it quits.
   */
  public readonly isUpdate: boolean;

  /**
   * Creates the question.
   *
   * @param descriptions The work in progress.
   * @param isWaiting Whether the person chose to wait.
   * @param isUpdate Whether Noldova Desktop Sample asks before it stops for an update.
   * @example
   * ```ts
   * import { QuitQuestion } from "@noldova/desktop.electron";
   *
   * export const question: QuitQuestion = new QuitQuestion(["Indexing the project"], false, false);
   * ```
   */
  public constructor(descriptions: readonly string[], isWaiting: boolean, isUpdate: boolean);

  /**
   * Returns the form the window receives.
   *
   * @returns The `descriptions`, `isWaiting` and `isUpdate` fields.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QuitQuestion } from "@noldova/desktop.electron";
   *
   * export const json: JsonObject = new QuitQuestion([], true, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Stops every process of the installation before an update replaces its files, then calls the updater's handoff:
 * it asks about work in progress, holds the launch barrier, has every runtime's clients save, stops every runtime and
 * verifies by process id and start that each process has exited.
 */
export declare class UpdateStop {
  /**
   * Creates the update stop.
   *
   * @param installation The installation whose record and launch barrier it uses.
   * @param presence Finds processes in the process table.
   * @param connectAsync Connects to the runtime of a recorded data directory as the client `update`, without starting
   * one, calling the given callback each time the runtime reports a change of its work or disconnects; resolves `null`
   * when the directory is not in use by this installation.
   * @param askAsync Asks the person about the work in progress, listed by data directory, and can read it again to
   * keep the list current while the person waits for it, waiting between readings for a runtime's change: the wait
   * ends at once for a change that came since the last one ended, and rejects when its signal aborts. It resolves the
   * work the person agreed to stop, the list shown when they chose Stop or empty when they waited until none was left,
   * or `null` to cancel the update.
   * @param processId The coordinating main process's process id.
   * @param productVersion The coordinating main process's product version.
   * @param now Reads the current time, in milliseconds.
   * @param wait Resolves after the given number of milliseconds.
   * @param restart Starts the replaced AppImage once this main process has exited, or `null` when the main process does not run
   * from an AppImage.
   * @param log Records a barrier that could not be removed after the update stopped, even when tried again a second
   * later.
   * @param backUpAsync Backs up the databases of a recorded data directory once its runtime has exited;
   * `UpdateBackup.createAsync` of `@noldova/desktop.runtime` by default.
   * @example
   * ```ts
   * import { setTimeout as delay } from "node:timers/promises";
   *
   * import { AppImageRestart, UpdateStop } from "@noldova/desktop.electron";
   * import { ChildProcessStarter, type Installation, ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export function create(installation: Installation, errorFile: string): UpdateStop {
   *   const restart = AppImageRestart.find(process.platform, process.env, process.execPath, process.argv.slice(1), new ChildProcessStarter(), process.pid, errorFile);
   *   return new UpdateStop(
   *     installation, ProcessPresence.create(process.platform), () => Promise.resolve(null), () => Promise.resolve(null),
   *     process.pid, "0.2.0", Date.now, t => delay(t), restart, console.error);
   * }
   * ```
   */
  public constructor(
    installation: Installation,
    presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">,
    connectAsync: (dataDirectory: string, onChange: () => void) => Promise<IUpdateTarget | null>,
    askAsync: (work: readonly string[], readWorkAsync: () => Promise<readonly string[]>, waitForChangeAsync: (signal: AbortSignal) => Promise<void>) => Promise<readonly string[] | null>,
    processId: number,
    productVersion: string,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>,
    restart: AppImageRestart | null,
    log: (text: string) => void,
    backUpAsync?: (dataDirectory: string) => Promise<unknown>);

  /**
   * Stops the installation for an update and calls the handoff. It holds the launch barrier as `Preparing`, asks each
   * runtime `desktop.update`, then reads each runtime's work again: work the person did not agree to stop fails the
   * update, and `desktop.stop` stops the work of a runtime that still has the work they agreed to stop and otherwise
   * stops only if idle. It waits for every runtime and every process they listed except the main processes to exit, for as
   * long as a runtime's stop may take: the default `ProcessSettings.stopLimit` plus 10 seconds, 28 seconds. It
   * backs up the databases of every recorded data directory, one after another, sets the barrier to `Closing`, waits up to 10 seconds for the other main processes, those the runtimes listed and
   * those recorded in the installation that still run, then sets it to `HandedOff`. From an AppImage, it then starts the
   * restart before the handoff, and ends the restart when the handoff fails. Every connection closes when it
   * ends. When the handoff names the process that took over, the barrier records it, so the barrier holds while that
   * process runs; when that process cannot be found or the record cannot be written, the barrier stays without it, and
   * a record that cannot be written is logged and reported in the result.
   *
   * @param version The version being installed.
   * @param handOffAsync The updater's handoff, which starts what replaces the application's files and resolves that
   * process's id, or `null` when the platform does not give one.
   * @returns A promise of the result: handed off once the handoff has run, with whether the barrier records the
   * process that took over, or cancelled when the person cancelled at the question about work, with nothing changed.
   * @throws {UpdateStopException} Rejected with the reason when another update holds the barrier, work started
   * meanwhile, a runtime refused or something did not save, a process or main process did not exit in time, or a data
   * directory's databases could not be backed up, with the backup's failure as its cause; any other
   * failure, as of reading the process table, starting the AppImage restart or the handoff, gives the reason that the
   * update stopped on an unexpected error, with the failure as its cause. The barrier it held is removed first, so
   * every surviving runtime and main process resumes. Once the handoff has run, the barrier stays.
   * @throws {UpdateHandoffException} Rejected as the handoff rejected it, after the same cleanup.
   * @example
   * ```ts
   * import type { UpdateStop, UpdateStopResult } from "@noldova/desktop.electron";
   *
   * export function restartAsync(stop: UpdateStop, handOffAsync: () => Promise<number | null>): Promise<UpdateStopResult> {
   *   return stop.runAsync("0.3.0", handOffAsync);
   * }
   * ```
   */
  public runAsync(version: string, handOffAsync: () => Promise<number | null>): Promise<UpdateStopResult>;
}

/**
 * How an {@link UpdateStop} ended without failing: handed off, or cancelled at the question about work.
 */
export declare class UpdateStopResult {
  /**
   * Whether the handoff ran; `false` when the person cancelled at the question about work.
   */
  public readonly isHandedOff: boolean;

  /**
   * Whether the barrier holds all the handoff gave it: `false` when cancelled, or when the handoff named a running
   * process that the barrier could not be rewritten to record, so the barrier does not hold while that process runs;
   * `true` otherwise, also when the handoff named no process or one that could not be found.
   */
  public readonly isHandoffRecorded: boolean;

  private constructor();

  /**
   * The result of a stop the person cancelled at the question about work.
   *
   * @returns The result.
   * @example
   * ```ts
   * import { UpdateStopResult } from "@noldova/desktop.electron";
   *
   * export const result: UpdateStopResult = UpdateStopResult.cancelled();
   * ```
   */
  public static cancelled(): UpdateStopResult;

  /**
   * The result of a stop whose handoff ran.
   *
   * @param isHandoffRecorded Whether the barrier holds all the handoff gave it.
   * @returns The result.
   * @example
   * ```ts
   * import { UpdateStopResult } from "@noldova/desktop.electron";
   *
   * export const result: UpdateStopResult = UpdateStopResult.handedOff(true);
   * ```
   */
  public static handedOff(isHandoffRecorded: boolean): UpdateStopResult;
}

/**
 * Connects an {@link UpdateStop} to the runtime of a data directory in the installation's record, as the client
 * `update`. A directory without discovery that no runtime owns, or whose discovery names another program, is skipped.
 * A directory owned without discovery has a runtime that is still starting: the connector waits up to 15 seconds for
 * its discovery, skips the directory when the ownership ends first and fails the update when the time runs out. It
 * attaches without starting a runtime or taking over another build's, and identifies the runtime by the process id its
 * discovery names.
 */
export declare class UpdateTargetConnector {
  /**
   * Creates the connector.
   *
   * @param installationFolder The installation's folder.
   * @param locate Gives the folder of the installation a program belongs to, as `Installation.locate` does.
   * @param createLauncher Creates the launcher of a data directory.
   * @param presence Identifies the runtime's process.
   * @param now Reads the current time, in milliseconds.
   * @param wait Resolves after the given number of milliseconds.
   * @example
   * ```ts
   * import { setTimeout as delay } from "node:timers/promises";
   *
   * import { type IRuntimeLauncher, UpdateTargetConnector } from "@noldova/desktop.electron";
   * import { type DataDirectory, ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export function create(createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher): UpdateTargetConnector {
   *   return new UpdateTargetConnector("/home/person/.config/Noldova Desktop Sample/installations/0123456789abcdef", () => "/home/person/.config/Noldova Desktop Sample/installations/0123456789abcdef",
   *     createLauncher, ProcessPresence.create("linux"), Date.now, t => delay(t));
   * }
   * ```
   */
  public constructor(
    installationFolder: string,
    locate: (program: string) => string,
    createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher,
    presence: Pick<ProcessPresence, "stampAsync">,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>);

  /**
   * Connects to the data directory's runtime.
   *
   * @param root The data directory's root.
   * @param onChange Called each time the runtime publishes `desktop.work` and when the connection ends.
   * @returns A promise of the runtime, its process and the connection, or `null` when the directory is skipped or its
   * runtime stopped before the connection.
   * @throws {UpdateStopException} Rejected with a readable reason when the runtime cannot be reached or its process
   * cannot be identified; the connection is then closed.
   * @example
   * ```ts
   * import type { IUpdateTarget, UpdateTargetConnector } from "@noldova/desktop.electron";
   *
   * export function connectAsync(connector: UpdateTargetConnector): Promise<IUpdateTarget | null> {
   *   return connector.connectAsync("/home/person/.noldova-desktop", () => undefined);
   * }
   * ```
   */
  public connectAsync(root: string, onChange: () => void): Promise<IUpdateTarget | null>;
}

/**
 * The Linux handoff of an update: replaces the AppImage file in place with the downloaded one, keeping its location,
 * its name and its permissions, so its launchers still start it. The download is copied to a file with a unique name
 * beside the AppImage, created only when no file has that name, given the AppImage's permissions and flushed to disk,
 * and then renamed over the AppImage, so the AppImage is always either the old version or the whole new one; the
 * folder is then flushed to disk too, and a flush that fails is logged, since the AppImage is already replaced. Before
 * the copy, the copies an earlier replacement of that AppImage left behind are removed: only the files named
 * `.<AppImage name>.<UUID>.part`, the name a replacement gives its copy. It runs only as the handoff, while the
 * update's launch barrier holds, so no other replacement of the AppImage runs. A link to the AppImage is followed and
 * the file it names is replaced. The download is kept, and on any failure the copy is removed and the AppImage is
 * left as it was. No process takes the handoff; {@link AppImageRestart} starts the new version once the main process has
 * exited.
 */
export declare class AppImageReplacement {
  /**
   * Creates the replacement of an AppImage file.
   *
   * @param image The AppImage file, or a link to it.
   * @param log Writes a line to the main process's log, such as a folder that could not be flushed to disk after the replacement.
   * @example
   * ```ts
   * import { AppImageReplacement } from "@noldova/desktop.electron";
   *
   * export const replacement: AppImageReplacement = new AppImageReplacement("/home/person/Applications/Noldova Desktop Sample.AppImage", console.log);
   * ```
   */
  public constructor(image: string, log: (text: string) => void);

  /**
   * Why the AppImage can't be replaced, read now: the AppImage, after its links, can't be found, or its folder can't be
   * written; `null` when it can. The main process reads it once, before it checks for updates, so an update it could never
   * install is refused before anything downloads or stops.
   *
   * @example
   * ```ts
   * import type { AppImageReplacement } from "@noldova/desktop.electron";
   *
   * export function canReplace(replacement: AppImageReplacement): boolean {
   *   return replacement.refusal === null;
   * }
   * ```
   */
  public get refusal(): string | null;

  /**
   * Replaces the AppImage with the downloaded file.
   *
   * @param download The downloaded and validated AppImage of the new version.
   * @returns A promise that resolves once the AppImage has been replaced.
   * @throws {UpdateHandoffException} Rejected with the reason when the AppImage cannot be read, its folder cannot be
   * written, or the download cannot be copied or put in its place; the AppImage is then left as it was.
   * @example
   * ```ts
   * import { AppImageReplacement } from "@noldova/desktop.electron";
   *
   * export function handOffAsync(image: string, download: string): Promise<void> {
   *   return new AppImageReplacement(image, console.log).replaceAsync(download);
   * }
   * ```
   */
  public replaceAsync(download: string): Promise<void>;
}

/**
 * Hands a ready update over to what installs it, once every process of the installation has stopped: the step
 * `UpdateStop.runAsync` runs last. Each platform's handoff first hashes the downloaded file again and refuses one whose
 * SHA-512 no longer matches the ready record.
 */
export interface IUpdateHandoff {
  /**
   * Why this copy of Noldova Desktop Sample can never install an update, known before anything is downloaded or stopped, or
   * `null` when it can. The update controller then shows the update as failed with this reason instead of downloading
   * it or offering Restart to update.
   *
   * @example
   * ```ts
   * import type { IUpdateHandoff } from "@noldova/desktop.electron";
   *
   * export function canInstall(handoff: IUpdateHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  readonly refusal: string | null;

  /**
   * Hands the update over.
   *
   * @param record The ready update.
   * @returns A promise of the id of the process that takes the update over, or `null` when none does.
   * @throws {UpdateHandoffException} Rejected with the reason when the update cannot be handed over; nothing is installed.
   * @example
   * ```ts
   * import type { IUpdateHandoff, UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export function handOffAsync(handoff: IUpdateHandoff, record: UpdateReadyRecord): Promise<number | null> {
   *   return handoff.handOffAsync(record);
   * }
   * ```
   */
  handOffAsync(record: UpdateReadyRecord): Promise<number | null>;

  /**
   * Removes what an earlier handoff of the installation left behind. The main process calls it at start, before its
   * updater.
   *
   * @returns A promise that resolves once that is removed or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { IUpdateHandoff } from "@noldova/desktop.electron";
   *
   * export function tidyAsync(handoff: IUpdateHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  clearAsync(): Promise<void>;
}

/**
 * The part of Electron's `autoUpdater`, Squirrel.Mac, that stages a macOS update.
 */
export interface INativeUpdater {
  /**
   * Asks Squirrel.Mac to fetch the update from the feed electron-updater set and stage it.
   *
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/desktop.electron";
   *
   * export function stage(updater: INativeUpdater): void {
   *   updater.checkForUpdates();
   * }
   * ```
   */
  checkForUpdates(): void;

  /**
   * Listens for an event: `update-downloaded` once the update is staged, `error` with the failure.
   *
   * @param event The event's name.
   * @param listener Receives the event's values.
   * @returns The updater.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/desktop.electron";
   *
   * export function onStaged(updater: INativeUpdater, run: () => void): void {
   *   updater.on("update-downloaded", run);
   * }
   * ```
   */
  on(event: string, listener: (...values: unknown[]) => void): unknown;

  /**
   * Listens for the next occurrence of an event only.
   *
   * @param event The event's name.
   * @param listener Receives the event's values.
   * @returns The updater.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/desktop.electron";
   *
   * export function onFailure(updater: INativeUpdater, run: (error: unknown) => void): void {
   *   updater.once("error", run);
   * }
   * ```
   */
  once(event: string, listener: (...values: unknown[]) => void): unknown;

  /**
   * Stops listening for an event.
   *
   * @param event The event's name.
   * @param listener A listener given to {@link INativeUpdater.on}.
   * @returns The updater.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/desktop.electron";
   *
   * export function offStaged(updater: INativeUpdater, run: () => void): void {
   *   updater.removeListener("update-downloaded", run);
   * }
   * ```
   */
  removeListener(event: string, listener: (...values: unknown[]) => void): unknown;

  /**
   * Quits the application, so the ShipIt process installs the staged update, and has it start the new version.
   *
   * @throws {Error} When Squirrel.Mac has no staged update to install.
   * @example
   * ```ts
   * import type { INativeUpdater } from "@noldova/desktop.electron";
   *
   * export function install(updater: INativeUpdater): void {
   *   updater.quitAndInstall();
   * }
   * ```
   */
  quitAndInstall(): void;
}

/**
 * The ShipIt process Squirrel.Mac starts, as the launchd job `<bundle id>.ShipIt`, once it has staged an update; it
 * installs the update when the main process quits.
 */
export interface IShipItProcess {
  /**
   * Finds the job's process.
   *
   * @returns A promise of its process id, or `null` when none runs.
   * @example
   * ```ts
   * import type { IShipItProcess } from "@noldova/desktop.electron";
   *
   * export function findAsync(shipIt: IShipItProcess): Promise<number | null> {
   *   return shipIt.findAsync();
   * }
   * ```
   */
  findAsync(): Promise<number | null>;

  /**
   * Removes the job from the person's launchd domain, so quitting installs nothing; a job in the system domain stays
   * and still installs the update at the next quit.
   *
   * @returns A promise that resolves once the job is removed.
   * @example
   * ```ts
   * import type { IShipItProcess } from "@noldova/desktop.electron";
   *
   * export function removeAsync(shipIt: IShipItProcess): Promise<void> {
   *   return shipIt.removeAsync();
   * }
   * ```
   */
  removeAsync(): Promise<void>;

  /**
   * Removes the job only when it is listed without a process, as a finished install leaves it.
   *
   * @returns A promise that resolves once such a job is removed, or at once when there is none.
   * @example
   * ```ts
   * import type { IShipItProcess } from "@noldova/desktop.electron";
   *
   * export function tidyAsync(shipIt: IShipItProcess): Promise<void> {
   *   return shipIt.removeStoppedAsync();
   * }
   * ```
   */
  removeStoppedAsync(): Promise<void>;
}

/**
 * The Windows handoff of an update. It copies the downloaded installer into a new folder of its own under
 * `handoff` in the installation's folder, restricted to the current user, with a copy that fails when the file
 * exists. It then holds the copy open with read sharing only, so it can be read and started but not written,
 * renamed or deleted, hashes it again and gives it to the installer's start, which checks its publisher and starts
 * it. The installer reads its own file after it has started, so the copy stays held until this main process exits; a
 * failure lets it go and removes its folder. A later start removes the `handoff` folder, which a running installer
 * keeps in place.
 */
export declare class InstallerHandoff implements IUpdateHandoff {
  /**
   * Always `null`: whether the installer may run is known only once it is copied and its publisher checked.
   *
   * @example
   * ```ts
   * import type { InstallerHandoff } from "@noldova/desktop.electron";
   *
   * export function canInstall(handoff: InstallerHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  public readonly refusal: string | null;

  /**
   * Creates the handoff.
   *
   * @param installationFolder The installation's folder.
   * @param protectAsync Restricts a new folder to the current user.
   * @param files Holds a file open for reading and closes it, as `WindowsProcessApi` does.
   * @param startAsync Checks the installer's publisher and starts it, resolving to its process id.
   * @param log Records a failed attempt's folder that cannot be removed.
   * @example
   * ```ts
   * import { SystemCommand, WindowsFolderProtector, WindowsProcessApi } from "@noldova/desktop.runtime";
   * import { InstallerHandoff } from "@noldova/desktop.electron";
   *
   * export function create(installationFolder: string, startAsync: (installer: string) => Promise<number>): InstallerHandoff {
   *   const protector = new WindowsFolderProtector(new SystemCommand(), process.env);
   *   return new InstallerHandoff(installationFolder, t => protector.protectAsync(t), WindowsProcessApi.create(), startAsync, console.error);
   * }
   * ```
   */
  public constructor(
    installationFolder: string,
    protectAsync: (folder: string) => Promise<void>,
    files: Pick<IWindowsProcessApi, "openFileForReading" | "closeHandle">,
    startAsync: (installer: string) => Promise<number>,
    log: (text: string) => void);

  /**
   * Removes the copies earlier handoffs left in the installation's folder, logging a copy that cannot be removed
   * yet, such as one a running installer holds.
   *
   * @returns A promise that resolves once the copies are removed or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { InstallerHandoff } from "@noldova/desktop.electron";
   *
   * export function tidyAsync(handoff: InstallerHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  public clearAsync(): Promise<void>;

  /**
   * Copies, holds and checks the installer, then starts it.
   *
   * @param record The ready update, whose file is the downloaded installer.
   * @returns A promise of the installer's process id.
   * @throws {StaleUpdateException} Rejected when the copy's SHA-512 no longer matches the ready record.
   * @throws {UpdateHandoffException} Rejected when the folder cannot be made or restricted, the installer cannot be
   * copied, held or read, or the start refuses it, as for a publisher that isn't Noldova Desktop Sample's.
   * @example
   * ```ts
   * import type { InstallerHandoff, UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export function startAsync(handoff: InstallerHandoff, record: UpdateReadyRecord): Promise<number> {
   *   return handoff.handOffAsync(record);
   * }
   * ```
   */
  public handOffAsync(record: UpdateReadyRecord): Promise<number>;
}

/**
 * The Linux handoff of an update: hashes the downloaded AppImage again and has {@link AppImageReplacement} put it in
 * place of the running one. No process takes the update over; {@link AppImageRestart} starts the new version.
 */
export declare class AppImageHandoff implements IUpdateHandoff {
  /**
   * Why the update cannot be installed: the main process doesn't run from an AppImage, or the folder refusal it was
   * created with; `null` when neither holds.
   *
   * @example
   * ```ts
   * import type { AppImageHandoff } from "@noldova/desktop.electron";
   *
   * export function canInstall(handoff: AppImageHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  public get refusal(): string | null;

  /**
   * Creates the handoff.
   *
   * @param replacement Replaces the AppImage with the download, or `null` when the main process doesn't run from an AppImage.
   * @param verifyAsync Checks the ready update's signature again, as {@link UpdateSignatureCheck.checkReadyAsync} does,
   * and resolves to why it failed, or `null` when it passed.
   * @param folderRefusal Why the AppImage can't be replaced, such as {@link AppImageReplacement.refusal}; `null` by default.
   * @example
   * ```ts
   * import { ProductInfo } from "@noldova/desktop.runtime";
   * import { AppImageHandoff, AppImageReplacement, UpdateSignatureCheck } from "@noldova/desktop.electron";
   *
   * const check = new UpdateSignatureCheck(ProductInfo.current.linuxUpdateKeys, process.platform, process.arch, console.log, Date.now);
   * const replacement = new AppImageReplacement("/home/person/Applications/Noldova Desktop Sample.AppImage", console.log);
   *
   * export const handoff: AppImageHandoff = new AppImageHandoff(replacement, t => check.checkReadyAsync(t), replacement.refusal);
   * ```
   */
  public constructor(replacement: Pick<AppImageReplacement, "replaceAsync"> | null, verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>,
    folderRefusal?: string | null);

  /**
   * Checks the download and its signature, and replaces the AppImage with it.
   *
   * @param record The ready update.
   * @returns A promise of `null` once the AppImage is replaced.
   * @throws {StaleUpdateException} Rejected when the download's SHA-512 no longer matches the ready record.
   * @throws {UpdateUnsignedAtHandoffException} Rejected when the ready update carries no valid signature by a key the
   * build ships, as when the record was written by something other than this app.
   * @throws {UpdateHandoffException} Rejected when the main process doesn't run from an AppImage or the AppImage cannot be
   * replaced.
   * @example
   * ```ts
   * import type { AppImageHandoff, UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export async function replaceAsync(handoff: AppImageHandoff, record: UpdateReadyRecord): Promise<void> {
   *   await handoff.handOffAsync(record);
   * }
   * ```
   */
  public handOffAsync(record: UpdateReadyRecord): Promise<null>;

  /**
   * Leaves nothing to remove, since a failed replacement removes its own copy; the next replacement removes any copy an interrupted one left.
   *
   * @returns A promise that resolves once that is done or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { AppImageHandoff } from "@noldova/desktop.electron";
   *
   * export function tidyAsync(handoff: AppImageHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  public clearAsync(): Promise<void>;
}

/**
 * The one-time move of a macOS app that names an install folder, from `/Applications/<Product>.app`, where an earlier
 * release installed it, into `/Applications/<Folder>/<Product>.app`, and the removal of a second copy a person installed in
 * the home folder's Applications. The data folder stays where it is.
 */
export declare class InstallFolderMove {
  /**
   * Creates the move.
   *
   * @param app The application, which waits until ready, starts the moved copy and exits.
   * @param shell The shell that moves the old copy to the Trash.
   * @param process The main process's platform, program, command line, environment, process id, programs and files, and
   *   the probe that tells whether another process still runs.
   * @param log The main process's log, which the move writes to and flushes before it exits.
   * @example
   * ```ts
   * import { InstallFolderMove, type IApplicationHost, type IMainProcessEnvironment, type IMainProcessLog, type IShellHost } from "@noldova/desktop.electron";
   *
   * export function createMove(app: IApplicationHost, shell: IShellHost, process: IMainProcessEnvironment, log: IMainProcessLog): InstallFolderMove {
   *   return new InstallFolderMove(app, shell, process, log);
   * }
   * ```
   */
  public constructor(app: Pick<IApplicationHost, "whenReady" | "releaseSingleInstanceLock" | "relaunch" | "exit">, shell: Pick<IShellHost, "trashItem">,
    process: Pick<IMainProcessEnvironment, "platform" | "execPath" | "argv" | "env" | "processId" | "programs" | "files" | "probeProcess">, log: IMainProcessLog);

  /**
   * Moves a packaged macOS app running from `/Applications/<Product>.app` into its install folder once: copies it with
   * `ditto` beside the target under a name unique to this process and renames it into place, which fails rather than
   * nesting when the target appeared meanwhile, moves the old copy to the Trash, starts the copy in the folder with the
   * same arguments and exits. When the folder already holds the app, with the same bundle id and a version as new or
   * newer than this copy's release version, it moves the old copy to the Trash and starts that one; any other bundle there is left alone, and so is this
   * copy. Where it can't write the folder, it removes its unfinished copy, logs why and keeps running where it is.
   * Before it copies, it removes the unfinished copies, `.<process id>-<Product>.app`, that processes which are gone left
   * in the folder, and logs any it can't remove. When the app runs from `/Applications/<Folder>/<Product>.app` itself, it
   * moves a copy in `$HOME/Applications/<Folder>/<Product>.app` to the Trash when that copy has the same bundle id and a
   * release version as old or older, logs and leaves any other or one whose path resolves anywhere but itself, and keeps
   * running.
   *
   * @param isPackaged Whether this is a packaged build; a development build never moves.
   * @param productName The product's name, that of its `.app` bundle.
   * @param installFolder The folder the app installs in, or `null` when it names none.
   * @returns `true` once it started the copy in the folder and is exiting, or `false` when the app keeps running here.
   * @example
   * ```ts
   * import type { InstallFolderMove } from "@noldova/desktop.electron";
   *
   * export async function shouldStopAsync(move: InstallFolderMove): Promise<boolean> {
   *   return await move.runAsync(true, "Sample", "Sample Makers");
   * }
   * ```
   */
  public runAsync(isPackaged: boolean, productName: string, installFolder: string | null): Promise<boolean>;
}

/**
 * The handoff of an update on Linux for a copy installed from the Debian package: hashes the downloaded `.deb` again,
 * checks its signature, and runs the package's update installer, `resources/linux-update-install`, through pkexec, which
 * asks for an administrator's permission. As root, the installer copies the `.deb` into a folder only root can write,
 * requires the copy's SHA-512 to be the checked one, and installs the copy with dpkg, so a file changed after the check
 * is never installed. No process takes the update over; {@link AppImageRestart} starts the new version.
 */
export declare class DebianHandoff implements IUpdateHandoff {
  /**
   * Why the update cannot be installed when the system has no pkexec or the package's update installer is missing or
   * can be changed by someone other than root, or `null` when it can.
   *
   * @example
   * ```ts
   * import type { DebianHandoff } from "@noldova/desktop.electron";
   *
   * export function canInstall(handoff: DebianHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  public get refusal(): string | null;

  /**
   * Creates the handoff.
   *
   * @param installer The pkexec program that runs the update installer as root, or `null` when the system has none.
   * @param updateInstaller The package's update installer, as {@link DebianHandoff.findUpdateInstaller} finds it, or
   * `null` when it is missing or someone other than root can change it.
   * @param runAsync Runs a program with its arguments and resolves once it exits successfully, or rejects with why it
   * did not, an error whose `code` is the program's exit code.
   * @param verifyAsync Checks the ready update's signature again, as {@link UpdateSignatureCheck.checkReadyAsync} does,
   * and resolves to why it failed, or `null` when it passed.
   * @example
   * ```ts
   * import { execFile } from "node:child_process";
   * import { promisify } from "node:util";
   *
   * import { ProductInfo } from "@noldova/desktop.runtime";
   * import { DebianHandoff, UpdateSignatureCheck } from "@noldova/desktop.electron";
   *
   * const check = new UpdateSignatureCheck(ProductInfo.current.linuxUpdateKeys, process.platform, process.arch, console.log, Date.now);
   * export const handoff: DebianHandoff = new DebianHandoff("/usr/bin/pkexec", DebianHandoff.findUpdateInstaller("/opt/Sample/resources/linux-update-install"),
   *   (program, args) => promisify(execFile)(program, [...args]), t => check.checkReadyAsync(t));
   * ```
   */
  public constructor(installer: string | null, updateInstaller: string | null, runAsync: (program: string, programArguments: readonly string[]) => Promise<unknown>,
    verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>);

  /**
   * Gives the package's update installer when it is a regular file owned by root that neither its group nor others can
   * write, so only root can change what pkexec runs.
   *
   * @param file The update installer, `linux-update-install` in the package's `resources` folder.
   * @returns The file, or `null` when it is missing or not only root's to change.
   * @example
   * ```ts
   * import { DebianHandoff } from "@noldova/desktop.electron";
   *
   * export const installer: string | null = DebianHandoff.findUpdateInstaller("/opt/Sample/resources/linux-update-install");
   * ```
   */
  public static findUpdateInstaller(file: string): string | null;

  /**
   * Tells whether a file's status makes it only root's to change: a regular file owned by root that neither its group
   * nor others can write.
   *
   * @param status The file's status, as `fs.statSync` gives it.
   * @returns Whether only root can change the file.
   * @example
   * ```ts
   * import { statSync } from "node:fs";
   *
   * import { DebianHandoff } from "@noldova/desktop.electron";
   *
   * export const isTrusted: boolean = DebianHandoff.isOnlyRootsToChange(statSync("/opt/Sample/resources/linux-update-install"));
   * ```
   */
  public static isOnlyRootsToChange(status: Pick<Stats, "isFile" | "uid" | "mode">): boolean;

  /**
   * Checks the download and its signature, and installs it.
   *
   * @param record The ready update.
   * @returns A promise of `null` once the package is installed.
   * @throws {StaleUpdateException} Rejected when the download's SHA-512 no longer matches the ready record.
   * @throws {UpdateUnsignedAtHandoffException} Rejected when the ready update carries no valid signature by a key the
   * build ships, as when the record was written by something other than this app; pkexec is not started.
   * @throws {UpdateChangedBeforeHandoffException} Rejected when the file can no longer be read, or when the update
   * installer's copy of it is not the checked file: not a regular file, not of the checked size, or of another SHA-512,
   * as when the file was changed, moved or replaced by a link after the check; nothing is installed.
   * @throws {DebianUpdateArgumentsRefusedException} Rejected when the update installer refuses its arguments, the file,
   * the SHA-512 in hexadecimal and the size, which this app never passes malformed.
   * @throws {DebianInstallerMissingException} Rejected when the system has no pkexec.
   * @throws {DebianUpdateInstallerMissingException} Rejected when the update installer is missing or not only root's to
   * change.
   * @throws {DebianPackageNotInstalledException} Rejected when pkexec or dpkg fails, as when the person refuses the
   * permission.
   * @example
   * ```ts
   * import type { DebianHandoff, UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export async function installAsync(handoff: DebianHandoff, record: UpdateReadyRecord): Promise<void> {
   *   await handoff.handOffAsync(record);
   * }
   * ```
   */
  public handOffAsync(record: UpdateReadyRecord): Promise<null>;

  /**
   * Leaves nothing to remove, since dpkg either installs the package or leaves the installed one.
   *
   * @returns A promise that resolves at once; it never rejects.
   * @example
   * ```ts
   * import type { DebianHandoff } from "@noldova/desktop.electron";
   *
   * export function tidyAsync(handoff: DebianHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  public clearAsync(): Promise<void>;
}

/**
 * Tells whether this copy was installed from the Debian package, whose install writes `deb` into `resources/package-type`
 * beside the program.
 */
export declare class DebianPackage {
  /**
   * Tells whether a program was installed from the Debian package.
   *
   * @param platform The main process's platform.
   * @param executablePath The main process's program.
   * @returns Whether the platform is Linux and the program's `resources/package-type` holds `deb`; `false` when that file cannot be read.
   * @example
   * ```ts
   * import { DebianPackage } from "@noldova/desktop.electron";
   *
   * export const isDebianPackage: boolean = DebianPackage.isInstalled(process.platform, process.execPath);
   * ```
   */
  public static isInstalled(platform: string, executablePath: string): boolean;
}

/**
 * The macOS handoff of an update through Squirrel.Mac. When electron-updater has not downloaded the update in this
 * process, as after a restart restored it from the ready record, it checks the feed and downloads again, which
 * reuses the cached ZIP once it matches. It hashes the ZIP again, has Squirrel.Mac fetch it from electron-updater's
 * local feed and stage it, which checks the update's code signature, and gives the ShipIt process that installs it
 * once the main process quits through `autoUpdater.quitAndInstall`. Only the handoff stages: once staged, any quit
 * installs. So a handoff that fails after asking Squirrel.Mac to stage, or finds no ShipIt process after the stage,
 * removes the ShipIt job, and after the 2 minutes it also removes the job of a stage that finishes later, until the
 * next handoff asks Squirrel.Mac to stage.
 */
export declare class SquirrelHandoff implements IUpdateHandoff {
  /**
   * Always `null`: whether macOS can stage the update is known only once Squirrel tries.
   *
   * @example
   * ```ts
   * import type { SquirrelHandoff } from "@noldova/desktop.electron";
   *
   * export function canInstall(handoff: SquirrelHandoff): boolean {
   *   return handoff.refusal === null;
   * }
   * ```
   */
  public readonly refusal: string | null;

  /**
   * Creates the handoff.
   *
   * @param updater The installation's updater.
   * @param native Electron's `autoUpdater`.
   * @param shipIt The ShipIt job of the staged update.
   * @param schedule Runs a callback after a delay and gives what cancels it.
   * @param log Records a ShipIt job that cannot be removed.
   * @example
   * ```ts
   * import { autoUpdater } from "electron";
   * import { type IShipItProcess, type IUpdater, SquirrelHandoff } from "@noldova/desktop.electron";
   *
   * export function create(updater: IUpdater, shipIt: IShipItProcess): SquirrelHandoff {
   *   return new SquirrelHandoff(updater, autoUpdater, shipIt, (wait, run) => {
   *     const timer = setTimeout(run, wait);
   *     return () => clearTimeout(timer);
   *   }, console.error);
   * }
   * ```
   */
  public constructor(
    updater: IUpdater,
    native: INativeUpdater,
    shipIt: IShipItProcess,
    schedule: (delay: number, run: () => void) => () => void,
    log: (text: string) => void);

  /**
   * Stages the update and finds the process that installs it.
   *
   * @param record The ready update.
   * @returns A promise of ShipIt's process id.
   * @throws {UpdateException} Rejected when the check or the download again fails.
   * @throws {StaleUpdateException} Rejected when the feed no longer offers the version or the ZIP's SHA-512 no longer
   * matches the ready record.
   * @throws {UpdateHandoffException} Rejected when Squirrel.Mac fails to stage it or hasn't within 2 minutes, or when
   * no ShipIt process waits after the stage or it cannot be looked up.
   * @example
   * ```ts
   * import type { SquirrelHandoff, UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export function stageAsync(handoff: SquirrelHandoff, record: UpdateReadyRecord): Promise<number> {
   *   return handoff.handOffAsync(record);
   * }
   * ```
   */
  public handOffAsync(record: UpdateReadyRecord): Promise<number>;

  /**
   * Removes the ShipIt job a finished install left without a process, logging a job it cannot remove; a running ShipIt is left alone.
   *
   * @returns A promise that resolves once that is done or the failure is logged; it never rejects.
   * @example
   * ```ts
   * import type { SquirrelHandoff } from "@noldova/desktop.electron";
   *
   * export function tidyAsync(handoff: SquirrelHandoff): Promise<void> {
   *   return handoff.clearAsync();
   * }
   * ```
   */
  public clearAsync(): Promise<void>;
}

/**
 * Starts the replaced AppImage, or the program a Debian package installed, after an update, once this main process has exited. A process that still holds the old
 * version's files keeps the replaced AppImage mounted, so the new version starts from `/bin/bash`, through the runtime
 * launch's `ProcessLaunchCommand`, which closes the descriptors it inherited above standard error, with its startup
 * files and inherited shell options disabled. Bash waits until the main process that started it has ended: its
 * `/proc/<id>/stat` is gone or shows a zombie or another start time than the main process had, so a reused process id
 * cannot delay it. Bash's parent is not the main process, since the detached start forks twice. Once the wait
 * limit has passed, timed in whole seconds from Bash's start, Bash writes to the error file that the main process had
 * not ended and starts the AppImage anyway, from the root folder. Only Linux runs it, since
 * {@link AppImageRestart.find} finds no restart on Windows and macOS, which have no `/proc`. The environment it starts
 * with leaves out the old mount's `APPIMAGE`, `APPDIR`, `ARGV0` and `OWD`, and removes from `PATH`, `XDG_DATA_DIRS`,
 * `LD_LIBRARY_PATH` and `GSETTINGS_SCHEMA_DIR` the entries the AppImage's `AppRun` added around them, leaving out a
 * variable that held nothing else.
 */
export declare class AppImageRestart {
  private constructor();

  /**
   * Finds the restart of a main process that runs from an AppImage or from a Debian package's install, which
   * {@link DebianPackage.isInstalled} tells; the restart of a Debian install starts its program again.
   *
   * @param platform The main process's platform.
   * @param environment The main process's environment, whose `APPIMAGE` names the AppImage file and whose `APPDIR` its mount.
   * @param executablePath The main process's program, which runs from inside the mount.
   * @param launchArguments The arguments the new version starts with.
   * @param starter Starts Bash detached.
   * @param processId The main process's process id; Bash waits until that process has ended.
   * @param errorFile The file Bash's standard error is appended to; the new version's output is discarded.
   * @param waitLimit How long Bash waits for the main process, in milliseconds, a minute by default; Bash counts it in
   * whole wall-clock seconds from its start, so a clock step or a resume from suspend can end the wait sooner.
   * @param processFolder The folder whose `<id>/stat` gives the main process's start time; `/proc` by default.
   * @returns The restart, or `null` on Windows and macOS and when the main process runs neither from an AppImage nor from a Debian package's install.
   * @example
   * ```ts
   * import { AppImageRestart } from "@noldova/desktop.electron";
   * import { ChildProcessStarter } from "@noldova/desktop.runtime";
   *
   * export function find(errorFile: string): AppImageRestart | null {
   *   return AppImageRestart.find(process.platform, process.env, process.execPath, process.argv.slice(1), new ChildProcessStarter(), process.pid, errorFile);
   * }
   * ```
   */
  public static find(platform: string, environment: NodeJS.ProcessEnv, executablePath: string, launchArguments: readonly string[], starter: IProcessStarter, processId: number,
    errorFile: string, waitLimit?: number, processFolder?: string): AppImageRestart | null;

  /**
   * Reads the main process's start time from `<id>/stat` in the process folder and starts Bash, which waits for the main process to exit
   * and then starts the AppImage. When the start time cannot be read, Bash waits only while the process id is in use.
   *
   * @returns A promise that resolves once Bash has started.
   * @throws LaunchException as a rejection when `/bin/bash` is not executable, `/proc/self/fd` cannot be read or Bash cannot be started.
   * @example
   * ```ts
   * import type { AppImageRestart } from "@noldova/desktop.electron";
   *
   * export function startAsync(restart: AppImageRestart): Promise<void> {
   *   return restart.startAsync();
   * }
   * ```
   */
  public startAsync(): Promise<void>;

  /**
   * Ends the Bash that {@link AppImageRestart.startAsync} started, so the AppImage does not start when the main process
   * later exits. It does nothing before a start, after a cancel, or when Bash has already ended.
   *
   * @example
   * ```ts
   * import type { AppImageRestart } from "@noldova/desktop.electron";
   *
   * export function cancel(restart: AppImageRestart): void {
   *   restart.cancel();
   * }
   * ```
   */
  public cancel(): void;
}

/**
 * The Windows handoff of an update: checks the downloaded installer's signature by the publisher again, right before
 * starting it, so a file changed after its download is never run, then starts it quietly with the arguments of an
 * update, `--updated /S --force-run`, so it keeps the existing installation's folder and scope and starts the new
 * version once it has installed it. The installer starts detached, through a starter that gives it none of the
 * main process's inherited handles, and its process is the one that takes the handoff.
 */
export declare class InstallerStart {
  /**
   * Creates the installer's start.
   *
   * @param starter Starts the installer detached; the main process's `UtilityProcessStarter`.
   * @param verifyAsync Checks the installer's signature by the publisher, resolving `null` when it is valid and
   * otherwise the reason it is not.
   * @param environment The environment the installer starts with.
   * @param errorFile The file the installer's standard error is appended to.
   * @example
   * ```ts
   * import { InstallerStart } from "@noldova/desktop.electron";
   * import { ChildProcessStarter } from "@noldova/desktop.runtime";
   *
   * export function create(verifyAsync: (installer: string) => Promise<string | null>, errorFile: string): InstallerStart {
   *   return new InstallerStart(new ChildProcessStarter(), verifyAsync, process.env, errorFile);
   * }
   * ```
   */
  public constructor(starter: IProcessStarter, verifyAsync: (installer: string) => Promise<string | null>, environment: NodeJS.ProcessEnv, errorFile: string);

  /**
   * Checks the installer's signature and starts it.
   *
   * @param installer The downloaded installer of the new version.
   * @returns The installer's process id.
   * @throws {UpdateHandoffException} Rejected with the reason when the installer is not signed by the publisher, in
   * which case it is not started, or when it cannot be started.
   * @example
   * ```ts
   * import type { InstallerStart } from "@noldova/desktop.electron";
   *
   * export function handOffAsync(start: InstallerStart, installer: string): Promise<number> {
   *   return start.startAsync(installer);
   * }
   * ```
   */
  public startAsync(installer: string): Promise<number>;
}

/**
 * The process that installs a macOS update: Squirrel.Mac's ShipIt, which runs as the launchd job
 * `<bundle identifier>.ShipIt` from the moment Squirrel has staged the update, keeps its process id until it has
 * installed it, and installs it once the main process has quit. It runs in the person's launchd domain, read from
 * `launchctl list`, or, for a copy the person cannot write, such as one a `.pkg` installed, as root in the system
 * domain, read from `launchctl print system/<bundle identifier>.ShipIt`. A staged update installs at any quit, so a
 * handoff that fails after staging removes the person's job; a system-domain job stays and installs at the next quit.
 */
export declare class ShipItProcess implements IShipItProcess {
  /**
   * Creates the lookup of the ShipIt job of an application.
   *
   * @param bundleIdentifier The application's bundle identifier, which names the job.
   * @param command Runs `/bin/launchctl`.
   * @example
   * ```ts
   * import { ShipItProcess } from "@noldova/desktop.electron";
   * import { SystemCommand } from "@noldova/desktop.runtime";
   *
   * export const shipIt: ShipItProcess = new ShipItProcess("com.noldova.desktop", new SystemCommand());
   * ```
   */
  public constructor(bundleIdentifier: string, command: Pick<SystemCommand, "runAsync">);

  /**
   * Finds the ShipIt process, once Squirrel has staged the update.
   *
   * @returns The process id of the running ShipIt job, from the person's launchd domain or else the system domain, or
   * `null` when neither domain runs it.
   * @throws {UpdateHandoffException} Rejected with the reason when the person's jobs cannot be listed or the system
   * domain's job cannot be read for any reason but its absence.
   * @example
   * ```ts
   * import type { ShipItProcess } from "@noldova/desktop.electron";
   *
   * export function findAsync(shipIt: ShipItProcess): Promise<number | null> {
   *   return shipIt.findAsync();
   * }
   * ```
   */
  public findAsync(): Promise<number | null>;

  /**
   * Removes the ShipIt job from the person's launchd domain, which ends a ShipIt that is still waiting there, so the
   * staged update does not install when the main process quits. It does nothing when the job is not listed, and a
   * job in the system domain stays and still installs the update at the next quit.
   *
   * @returns A promise that resolves once the job is removed.
   * @throws {UpdateHandoffException} Rejected with the reason when the jobs cannot be listed or the job cannot be
   * removed.
   * @example
   * ```ts
   * import type { ShipItProcess } from "@noldova/desktop.electron";
   *
   * export function withdrawAsync(shipIt: ShipItProcess): Promise<void> {
   *   return shipIt.removeAsync();
   * }
   * ```
   */
  public removeAsync(): Promise<void>;

  /**
   * Removes the ShipIt job only when it is listed without a process: the job a finished install leaves behind. A
   * main process calls it at start, before its updater, and a running ShipIt is left alone.
   *
   * @returns A promise that resolves once a stopped job is removed, or at once when there is none.
   * @throws {UpdateHandoffException} Rejected with the reason when the jobs cannot be listed or the job cannot be
   * removed.
   * @example
   * ```ts
   * import type { ShipItProcess } from "@noldova/desktop.electron";
   *
   * export function tidyAsync(shipIt: ShipItProcess): Promise<void> {
   *   return shipIt.removeStoppedAsync();
   * }
   * ```
   */
  public removeStoppedAsync(): Promise<void>;
}

/**
 * Asks the person, while Noldova Desktop Sample quits and the runtime has work in progress, whether to wait for the work or stop it,
 * and decides from the answer and the runtime's reports of its work. Reading the work is bounded once; when it fails or
 * times out, quitting goes ahead as it would without work. Reports carry a sequence, so a report heard before an older
 * answer is handled still wins.
 */
export declare class QuitCoordinator {
  /**
   * Creates the coordinator.
   *
   * @param readWorkAsync Reads the runtime's work within its time limit, or `null` when it cannot.
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/desktop.protocol";
   * import { QuitCoordinator } from "@noldova/desktop.electron";
   *
   * export const coordinator: QuitCoordinator = new QuitCoordinator(async () => new WorkReport([], 0));
   * ```
   */
  public constructor(readWorkAsync: () => Promise<WorkReport | null>);

  /**
   * Asks in a window when the runtime has work in progress. While the question is open, the window shows the newest
   * work; quitting goes ahead once no work is left, the window can no longer show the question, or the runtime is gone.
   * A second request while one is open stays.
   *
   * @param prompt The window that asks.
   * @returns A promise of the outcome.
   * @example
   * ```ts
   * import type { IQuitPrompt, QuitCoordinator, QuitOutcome } from "@noldova/desktop.electron";
   *
   * export function askAsync(coordinator: QuitCoordinator, prompt: IQuitPrompt): Promise<QuitOutcome> {
   *   return coordinator.askAsync(prompt);
   * }
   * ```
   */
  public askAsync(prompt: IQuitPrompt): Promise<QuitOutcome>;

  /**
   * Takes a `desktop.work` event into account while a question is being prepared or is open.
   *
   * @param report The runtime's report.
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/desktop.protocol";
   * import type { QuitCoordinator } from "@noldova/desktop.electron";
   *
   * export function heard(coordinator: QuitCoordinator): void {
   *   coordinator.receive(new WorkReport([], 4));
   * }
   * ```
   */
  public receive(report: WorkReport): void;

  /**
   * Takes the person's answer from the window that shows the question.
   *
   * @param prompt The window that answered.
   * @param choice The answer, one of {@link QuitChoice}.
   * @returns Whether the answer was taken: false for another window, no open question or an unknown answer.
   * @example
   * ```ts
   * import { type IQuitPrompt, QuitChoice, type QuitCoordinator } from "@noldova/desktop.electron";
   *
   * export function wait(coordinator: QuitCoordinator, prompt: IQuitPrompt): boolean {
   *   return coordinator.answer(prompt, QuitChoice.Wait);
   * }
   * ```
   */
  public answer(prompt: IQuitPrompt, choice: unknown): boolean;

  /**
   * Takes the question away and stays, because the person closed the window that shows it; another window is ignored.
   *
   * @param prompt The window that is closing.
   * @example
   * ```ts
   * import type { IQuitPrompt, QuitCoordinator } from "@noldova/desktop.electron";
   *
   * export function closing(coordinator: QuitCoordinator, prompt: IQuitPrompt): void {
   *   coordinator.dismiss(prompt);
   * }
   * ```
   */
  public dismiss(prompt: IQuitPrompt): void;

  /**
   * Lets an open question close and quitting go ahead, because the runtime is gone.
   *
   * @example
   * ```ts
   * import type { QuitCoordinator } from "@noldova/desktop.electron";
   *
   * export function disconnected(coordinator: QuitCoordinator): void {
   *   coordinator.release();
   * }
   * ```
   */
  public release(): void;
}

/**
 * Closes windows and quits Noldova Desktop Sample. Closing the last window quits only when Noldova Desktop Sample cannot keep running without
 * windows. Quitting saves every window first, then asks the runtime to stop if it is idle unless another client uses
 * it; while work is in progress it asks the person, saves again after the answer, and then stops the work or asks the
 * runtime again to stop if it is idle. One quit runs at a time.
 */
export declare class QuitFlow implements ICloseGuard {
  /**
   * Creates the flow.
   *
   * @param host The main process's windows, runtime and application.
   * @param asker Asks the question about work in progress.
   * @example
   * ```ts
   * import { type IQuitHost, QuitCoordinator, QuitFlow } from "@noldova/desktop.electron";
   *
   * export function create(host: IQuitHost): QuitFlow {
   *   return new QuitFlow(host, new QuitCoordinator(async () => null));
   * }
   * ```
   */
  public constructor(host: IQuitHost, asker: QuitCoordinator);

  /**
   * Whether a quit is running: from {@link QuitFlow.quitAsync} until Noldova Desktop Sample exits or stays open.
   */
  public get isQuitting(): boolean;

  /**
   * See {@link ICloseGuard.canCloseAsync}. While a quit runs, closing the window that asks its question cancels the
   * quit; the window is then judged as any other once the quit has ended, and stays open when Noldova Desktop Sample exits.
   *
   * @param prompt The closing window.
   * @returns A promise of whether the window may close.
   * @example
   * ```ts
   * import type { IQuitPrompt, QuitFlow } from "@noldova/desktop.electron";
   *
   * export function mayCloseAsync(flow: QuitFlow, prompt: IQuitPrompt): Promise<boolean> {
   *   return flow.canCloseAsync(prompt);
   * }
   * ```
   */
  public canCloseAsync(prompt: IQuitPrompt): Promise<boolean>;

  /**
   * Quits Noldova Desktop Sample, or joins the quit already running.
   *
   * @returns A promise of `null` once Noldova Desktop Sample exits, or of why it stayed open: `Stayed` when the person kept it open,
   * `SaveFailed` when a window could not save.
   * @example
   * ```ts
   * import type { QuitAnswer } from "@noldova/desktop.protocol";
   * import type { QuitFlow } from "@noldova/desktop.electron";
   *
   * export function quitAsync(flow: QuitFlow): Promise<QuitAnswer | null> {
   *   return flow.quitAsync();
   * }
   * ```
   */
  public quitAsync(): Promise<QuitAnswer | null>;
}

/**
 * The process the main process runs in: its arguments, environment and platform, and how it starts another program.
 */
export interface IMainProcessEnvironment {
  /**
   * The command-line arguments, including `--data-dir=` and `--user-data-dir=`.
   */
  readonly argv: readonly string[];

  /**
   * The environment, which a started runtime inherits.
   */
  readonly env: NodeJS.ProcessEnv;

  /**
   * The operating system, as Node.js names it.
   */
  readonly platform: string;

  /**
   * The program the main process runs from, which also runs the runtime in Node mode.
   */
  readonly execPath: string;

  /**
   * The person's home folder.
   */
  readonly homeFolder: string;

  /**
   * The person's temporary folder. A development build's update restart on Windows or macOS keeps its folders there,
   * since it never takes them back.
   */
  readonly temporaryFolder: string;

  /**
   * The working directory the main process started in, against which relative path arguments resolve.
   */
  readonly workingDirectory: string;

  /**
   * Whether Electron's default app runs the main process's main script, as in every development start. A packaged build never
   * does, so this, not the program's name, tells a development start from a packaged build.
   */
  readonly isDefaultApp: boolean;

  /**
   * Standard error, which mirrors the main process's log.
   */
  readonly errorOutput: Writable;

  /**
   * The main process's own process id, which it never ends.
   */
  readonly processId: number;

  /**
   * Runs other programs for the main process, such as `gdbus` to find a Linux tray.
   */
  readonly programs: IProgramHost;

  /**
   * Reads the files a path passes through, without following a link, when a window part shows a file in its folder or
   * opens one, and lists a macOS app's install folder and renames its copy into it: Node.js's `lstat`, `readlink`,
   * `realpath`, `rename` and `readdir` from `fs/promises`.
   */
  readonly files: IMainProcessFiles;

  /**
   * Identifies processes by process id and start time, for the launch barrier and the update stop.
   */
  readonly presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">;

  /**
   * Whether standard input, output or error is a terminal, as when a person starts the main process at a shell's prompt.
   */
  readonly isTerminal: boolean;

  /**
   * Starts another program, detached, for the hand-over to a newer build.
   *
   * @param executablePath The program.
   * @param args Its arguments: the start's data directory, user data and
   * device directory arguments, so the newer build opens the same data.
   * @param onFailure Called with the reason when the program cannot be started.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function handOver(process: IMainProcessEnvironment, log: (text: string) => void): void {
   *   process.startDetached("/opt/noldova-desktop/noldova-desktop", ["--data-dir=/home/person/work-data"], t => log(String(t)));
   * }
   * ```
   */
  startDetached(executablePath: string, args: readonly string[], onFailure: (error: Error) => void): void;

  /**
   * Starts another program in its own session, detached, with its standard streams ignored: the copy of itself a
   * main process started from a terminal starts so that closing the terminal does not end it.
   *
   * @param executablePath The program.
   * @param args Its arguments.
   * @param environment Its environment.
   * @param workingDirectory The folder it starts in.
   * @returns A promise that settles once the program has started.
   * @throws LaunchException asynchronously when the program cannot be started, with the reason the system gives as
   * its cause.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function relaunchAsync(process: IMainProcessEnvironment): Promise<void> {
   *   return process.startDetachedAsync(process.execPath, process.argv.slice(1), process.env, process.workingDirectory);
   * }
   * ```
   */
  startDetachedAsync(executablePath: string, args: readonly string[], environment: NodeJS.ProcessEnv, workingDirectory: string): Promise<void>;

  /**
   * Starts another program detached through the main process's process starter, which on Windows is a utility process that
   * gives it none of the main process's handles, with its standard streams ignored: the copy of itself a main process started
   * from a console on Windows starts so that closing the console does not end it. The program starts in the main process's
   * working folder. Only after Electron is ready.
   *
   * @param executablePath The program.
   * @param args Its arguments.
   * @param environment Its environment.
   * @returns A promise that settles once the program has started.
   * @throws LaunchException asynchronously when the starter cannot start the program or ends without answering.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function relaunchAsync(process: IMainProcessEnvironment): Promise<void> {
   *   return process.startApartAsync(process.execPath, process.argv.slice(1), { ...process.env, ELECTRON_NO_ATTACH_CONSOLE: "1" });
   * }
   * ```
   */
  startApartAsync(executablePath: string, args: readonly string[], environment: NodeJS.ProcessEnv): Promise<void>;

  /**
   * Ends another process at once, for a window's page that did not stop when asked.
   *
   * @param processId The process.
   * @throws Error synchronously when the process cannot be ended, for example because it is gone.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function end(process: IMainProcessEnvironment, processId: number): void {
   *   process.endProcess(processId);
   * }
   * ```
   */
  endProcess(processId: number): void;

  /**
   * Checks that another process still runs, by sending it no signal, as Node.js's `process.kill` with signal `0` does.
   *
   * @param processId The process.
   * @throws Error synchronously with code `ESRCH` when the process is gone, or `EPERM` when it runs as another user.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function probe(process: IMainProcessEnvironment, processId: number): void {
   *   process.probeProcess(processId);
   * }
   * ```
   */
  probeProcess(processId: number): void;

  /**
   * Hears every exception the main process does not catch. A listener keeps Electron from showing its own error box,
   * which would block the main process.
   *
   * @param listener Receives the error.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function listen(process: IMainProcessEnvironment, failures: unknown[]): void {
   *   process.onUncaughtException(error => failures.push(error));
   * }
   * ```
   */
  onUncaughtException(listener: (error: unknown) => void): void;

  /**
   * Hears every rejection the main process does not handle. Electron only warns about one, so it never becomes an
   * uncaught exception.
   *
   * @param listener Receives the rejection's reason.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function listen(process: IMainProcessEnvironment, failures: unknown[]): void {
   *   process.onUnhandledRejection(reason => failures.push(reason));
   * }
   * ```
   */
  onUnhandledRejection(listener: (reason: unknown) => void): void;

  /**
   * Reads the account's home folder as the operating system records it, ignoring the environment. An update restart
   * of a packaged build on Windows or macOS leaves the stopping main process's `--data-dir=`, `--user-data-dir=` and
   * `--device-dir=` in the default device folder under it, for the new version, which starts without arguments and
   * with the account's own environment rather than the stopping main process's; a packaged main process takes them back at
   * start when they are for its version, at most 10 minutes old, and it was given none of its own.
   *
   * @returns The home folder.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export function home(process: IMainProcessEnvironment): string {
   *   return process.readAccountHomeFolder();
   * }
   * ```
   */
  readAccountHomeFolder(): string;

  /**
   * Reads the `webViews.json` declarations of the app's modules from the runtime's build, so the main process opens web views only for a
   * module that declares the file and relays only what it declares.
   *
   * @returns Each declaring module's declaration, by the module's id; it rejects when the declarations can't be read.
   * @example
   * ```ts
   * import type { IMainProcessEnvironment } from "@noldova/desktop.electron";
   *
   * export async function declaresWebViewsAsync(process: IMainProcessEnvironment, module: string): Promise<boolean> {
   *   return (await process.readWebViewsAsync()).has(module);
   * }
   * ```
   */
  readWebViewsAsync(): Promise<ReadonlyMap<string, WebViewDeclaration>>;
}

/**
 * What the main process's runtime startup needs to follow an update that another
 * main process, or this one, coordinates.
 */
export interface IUpdateHost {
  /**
   * The main process's process id, which it reports once its windows have saved.
   */
  readonly processId: number;

  /**
   * Reads the installation's launch barrier.
   *
   * @returns A promise of the barrier, or `null` when there is none.
   * @throws Error Rejected when the barrier cannot be read.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/desktop.electron";
   *
   * export async function readVersionAsync(host: IUpdateHost): Promise<string | undefined> {
   *   return (await host.readBarrierAsync())?.version;
   * }
   * ```
   */
  readBarrierAsync(): Promise<UpdateBarrier | null>;

  /**
   * Tells whether the update has ended, as {@link Installation.hasEndedAsync} does: the barrier is gone, or its holder
   * exited before the handoff.
   *
   * @returns A promise of whether the update has ended.
   * @throws Error Rejected when the barrier cannot be read or its holder cannot be looked up.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/desktop.electron";
   *
   * export function isOverAsync(host: IUpdateHost): Promise<boolean> {
   *   return host.hasUpdateEndedAsync();
   * }
   * ```
   */
  hasUpdateEndedAsync(): Promise<boolean>;

  /**
   * Asks every window to save for the update.
   *
   * @returns A promise of what did not save, empty when everything saved.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/desktop.electron";
   *
   * export async function isSavedAsync(host: IUpdateHost): Promise<boolean> {
   *   return (await host.saveAsync()).length === 0;
   * }
   * ```
   */
  saveAsync(): Promise<readonly string[]>;

  /**
   * Tells the person about the launch barrier a runtime start found, and settles it when they confirm, as
   * {@link UpdateBarrierGate.askAsync} does.
   *
   * @param status What the barrier means for this installation.
   * @returns A promise of `true` to start the runtime again, `false` when the main process quits.
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/desktop.electron";
   * import { UpdateBarrierStatus } from "@noldova/desktop.runtime";
   *
   * export function askAsync(host: IUpdateHost): Promise<boolean> {
   *   return host.passBarrierAsync(UpdateBarrierStatus.Held);
   * }
   * ```
   */
  passBarrierAsync(status: UpdateBarrierStatus): Promise<boolean>;

  /**
   * Quits the main process at once, without asking about work or saving again.
   *
   * @example
   * ```ts
   * import type { IUpdateHost } from "@noldova/desktop.electron";
   *
   * export function close(host: IUpdateHost): void {
   *   host.quit();
   * }
   * ```
   */
  quit(): void;
}

/**
 * One runtime of the installation that an update stops: its data directory,
 * its process and the update stop's connection to it as the client `update`.
 */
export interface IUpdateTarget {
  /**
   * The data directory the runtime owns.
   */
  readonly dataDirectory: string;

  /**
   * The runtime's process, by process id and start.
   */
  readonly runtime: UpdateProcess;

  /**
   * The connection to the runtime.
   */
  readonly connection: IRuntimeConnection;
}

/**
 * A connection to the runtime, as `RuntimeClient` provides it.
 */
export interface IRuntimeConnection {
  /**
   * Whether the connection is still open; `false` once it has ended, from
   * either side.
   */
  readonly isConnected: boolean;

  /**
   * Sends a request and waits for its response.
   *
   * @param method The method's qualified name.
   * @param payload The request's payload.
   * @param timeout How long to wait for the response, in milliseconds; the
   * connection's own limit by default.
   * @param signal Aborting it cancels the request.
   * @param window The window the request is sent for, by its web contents'
   * id, which a reload keeps; omit it when no window sends it.
   * @param page The serial of the window's page the request is sent for; the
   * runtime ends the page's file grants by it. Give it only with a window.
   * @returns A promise of the response, successful or failed.
   * @throws {ConnectionException} Rejected when no response arrives in time
   * or the connection ends.
   * @example
   * ```ts
   * import { ShellMethods, WindowStateKey, type Response } from "@noldova/desktop.protocol";
   * import type { IRuntimeConnection } from "@noldova/desktop.electron";
   *
   * export function readBoundsAsync(connection: IRuntimeConnection): Promise<Response> {
   *   return connection.callAsync(ShellMethods.readWindowBounds, new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main").toJson());
   * }
   * ```
   */
  callAsync(method: QualifiedName, payload: JsonValue, timeout?: number, signal?: AbortSignal, window?: number, page?: number): Promise<Response>;

  /**
   * Closes the connection.
   *
   * @example
   * ```ts
   * import type { IRuntimeConnection } from "@noldova/desktop.electron";
   *
   * export function disconnect(connection: IRuntimeConnection): void {
   *   connection.close();
   * }
   * ```
   */
  close(): void;
}

/**
 * The displays' work areas, as Electron's `screen` provides them.
 */
export interface IDisplayHost {
  /**
   * Lists the displays.
   *
   * @returns Each display, with its work area in screen pixels.
   * @example
   * ```ts
   * import type { IDisplayHost } from "@noldova/desktop.electron";
   *
   * export function countDisplays(displays: IDisplayHost): number {
   *   return displays.getAllDisplays().length;
   * }
   * ```
   */
  getAllDisplays(): readonly { readonly workArea: Rectangle }[];

  /**
   * Finds the primary display, where a window without a position opens.
   *
   * @returns The primary display, with its work area in screen pixels.
   * @example
   * ```ts
   * import type { IDisplayHost } from "@noldova/desktop.electron";
   *
   * export function primaryWidth(displays: IDisplayHost): number {
   *   return displays.getPrimaryDisplay().workArea.width;
   * }
   * ```
   */
  getPrimaryDisplay(): { readonly workArea: Rectangle };
}

/**
 * Keeps one window's state in a place that outlives the window.
 */
export interface IWindowStateStore {
  /**
   * Reads the kept state.
   *
   * @returns A promise of the state, or `null` when none is kept.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import type { IWindowStateStore } from "@noldova/desktop.electron";
   *
   * export function readAsync(store: IWindowStateStore): Promise<JsonObject | null> {
   *   return store.readAsync();
   * }
   * ```
   */
  readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps a new state.
   *
   * @param value The state.
   * @returns A promise that settles once the state is kept.
   * @example
   * ```ts
   * import type { IWindowStateStore } from "@noldova/desktop.electron";
   *
   * export function keepAsync(store: IWindowStateStore): Promise<void> {
   *   return store.writeAsync({ width: 1280, height: 800 });
   * }
   * ```
   */
  writeAsync(value: JsonObject): Promise<void>;
}

/**
 * Starts or attaches to the runtime of a data directory, as `RuntimeLauncher` does.
 */
export interface IRuntimeLauncher {
  /**
   * Connects to the data directory's runtime of this build, starting one when none runs.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress.
   * @param options Whether to start a runtime when none runs and whether to take over another build's runtime; both
   * by default.
   * @returns A promise of the connection.
   * @throws RuntimeHandoverException, PreShellDataFoundException, WorkInProgressException, LaunchException, ConnectionException
   * or, when it may not start one, NoRuntimeException as a rejection, as `RuntimeLauncher.attachAsync` does.
   * @example
   * ```ts
   * import type { IRuntimeConnection, IRuntimeLauncher } from "@noldova/desktop.electron";
   *
   * export function attachAsync(launcher: IRuntimeLauncher): Promise<IRuntimeConnection> {
   *   return launcher.attachAsync("mainProcess", { onEvent: () => undefined, onDisconnected: () => undefined });
   * }
   * ```
   */
  attachAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy, options?: AttachOptions): Promise<IRuntimeConnection>;

  /**
   * Moves data from before the shell aside, then connects as {@link attachAsync} does.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress.
   * @returns A promise of the connection, once the data is moved aside.
   * @throws The rejections of {@link attachAsync}, except PreShellDataFoundException.
   * @example
   * ```ts
   * import type { IRuntimeConnection, IRuntimeLauncher } from "@noldova/desktop.electron";
   *
   * export function moveAsideAsync(launcher: IRuntimeLauncher): Promise<IRuntimeConnection> {
   *   return launcher.moveAsideAsync("mainProcess", { onEvent: () => undefined, onDisconnected: () => undefined });
   * }
   * ```
   */
  moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<IRuntimeConnection>;
}

/**
 * An event whose default action a listener can cancel.
 */
export interface IPreventableEvent {
  /**
   * Cancels the event's default action.
   *
   * @example
   * ```ts
   * import type { IPreventableEvent } from "@noldova/desktop.electron";
   *
   * export function refuse(event: IPreventableEvent): void {
   *   event.preventDefault();
   * }
   * ```
   */
  preventDefault(): void;
}

/**
 * A frame about to navigate, as Electron's `will-frame-navigate` event describes it, which a listener may cancel.
 */
export interface IFrameNavigation extends IPreventableEvent {
  /**
   * The address the frame navigates to.
   */
  readonly url: string;

  /**
   * Whether the page's own frame navigates, rather than one of its frames.
   */
  readonly isMainFrame: boolean;

  /**
   * The frame that navigates, or `null` once it is gone.
   */
  readonly frame: IWebViewFrame | null;

  /**
   * The frame that started the navigation, such as the frame itself or its parent, or `null` when no frame did.
   */
  readonly initiator?: IWebViewFrame | null;
}

/**
 * A frame of a web view's page, as Electron's `WebFrameMain` gives it.
 */
export interface IWebViewFrame {
  /**
   * The frame's id, which stays the same across its navigations for as long as the frame exists in the view and is never used again.
   */
  readonly frameTreeNodeId: number;

  /**
   * Runs code in the frame's page, as the host does to send a frame to its refused page.
   *
   * @param code - The code to run.
   * @returns The code's result; rejects when the frame has gone or changed process.
   *
   * @example
   * ```ts
   * import type { IWebViewFrame } from "@noldova/desktop.electron";
   *
   * export async function readTitleAsync(frame: IWebViewFrame): Promise<unknown> {
   *   return await frame.executeJavaScript("document.title");
   * }
   * ```
   */
  executeJavaScript(code: string): Promise<unknown>;
}

/**
 * The frame an IPC message came from.
 */
export interface ISenderFrame {
  /**
   * The frame's current URL.
   */
  readonly url: string;

  /**
   * The frame's parent; `null` for a top-level frame.
   */
  readonly parent: unknown;
}

/**
 * An IPC message's origin: the web contents and the frame that sent it.
 */
export interface IIpcEvent {
  /**
   * The sending web contents and its id.
   */
  readonly sender: { readonly id: number };

  /**
   * The sending frame; `null` when it is gone.
   */
  readonly senderFrame: ISenderFrame | null;

  /**
   * The answer to a synchronous message, which the sender waits for.
   */
  returnValue?: unknown;
}

/**
 * The main process's side of IPC, as Electron's `ipcMain` provides it.
 */
export interface IIpcHost {
  /**
   * Listens for messages sent on a channel.
   *
   * @param channel The channel's name.
   * @param listener Receives the message's origin and values.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IIpcHost } from "@noldova/desktop.electron";
   *
   * export function listen(ipc: IIpcHost, received: unknown[]): void {
   *   ipc.on("desktop:ready", (_event, appearance) => received.push(appearance));
   * }
   * ```
   */
  on(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => void): unknown;

  /**
   * Answers invocations on a channel.
   *
   * @param channel The channel's name.
   * @param listener Receives the invocation's origin and values and returns its answer.
   * @example
   * ```ts
   * import type { IIpcHost } from "@noldova/desktop.electron";
   *
   * export function answer(ipc: IIpcHost): void {
   *   ipc.handle("desktop:closeAnswer", () => false);
   * }
   * ```
   */
  handle(channel: string, listener: (event: IIpcEvent, ...values: unknown[]) => unknown): void;
}

/**
 * The application's lifecycle, as Electron's `app` provides it.
 */
export interface IApplicationHost {
  /**
   * Whether this is a packaged build rather than a development run from a checkout.
   */
  readonly isPackaged: boolean;

  /**
   * The macOS Dock's entry for the application, absent on other systems.
   */
  readonly dock: IDockHost | undefined;

  /**
   * Chromium's command line, whose switches take effect only before the application is ready.
   */
  readonly commandLine: ICommandLineHost;

  /**
   * Sets the application's name.
   *
   * @param name The name.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function name(app: IApplicationHost): void {
   *   app.setName("Noldova Desktop Sample");
   * }
   * ```
   */
  setName(name: string): void;

  /**
   * Sets the application user model id that Windows groups the application's windows and notifications by.
   *
   * @param id The id.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function identify(app: IApplicationHost): void {
   *   app.setAppUserModelId("com.noldova.desktop");
   * }
   * ```
   */
  setAppUserModelId(id: string): void;

  /**
   * Sets the name of the `.desktop` file the application belongs to on Linux. Electron derives its windows' `WM_CLASS`
   * from it, and main process portals identify the application by it, so it is set before the application is ready.
   *
   * @param name The file's name, the application's id followed by `.desktop`.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function identify(app: IApplicationHost): void {
   *   app.setDesktopName("org.example.app.desktop");
   * }
   * ```
   */
  setDesktopName(name: string): void;

  /**
   * Sets where Electron keeps the application's own data, its caches and Chromium storage.
   *
   * @param name The path's name; the main process sets only `userData`.
   * @param path The folder.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function keepProfile(app: IApplicationHost): void {
   *   app.setPath("userData", "/home/person/.noldova/desktop/mainProcess");
   * }
   * ```
   */
  setPath(name: "userData", path: string): void;

  /**
   * Reads where a system folder is.
   *
   * @param name The folder's name; the main process reads only `downloads`, where a module's save dialog starts.
   * @returns The folder's path.
   * @throws When the system has no such folder.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function downloads(app: IApplicationHost): string {
   *   return app.getPath("downloads");
   * }
   * ```
   */
  getPath(name: "downloads"): string;

  /**
   * Claims the single-instance lock.
   *
   * @returns `true` when this instance holds the lock; `false` when another instance runs.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function isFirst(app: IApplicationHost): boolean {
   *   return app.requestSingleInstanceLock();
   * }
   * ```
   */
  requestSingleInstanceLock(): boolean;

  /**
   * Gives up the single-instance lock, so that the copy a main process started from a terminal starts of itself can claim
   * it.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function release(app: IApplicationHost): void {
   *   app.releaseSingleInstanceLock();
   * }
   * ```
   */
  releaseSingleInstanceLock(): void;

  /**
   * Lists the operating system's preferred languages, most preferred first.
   *
   * @returns Language tags such as `en-US` or `de`.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function firstLanguage(app: IApplicationHost): string | undefined {
   *   return app.getPreferredSystemLanguages()[0];
   * }
   * ```
   */
  getPreferredSystemLanguages(): string[];

  /**
   * Tells whether the application runs from an Applications folder, which only macOS has.
   *
   * @returns `true` when it does.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function mustMove(app: IApplicationHost): boolean {
   *   return !app.isInApplicationsFolder();
   * }
   * ```
   */
  isInApplicationsFolder(): boolean;

  /**
   * Runs every renderer in the sandbox.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function sandbox(app: IApplicationHost): void {
   *   app.enableSandbox();
   * }
   * ```
   */
  enableSandbox(): void;

  /**
   * Quits the application.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function stop(app: IApplicationHost): void {
   *   app.quit();
   * }
   * ```
   */
  quit(): void;

  /**
   * Starts the application again once this instance exits, with the same command line.
   *
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function restart(app: IApplicationHost): void {
   *   app.relaunch();
   *   app.exit(0);
   * }
   * ```
   *
   * @param options Another program to start, with its own arguments; by default this one, with the same command line.
   */
  relaunch(options?: { execPath: string, args: string[] }): void;

  /**
   * Exits at once, without closing the windows or asking them first.
   *
   * @param exitCode The process's exit code.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function end(app: IApplicationHost): void {
   *   app.exit(0);
   * }
   * ```
   */
  exit(exitCode: number): void;

  /**
   * Waits until the application is ready to create windows.
   *
   * @returns A promise that settles when the application is ready.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export async function waitAsync(app: IApplicationHost): Promise<void> {
   *   await app.whenReady();
   * }
   * ```
   */
  whenReady(): Promise<unknown>;

  /**
   * Listens for a lifecycle event: another instance starting, the last window closing, the application being
   * activated or about to quit.
   *
   * @param event The event's name.
   * @param listener Called on each occurrence.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function quitWithLastWindow(app: IApplicationHost): void {
   *   app.on("window-all-closed", () => app.quit());
   * }
   * ```
   */
  on(event: "second-instance", listener: () => void): unknown;

  /**
   * Listens for the last window closing.
   *
   * @param event The event's name.
   * @param listener Called each time the last window closes.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "window-all-closed", listener: () => void): unknown;

  /**
   * Listens for the application being activated, as macOS does when its Dock icon is clicked.
   *
   * @param event The event's name.
   * @param listener Called on each activation.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "activate", listener: () => void): unknown;

  /**
   * Listens for the application being about to quit, after its windows have closed.
   *
   * @param event The event's name.
   * @param listener Called once the application is about to quit.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "will-quit", listener: () => void): unknown;

  /**
   * Listens for a request to quit, before any window closes; preventing the event keeps the application running.
   *
   * @param event The event's name.
   * @param listener Called with the event each time the application is asked to quit.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "before-quit", listener: (event: IPreventableEvent) => void): unknown;

  /**
   * Listens for each web contents the application creates, its windows', its
   * web views' and any other, before it loads anything.
   *
   * @param event The event's name.
   * @param listener Called with Electron's event and the new web contents.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "web-contents-created", listener: (event: unknown, contents: IDeviceChooserContents) => void): unknown;
}

/**
 * The part of a web contents that asks the main process to choose a device
 * for a page, as Electron's `WebContents` provides it.
 */
export interface IDeviceChooserContents {
  /**
   * Listens for a page's request for a Bluetooth device. A listener that
   * prevents the event chooses the device itself through `choose`, and an
   * empty id cancels the request.
   *
   * @param event The event's name.
   * @param listener Called with the event, the devices found so far and the
   * function that answers the request.
   * @returns Electron's own return value, which the main process does not use.
   *
   * @example
   * ```ts
   * import type { IDeviceChooserContents } from "@noldova/desktop.electron";
   *
   * export function refuse(contents: IDeviceChooserContents): void {
   *   contents.on("select-bluetooth-device", (event, _devices, choose) => {
   *     event.preventDefault();
   *     choose("");
   *   });
   * }
   * ```
   */
  on(event: "select-bluetooth-device", listener: (event: IPreventableEvent, devices: readonly unknown[], choose: (deviceId: string) => void) => void): unknown;
}

/**
 * Chromium's command line, as Electron's `app.commandLine` provides it.
 */
export interface ICommandLineHost {
  /**
   * Adds a switch to Chromium's command line, before the application is ready.
   *
   * @param name The switch's name, without its leading dashes.
   * @param value The switch's value, if it takes one.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function enablePortal(app: IApplicationHost): void {
   *   app.commandLine.appendSwitch("enable-features", "GlobalShortcutsPortalPreferredTrigger");
   * }
   * ```
   */
  appendSwitch(name: string, value?: string): void;

  /**
   * Reads a switch's value from Chromium's command line, such as one the person started the application with.
   *
   * @param name The switch's name, without its leading dashes.
   * @returns The switch's value, or an empty string when the switch is absent or has none.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function readFeatures(app: IApplicationHost): string {
   *   return app.commandLine.getSwitchValue("enable-features");
   * }
   * ```
   */
  getSwitchValue(name: string): string;
}

/**
 * The macOS Dock's entry for the application, as Electron's `app.dock` provides it.
 */
export interface IDockHost {
  /**
   * Shows an image as the application's icon in the Dock.
   *
   * @param iconPath The image's absolute path.
   * @example
   * ```ts
   * import type { IApplicationHost } from "@noldova/desktop.electron";
   *
   * export function showIcon(app: IApplicationHost, iconPath: string): void {
   *   app.dock?.setIcon(iconPath);
   * }
   * ```
   */
  setIcon(iconPath: string): void;
}

/**
 * Decides the permissions web contents ask for, as an Electron session provides it.
 */
export interface IPermissionHost {
  /**
   * Answers permission requests.
   *
   * @param handler Receives each request and grants or denies it through its callback.
   * @example
   * ```ts
   * import type { IPermissionHost } from "@noldova/desktop.electron";
   *
   * export function denyRequests(host: IPermissionHost): void {
   *   host.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
   * }
   * ```
   */
  setPermissionRequestHandler(handler: (contents: unknown, permission: string, callback: (isGranted: boolean) => void) => void): void;

  /**
   * Answers permission checks.
   *
   * @param handler Returns whether a permission is granted.
   * @example
   * ```ts
   * import type { IPermissionHost } from "@noldova/desktop.electron";
   *
   * export function denyChecks(host: IPermissionHost): void {
   *   host.setPermissionCheckHandler(() => false);
   * }
   * ```
   */
  setPermissionCheckHandler(handler: () => boolean): void;
}

/**
 * Turns spell checking on and off and chooses its dictionaries, as an Electron session provides it.
 */
export interface ISpellCheckHost {
  /**
   * Turns spell checking on or off for every window of the session.
   *
   * @param isEnabled Whether misspelled words are marked.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/desktop.electron";
   *
   * export function stopChecking(host: ISpellCheckHost): void {
   *   host.setSpellCheckerEnabled(false);
   * }
   * ```
   */
  setSpellCheckerEnabled(isEnabled: boolean): void;

  /**
   * Chooses the languages words are checked in. macOS ignores it, because its system checker chooses.
   *
   * @param languages Language tags whose dictionaries the session has, such as `en-US`.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/desktop.electron";
   *
   * export function checkInEnglish(host: ISpellCheckHost): void {
   *   host.setSpellCheckerLanguages(["en-US"]);
   * }
   * ```
   */
  setSpellCheckerLanguages(languages: string[]): void;

  /**
   * Sets the address a dictionary that is not in the profile's `Dictionaries` folder would be downloaded from.
   *
   * @param url The address, ending in `/`.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/desktop.electron";
   *
   * export function downloadNothing(host: ISpellCheckHost): void {
   *   host.setSpellCheckerDictionaryDownloadURL("file:///home/person/.noldova-desktop/mainProcess/Dictionaries/");
   * }
   * ```
   */
  setSpellCheckerDictionaryDownloadURL(url: string): void;

  /**
   * Adds a word to the session's dictionary, so it is no longer marked. On Linux that dictionary is the profile's own
   * file; with the Windows or macOS system checker it is the system's user dictionary, which other applications share.
   *
   * @param word The word to add.
   * @returns Whether the session took the word.
   * @example
   * ```ts
   * import type { ISpellCheckHost } from "@noldova/desktop.electron";
   *
   * export function learn(host: ISpellCheckHost): boolean {
   *   return host.addWordToSpellCheckerDictionary("Noldova Desktop Sample");
   * }
   * ```
   */
  addWordToSpellCheckerDictionary(word: string): boolean;
}

/**
 * A session's `protocol`, as far as the main process serves its own scheme on it.
 */
export interface IProtocolHost {
  /**
   * Serves a scheme on the session.
   *
   * @param scheme The scheme, without its colon.
   * @param handler Answers each request for an address on the scheme.
   * @example
   * ```ts
   * import type { IProtocolHost } from "@noldova/desktop.electron";
   *
   * export function serve(protocol: IProtocolHost): void {
   *   protocol.handle("desktop-file", () => Promise.resolve(new globalThis.Response(null, { status: 404 })));
   * }
   * ```
   */
  handle(scheme: string, handler: (request: Request) => Promise<globalThis.Response>): void;

  /**
   * Tells whether the session already serves a scheme.
   *
   * @param scheme The scheme, without its colon.
   * @returns Whether a handler serves it.
   * @example
   * ```ts
   * import type { IProtocolHost } from "@noldova/desktop.electron";
   *
   * export function isServed(protocol: IProtocolHost): boolean {
   *   return protocol.isProtocolHandled("desktop-file");
   * }
   * ```
   */
  isProtocolHandled(scheme: string): boolean;
}

/**
 * The session a window's web contents use, as far as the main process serves its own scheme on it.
 */
export interface IWindowSession {
  /**
   * The session's protocol.
   */
  readonly protocol: IProtocolHost;
}

/**
 * Electron's `protocol` module, as far as the main process registers its own scheme before the app is ready.
 */
export interface ISchemeRegistry {
  /**
   * Registers schemes with their privileges; Electron takes this only before the app is ready.
   *
   * @param schemes The schemes.
   * @example
   * ```ts
   * import type { ISchemeRegistry } from "@noldova/desktop.electron";
   *
   * export function register(registry: ISchemeRegistry): void {
   *   registry.registerSchemesAsPrivileged([{ scheme: "desktop-file", privileges: { standard: true, secure: true } }]);
   * }
   * ```
   */
  registerSchemesAsPrivileged(schemes: CustomScheme[]): void;
}

/**
 * Electron's `safeStorage`, which encrypts the runtime's secrets with the system's keyring: the Keychain on macOS, DPAPI
 * on Windows, and the Secret Service or KWallet on Linux. The main process refuses to encrypt or decrypt while it is not
 * available, or on Linux while it falls back to its own text key.
 */
export interface ISecretStorageHost {
  /**
   * Whether encryption is available; on Linux, whether a key is available at all, which may be the fallback text key.
   *
   * @returns Whether encryption is available.
   * @example
   * ```ts
   * import type { ISecretStorageHost } from "@noldova/desktop.electron";
   *
   * export function canProtect(storage: ISecretStorageHost): boolean {
   *   return storage.isEncryptionAvailable();
   * }
   * ```
   */
  isEncryptionAvailable(): boolean;

  /**
   * The Linux keyring in use, such as `gnome_libsecret`, `kwallet6`, `basic_text` for the fallback text key, or
   * `unknown` before the app is ready.
   *
   * @returns The keyring's name.
   * @example
   * ```ts
   * import type { ISecretStorageHost } from "@noldova/desktop.electron";
   *
   * export function hasKeyring(storage: ISecretStorageHost): boolean {
   *   return !["basic_text", "unknown"].includes(storage.getSelectedStorageBackend());
   * }
   * ```
   */
  getSelectedStorageBackend(): string;

  /**
   * Encrypts text.
   *
   * @param plainText The text.
   * @returns The encrypted bytes.
   * @throws Error when encryption fails.
   * @example
   * ```ts
   * import type { ISecretStorageHost } from "@noldova/desktop.electron";
   *
   * export function seal(storage: ISecretStorageHost, text: string): string {
   *   return storage.encryptString(text).toString("base64");
   * }
   * ```
   */
  encryptString(plainText: string): Buffer;

  /**
   * Decrypts bytes `encryptString` returned on this machine.
   *
   * @param encrypted The encrypted bytes.
   * @returns The text.
   * @throws Error when the bytes can't be decrypted.
   * @example
   * ```ts
   * import type { ISecretStorageHost } from "@noldova/desktop.electron";
   *
   * export function open(storage: ISecretStorageHost, sealed: string): string {
   *   return storage.decryptString(Buffer.from(sealed, "base64"));
   * }
   * ```
   */
  decryptString(encrypted: Buffer): string;
}

/**
 * Electron's `session` module, as far as the main process uses it.
 */
export interface ISessionHost {
  /**
   * The session the window's web contents use.
   */
  readonly defaultSession: IPermissionHost & ISpellCheckHost;
}

/**
 * Builds and sets the application menu, as Electron's `Menu` provides it.
 */
export interface IMenuHost {
  /**
   * Builds a menu from its items.
   *
   * @param template The menu's items.
   * @returns The menu.
   * @example
   * ```ts
   * import type { IMenuHost } from "@noldova/desktop.electron";
   *
   * export function buildEditMenu(host: IMenuHost): unknown {
   *   return host.buildFromTemplate([{ role: "editMenu" }]);
   * }
   * ```
   */
  buildFromTemplate(template: MenuItemConstructorOptions[]): unknown;

  /**
   * Sets the application menu.
   *
   * @param menu A menu from `buildFromTemplate`, or `null` for none.
   * @example
   * ```ts
   * import type { IMenuHost } from "@noldova/desktop.electron";
   *
   * export function removeMenu(host: IMenuHost): void {
   *   host.setApplicationMenu(null);
   * }
   * ```
   */
  setApplicationMenu(menu: unknown): void;
}

/**
 * Writes to the system clipboard, as Electron's `clipboard` provides it.
 */
export interface IClipboardHost {
  /**
   * Replaces the clipboard's contents with plain text.
   *
   * @param text The text to copy.
   * @example
   * ```ts
   * import type { IClipboardHost } from "@noldova/desktop.electron";
   *
   * export function copyVersion(host: IClipboardHost, version: string): void {
   *   host.writeText(`Noldova Desktop Sample ${version}`);
   * }
   * ```
   */
  writeText(text: string): void;

  /**
   * Replaces the clipboard's contents with a PNG image: checks that the bytes
   * decode with Electron's `nativeImage.createFromBuffer`, and writes the same
   * bytes as PNG with `clipboard.write`, without encoding them again.
   *
   * @param bytes The bytes of a PNG image; the main process passes only an
   * image of at most 16384 pixels a side and 50 million in all, as its header
   * declares.
   * @returns A promise of whether the bytes decoded to an image, which was
   * then copied; when they don't, the clipboard stays as it was. It rejects
   * when the clipboard refuses the write.
   * @example
   * ```ts
   * import type { IClipboardHost } from "@noldova/desktop.electron";
   *
   * export function copyLogoAsync(host: IClipboardHost, png: Uint8Array): Promise<boolean> {
   *   return host.writeImageAsync(png);
   * }
   * ```
   */
  writeImageAsync(bytes: Uint8Array): Promise<boolean>;
}

/**
 * Opens files, folders and links in the system's own application, as Electron's `shell` provides it.
 */
export interface IShellHost {
  /**
   * Opens a file or folder, such as a folder in the system's file manager.
   *
   * @param path The absolute path to open.
   * @returns An empty string once it opens, or the system's reason it could not.
   * @example
   * ```ts
   * import type { IShellHost } from "@noldova/desktop.electron";
   *
   * export async function openFolderAsync(host: IShellHost, folder: string): Promise<boolean> {
   *   return (await host.openPath(folder)).length === 0;
   * }
   * ```
   */
  openPath(path: string): Promise<string>;

  /**
   * Opens a link in the system's own application, such as a web page in the browser.
   *
   * @param url The link to open, one that `LinkPolicy.findAllowed` allowed.
   * @returns A promise that settles once the system has taken the link.
   * @throws Error asynchronously when the system cannot open it.
   * @example
   * ```ts
   * import type { IShellHost } from "@noldova/desktop.electron";
   *
   * export async function openDocsAsync(host: IShellHost): Promise<void> {
   *   await host.openExternal("https://example.com/docs");
   * }
   * ```
   */
  openExternal(url: string): Promise<void>;

  /**
   * Shows a file or a folder, selected in its parent folder, in the system's
   * file manager, without opening it.
   *
   * @param fullPath The file's or folder's absolute path, one the main process
   * checked is an existing regular file or folder, with no link left in it.
   * @example
   * ```ts
   * import type { IShellHost } from "@noldova/desktop.electron";
   *
   * export function showReport(host: IShellHost, report: string): void {
   *   host.showItemInFolder(report);
   * }
   * ```
   */
  showItemInFolder(fullPath: string): void;

  /**
   * Moves a file or a folder to the system's trash, from where the person can put it back.
   *
   * @param path The file's or folder's absolute path.
   * @returns A promise that settles once it is in the trash.
   * @throws Error asynchronously when the system cannot move it there.
   * @example
   * ```ts
   * import type { IShellHost } from "@noldova/desktop.electron";
   *
   * export async function discardAsync(host: IShellHost, copy: string): Promise<void> {
   *   await host.trashItem(copy);
   * }
   * ```
   */
  trashItem(path: string): Promise<void>;
}

/**
 * What Electron reports about a right click or a context menu key in a page, as far as the main process uses it.
 */
export interface IContextMenuParams {
  /**
   * The horizontal position of the menu in the page, in CSS pixels.
   */
  readonly x: number;

  /**
   * The vertical position of the menu in the page, in CSS pixels.
   */
  readonly y: number;

  /**
   * The misspelled word under the menu, or empty when there is none.
   */
  readonly misspelledWord: string;

  /**
   * The spell checker's suggestions for the misspelled word, best first.
   */
  readonly dictionarySuggestions: string[];

  /**
   * What asked for the menu, such as `mouse` or `keyboard`.
   */
  readonly menuSourceType: string;
}

/**
 * Gives the web views of a window's module panes their profiles and pages, as Electron's sessions and `<webview>` guests provide them.
 */
export interface IWebViewEngine {
  /**
   * Reads a profile's session, persistent and without an HTTP cache, so every response comes from the network.
   *
   * @param partition The profile's partition, `persist:<module>.<profile key>`.
   * @returns The session; reading the same partition again returns the same profile.
   * @example
   * ```ts
   * import type { IWebViewEngine, IWebViewSession } from "@noldova/desktop.electron";
   *
   * export function profile(engine: IWebViewEngine): IWebViewSession {
   *   return engine.readSession("persist:browser.workspace-1");
   * }
   * ```
   */
  readSession(partition: string): IWebViewSession;

  /**
   * Finds the page of a `<webview>` a window holds, for the window to attach it to one of its views.
   *
   * @param contentsId The id of the page's web contents, which the `<webview>` element reports once attached.
   * @returns The page with the id of the window that holds it and the partition of its profile, or null when no live `<webview>` page has that id.
   * @example
   * ```ts
   * import type { IWebViewEngine } from "@noldova/desktop.electron";
   *
   * export function isHeldBy(engine: IWebViewEngine, contentsId: number, windowId: number): boolean {
   *   return engine.findGuest(contentsId)?.hostId === windowId;
   * }
   * ```
   */
  findGuest(contentsId: number): IWebViewGuest | null;

  /**
   * Judges every `<webview>` before it attaches: a page's own is refused, and a window's only when its partition is one the window may use; an allowed one starts at `about:blank`, whatever address the element carries, such as the page's own once the element moves in the window, unless `claim` takes it, and runs sandboxed and context-isolated, without a preload, Node.js or nested views.
   * A claimed one loads no page, so the view it replaces can restore its history in it, and `attached` gets its page once it attaches.
   *
   * @param isAllowed Says whether a window may use a partition.
   * @param log Writes a line to the main process's log for each refused `<webview>`.
   * @param claim Says whether a view of the window with that partition takes the allowed `<webview>` to restore its page in; none does when omitted.
   * @param attached Gets the page of each allowed `<webview>` of a window as it attaches, right after `claim` judged it.
   * @example
   * ```ts
   * import type { IWebViewEngine } from "@noldova/desktop.electron";
   *
   * export function allowOne(engine: IWebViewEngine, windowId: number): void {
   *   engine.watchAttach((window, partition) => window === windowId && partition === "persist:browser.workspace-1", console.log);
   * }
   * ```
   */
  watchAttach(isAllowed: (windowId: number, partition: string) => boolean, log: (text: string) => void,
    claim?: (windowId: number, partition: string) => boolean, attached?: (windowId: number, contents: IWebViewContents) => void): void;

  /**
   * Reads a clock that only moves forward, for how long ago a view last had the person's input.
   *
   * @returns The time in milliseconds since a fixed point.
   * @example
   * ```ts
   * import type { IWebViewEngine } from "@noldova/desktop.electron";
   *
   * export function since(engine: IWebViewEngine, start: number): number {
   *   return engine.now() - start;
   * }
   * ```
   */
  now(): number;

  /**
   * Waits on the same clock, for how long a view's call or search may take.
   *
   * @param milliseconds How long to wait.
   * @param signal Ends the wait early.
   * @returns A promise that resolves once the time has passed, and rejects when the signal aborts first.
   * @example
   * ```ts
   * import type { IWebViewEngine } from "@noldova/desktop.electron";
   *
   * export function waitASecondAsync(engine: IWebViewEngine, signal: AbortSignal): Promise<void> {
   *   return engine.waitAsync(1000, signal);
   * }
   * ```
   */
  waitAsync(milliseconds: number, signal: AbortSignal): Promise<void>;
}

/**
 * A script a page's isolated world runs, as Electron's `executeJavaScriptInIsolatedWorld` takes it.
 */
export interface IIsolatedScript {
  /**
   * The script's source.
   */
  readonly code: string;
}

/**
 * How `findInPage` searches, as Electron's `findInPage` takes it.
 */
export interface IFindInPageOptions {
  /**
   * Whether it searches forward.
   */
  readonly forward: boolean;

  /**
   * Whether it goes on with the current search, or starts a new one when `false`.
   */
  readonly findNext: boolean;

  /**
   * Whether capitals and small letters differ.
   */
  readonly matchCase: boolean;
}

/**
 * A search's result, as Electron's `found-in-page` event carries it.
 */
export interface IFoundInPageResult {
  /**
   * The id `findInPage` returned for the search.
   */
  readonly requestId: number;

  /**
   * The position of the active match, from 1.
   */
  readonly activeMatchOrdinal: number;

  /**
   * How many matches the page has.
   */
  readonly matches: number;

  /**
   * Whether this is the search's last update.
   */
  readonly finalUpdate: boolean;
}

/**
 * A request for credentials, as Electron's `login` event carries it.
 */
export interface ILoginDetails {
  /**
   * The address that asks for them.
   */
  readonly url: string;
}

/**
 * A page's request for a new window, as Electron's window open handler receives it.
 */
export interface IWindowOpenDetails {
  /**
   * The address the page asked to open, resolved against the page.
   */
  readonly url: string;

  /**
   * The referrer the engine would send with it; its address is empty when the page sends none.
   */
  readonly referrer: { readonly url: string };

  /**
   * How the engine would open it: `default`, `foreground-tab`, `background-tab`, `new-window` or `other`.
   * Electron always gives it; without it, the request's event carries none.
   */
  readonly disposition?: string;
}

/**
 * An input event that reached a web view's page, as Electron's `input-event` reports it.
 */
export interface IWebViewInputEvent {
  /**
   * The event's type, such as `rawKeyDown`, `mouseDown` or `touchStart`.
   */
  readonly type: string;

  /**
   * A key event's key, as the DOM's `KeyboardEvent.key` names it, such as `a`, `Escape` or `Shift`; other events have none.
   */
  readonly key?: string;
}

/**
 * A key event sent straight to a web view's page, as Electron's `sendInputEvent` takes it.
 */
export interface IWebViewKeyEvent {
  /**
   * The event's type: a key going down, the character it types, or the key coming up.
   */
  readonly type: "keyDown" | "char" | "keyUp";

  /**
   * The key as an accelerator key code, such as `a`, `Enter` or `Left`, or the character a `char` event types.
   */
  readonly keyCode: string;

  /**
   * The keys held with it and its flags, such as `shift`, `control` or `isautorepeat`, as Electron names them.
   */
  readonly modifiers: readonly NonNullable<KeyboardInputEvent["modifiers"]>[number][];
}

/**
 * A page's history, as a `<webview>` page restores it on a page that hasn't loaded yet: each entry's address, title and Chromium page state, with its form values and scroll position.
 */
export declare class WebViewHistory {
  /**
   * The entries, oldest first, copied from those the history was given.
   */
  public readonly entries: readonly NavigationEntry[];
  /**
   * The current entry's index.
   */
  public readonly index: number;

  /**
   * Creates the history.
   *
   * @param entries The entries, oldest first; the history keeps its own copy.
   * @param index The current entry's index.
   * @example
   * ```ts
   * import { WebViewHistory } from "@noldova/desktop.electron";
   *
   * export const history: WebViewHistory = new WebViewHistory([{ url: "https://example.com/", title: "Example" }], 0);
   * ```
   */
  public constructor(entries: readonly NavigationEntry[], index: number);

  /**
   * The current entry's address, or `null` when the index is outside the entries.
   */
  public get currentUrl(): string | null;
}

/**
 * A `<webview>` page a window holds, as the engine finds it.
 */
export interface IWebViewGuest {
  /**
   * The page.
   */
  readonly contents: IWebViewContents;

  /**
   * The id of the window's web contents that holds the `<webview>`, or null when none does.
   */
  readonly hostId: number | null;

  /**
   * The partition of the page's profile, or null when its session is none the engine read.
   */
  readonly partition: string | null;
}

/**
 * A web view's page, as Electron's `WebContents` provides it.
 */
export interface IWebViewContents {
  /**
   * The page's web contents id, which its requests name.
   */
  readonly id: number;

  /**
   * The page's debugger, which the relay sends its calls through.
   */
  readonly debugger: IWebViewDebugger;

  /**
   * Starts loading an address.
   *
   * @param url The address.
   * @returns A promise that settles when the load ends; a failed load also reports `did-fail-load`.
   * @example
   * ```ts
   * import type { IWebViewContents } from "@noldova/desktop.electron";
   *
   * export function load(contents: IWebViewContents): void {
   *   void contents.loadURL("https://example.com/").catch(() => undefined);
   * }
   * ```
   */
  loadURL(url: string): Promise<void>;

  /**
   * Reads the page's address.
   *
   * @returns The address, or empty text before anything loads.
   * @example
   * ```ts
   * import type { IWebViewContents } from "@noldova/desktop.electron";
   *
   * export function address(contents: IWebViewContents): string {
   *   return contents.getURL();
   * }
   * ```
   */
  getURL(): string;

  /**
   * Reads the page's title.
   *
   * @returns The title.
   */
  getTitle(): string;

  /**
   * Whether the page is loading.
   *
   * @returns True while it loads.
   */
  isLoading(): boolean;

  /**
   * Whether the page has ended.
   *
   * @returns True once it ended.
   */
  isDestroyed(): boolean;

  /**
   * Whether the history has an entry before the current one.
   *
   * @returns True when it has.
   */
  canGoBack(): boolean;

  /**
   * Whether the history has an entry after the current one.
   *
   * @returns True when it has.
   */
  canGoForward(): boolean;

  /**
   * Reads the address of a history entry, so the origin check can judge it before the page moves there.
   *
   * @param offset How far back, negative, or forward, positive, the entry is from the current one.
   * @returns The entry's address, or null when there is none.
   * @example
   * ```ts
   * import type { IWebViewContents } from "@noldova/desktop.electron";
   *
   * export function previous(contents: IWebViewContents): string | null {
   *   return contents.readHistoryEntry(-1);
   * }
   * ```
   */
  readHistoryEntry(offset: number): string | null;

  /**
   * Reads the page's history with each entry's page state, as Chromium last stored it, for a page that replaces this one to restore.
   *
   * @returns The entries and the current one's index.
   * @example
   * ```ts
   * import type { IWebViewContents, WebViewHistory } from "@noldova/desktop.electron";
   *
   * export function keep(contents: IWebViewContents): WebViewHistory {
   *   return contents.readHistory();
   * }
   * ```
   */
  readHistory(): WebViewHistory;

  /**
   * Restores a history another page read and loads its current entry, with the entry's form values and scroll position; the page must not have loaded any page before.
   *
   * @param history The history to restore.
   * @returns A promise that settles once the entry has loaded, and rejects when it fails to load.
   * @example
   * ```ts
   * import type { IWebViewContents, WebViewHistory } from "@noldova/desktop.electron";
   *
   * export async function resume(contents: IWebViewContents, history: WebViewHistory): Promise<void> {
   *   await contents.restoreHistoryAsync(history);
   * }
   * ```
   */
  restoreHistoryAsync(history: WebViewHistory): Promise<void>;

  /**
   * Moves back one entry in the history.
   */
  goBack(): void;

  /**
   * Moves forward one entry in the history.
   */
  goForward(): void;

  /**
   * Loads the current page again.
   */
  reload(): void;

  /**
   * Stops loading.
   */
  stop(): void;

  /**
   * Answers the page's requests for a new window.
   *
   * @param handler Receives each request's address and referrer, and answers it.
   * @example
   * ```ts
   * import type { IWebViewContents } from "@noldova/desktop.electron";
   *
   * export function refuseWindows(contents: IWebViewContents): void {
   *   contents.setWindowOpenHandler(() => ({ action: "deny" }));
   * }
   * ```
   */
  setWindowOpenHandler(handler: (details: IWindowOpenDetails) => WindowOpenHandlerResponse): void;

  /**
   * Sets which routes real-time media may take.
   *
   * @param policy `disable_non_proxied_udp`, which keeps it to proxied routes.
   */
  setWebRTCIPHandlingPolicy(policy: "disable_non_proxied_udp"): void;

  /**
   * Reads the page's zoom, which a navigation that starts a new page process may lose.
   *
   * @returns The zoom as a factor, 1 for 100%.
   */
  getZoomFactor(): number;

  /**
   * Sets the page's zoom, which the view keeps across its navigations and shares with no other view.
   *
   * @param factor The zoom as a factor, 1 for 100%.
   */
  setZoomFactor(factor: number): void;

  /**
   * Starts a search of the page's text, or steps through the matches of the running one; the result comes in `found-in-page` events.
   *
   * @param text The text to find, never empty.
   * @param options `forward` for the direction, `findNext` to start a new search and `matchCase` to tell capitals apart.
   * @returns The request's id, which its `found-in-page` events carry.
   */
  findInPage(text: string, options: IFindInPageOptions): number;

  /**
   * Ends the running search.
   *
   * @param action `clearSelection`, which clears the search's highlights.
   */
  stopFindInPage(action: "clearSelection"): void;

  /**
   * Sends a key event straight to the page, whichever page has the keyboard focus.
   *
   * @param event The event, with its key as an accelerator key code.
   */
  sendInputEvent(event: IWebViewKeyEvent): void;

  /**
   * Types text into the page's focused element, whichever page has the keyboard focus.
   *
   * @param text The text to type.
   * @returns A promise that settles once the page has taken the text.
   */
  insertText(text: string): Promise<void>;

  /**
   * Runs scripts in an isolated world of the page's main frame, which the page's own scripts can't reach.
   *
   * @param worldId The isolated world's id.
   * @param scripts The scripts to run, in order.
   * @returns A promise that settles with the last script's result once the page's renderer has run them.
   */
  executeJavaScriptInIsolatedWorld(worldId: number, scripts: IIsolatedScript[]): Promise<unknown>;

  /**
   * Listens for a frame about to navigate, which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable navigation, with its address and whether the page's own frame navigates.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IWebViewContents } from "@noldova/desktop.electron";
   *
   * export function stayOnOrigin(contents: IWebViewContents, origin: string): void {
   *   contents.on("will-frame-navigate", t => {
   *     if (t.isMainFrame && URL.parse(t.url)?.origin !== origin)
   *       t.preventDefault();
   *   });
   * }
   * ```
   */
  on(event: "will-frame-navigate", listener: (navigation: IFrameNavigation) => void): unknown;

  /**
   * Listens for a navigation starting in the page or in one of its frames, including one the engine refuses itself before any check, such as the page's own `about:srcdoc`.
   *
   * @param event The event's name.
   * @param listener Receives the navigation, which says whether the page itself starts it.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IWebViewContents } from "@noldova/desktop.electron";
   *
   * export function count(contents: IWebViewContents, starts: { count: number }): void {
   *   contents.on("did-start-navigation", t => {
   *     if (t.isMainFrame)
   *       starts.count++;
   *   });
   * }
   * ```
   */
  on(event: "did-start-navigation", listener: (navigation: IWindowNavigation) => void): unknown;

  /**
   * Listens for a webview being attached to the page, which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "will-attach-webview", listener: (event: IPreventableEvent) => void): unknown;

  /**
   * Listens for a key the person presses or releases in the page, before the page gets it; cancelling the event keeps it from the page.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event and the key.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "before-input-event", listener: (event: IPreventableEvent, input: IWebViewInput) => void): unknown;

  /**
   * Listens for a change of the page's loading, address or title, or for the contents being destroyed.
   *
   * @param event The event's name.
   * @param listener Called on each change, and once when the contents are destroyed.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "did-start-loading" | "did-stop-loading" | "did-navigate" | "did-navigate-in-page" | "page-title-updated" | "destroyed", listener: () => void): unknown;

  /**
   * Listens for a load that failed.
   *
   * @param event The event's name.
   * @param listener Receives the engine's code, its description, the address and whether the page's own frame failed.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "did-fail-load", listener: (event: unknown, code: number, description: string, url: string, isMainFrame: boolean) => void): unknown;

  /**
   * Listens for the page's renderer process having gone.
   *
   * @param event The event's name.
   * @param listener Receives why it went.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "render-process-gone", listener: (event: unknown, details: RenderProcessGoneDetails) => void): unknown;

  /**
   * Listens for a certificate the engine doesn't trust, which the listener answers.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event, the address, the error, the certificate and the callback that answers whether to trust it.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "certificate-error", listener: (event: IPreventableEvent, url: string, error: string, certificate: unknown, callback: (isTrusted: boolean) => void) => void): unknown;

  /**
   * Listens for a site asking for a client certificate, which the listener answers.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event, the address, the certificates and the callback that answers with none.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "select-client-certificate", listener: (event: IPreventableEvent, url: string, list: unknown, callback: () => void) => void): unknown;

  /**
   * Listens for each input event that reaches the page, the person's and the debugger's alike.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event and the input event.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "input-event", listener: (event: unknown, input: IWebViewInputEvent) => void): unknown;

  /**
   * Listens for a site or a proxy asking for credentials, which the listener answers.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event, the request, what asks and the callback that answers with none.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "login", listener: (event: IPreventableEvent, details: ILoginDetails, info: unknown, callback: () => void) => void): unknown;

  /**
   * Listens for a search's result.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event and the result: its request's id, the active match, the number of matches and whether it is the last update.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "found-in-page", listener: (event: unknown, result: IFoundInPageResult) => void): unknown;

  /**
   * Listens for the person turning the mouse wheel to zoom the page, which the engine leaves to the listener.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event and the direction, `in` or `out`.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "zoom-changed", listener: (event: unknown, direction: string) => void): unknown;

  /**
   * Listens for the page naming its icons, after a navigation or when it changes them.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event and the icons' addresses, in the page's order.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "page-favicon-updated", listener: (event: unknown, favicons: string[]) => void): unknown;
}

/**
 * A web view page's debugger, as Electron's `Debugger` provides it.
 */
export interface IWebViewDebugger {
  /**
   * Attaches to the page.
   *
   * @param protocolVersion The protocol version, such as `1.3`.
   * @throws Error synchronously when another debugger is attached.
   * @example
   * ```ts
   * import type { IWebViewDebugger } from "@noldova/desktop.electron";
   *
   * export function attach(debuggee: IWebViewDebugger): void {
   *   if (!debuggee.isAttached())
   *     debuggee.attach("1.3");
   * }
   * ```
   */
  attach(protocolVersion: string): void;

  /**
   * Whether the debugger is attached.
   *
   * @returns True while it is.
   */
  isAttached(): boolean;

  /**
   * Detaches from the page.
   */
  detach(): void;

  /**
   * Sends a call to the view's own page, never to a child target's session.
   *
   * @param method The protocol method, such as `Page.captureScreenshot`.
   * @param params Its parameters.
   * @returns The reply; a refused call rejects with the engine's message.
   * @example
   * ```ts
   * import type { IWebViewDebugger } from "@noldova/desktop.electron";
   *
   * export function captureAsync(debuggee: IWebViewDebugger): Promise<unknown> {
   *   return debuggee.sendCommand("Page.captureScreenshot", { format: "png" });
   * }
   * ```
   */
  sendCommand(method: string, params: object): Promise<unknown>;

  /**
   * Listens for the page's protocol events.
   *
   * @param event The event's name.
   * @param listener Receives the method, its parameters and the session it came from, empty for the page's own.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "message", listener: (event: unknown, method: string, params: unknown, sessionId: string) => void): unknown;

  /**
   * Listens for the debugger detaching, such as when the page's renderer goes.
   *
   * @param event The event's name.
   * @param listener Receives why it detached.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "detach", listener: (event: unknown, reason: string) => void): unknown;
}

/**
 * A web view profile's session: the permissions, requests and downloads of its pages, as Electron's `Session` provides them.
 */
export interface IWebViewSession {
  /**
   * Answers permission requests.
   *
   * @param handler Receives the page that asks, if any, the permission and the callback that grants or denies it.
   * @example
   * ```ts
   * import type { IWebViewSession } from "@noldova/desktop.electron";
   *
   * export function denyRequests(session: IWebViewSession): void {
   *   session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
   * }
   * ```
   */
  setPermissionRequestHandler(handler: (contents: { readonly id: number } | null, permission: string, callback: (isGranted: boolean) => void) => void): void;

  /**
   * Answers permission checks.
   *
   * @param handler Returns whether a permission is granted.
   */
  setPermissionCheckHandler(handler: () => boolean): void;

  /**
   * Answers device permission checks, such as for USB or serial devices.
   *
   * @param handler Returns whether a device may be used.
   */
  setDevicePermissionHandler(handler: () => boolean): void;

  /**
   * Answers requests to capture the screen or a window.
   *
   * @param handler Receives the id of the page that asks, or null when it can't be known, and the callback that refuses the capture.
   */
  setDisplayMediaRequestHandler(handler: (webContentsId: number | null, refuse: () => void) => void): void;

  /**
   * Judges every request of the session before it goes out.
   *
   * @param listener Receives the request and the callback that lets it go or cancels it.
   * @example
   * ```ts
   * import type { IWebViewSession } from "@noldova/desktop.electron";
   *
   * export function httpsOnly(session: IWebViewSession): void {
   *   session.onBeforeRequest((request, callback) => callback({ cancel: !request.url.startsWith("https:") }));
   * }
   * ```
   */
  onBeforeRequest(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void;

  /**
   * Judges every request of the session once its headers are known.
   *
   * @param listener Receives the request with its headers and the callback that lets it go or cancels it.
   */
  onBeforeSendHeaders(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void;

  /**
   * Listens for a response that redirects a request.
   *
   * @param listener Receives the redirect, with the address the response came from when the engine knows it.
   */
  onBeforeRedirect(listener: (redirect: IWebViewRedirect) => void): void;

  /**
   * Listens for a download, which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event, the address and the id of the page that started it, or null.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "will-download", listener: (event: IPreventableEvent, url: string, webContentsId: number | null) => void): unknown;

  /**
   * Resolves a name through the session's own resolver.
   *
   * @param host The name.
   * @returns The addresses it resolves to; it rejects when it doesn't resolve.
   * @example
   * ```ts
   * import type { IWebViewSession } from "@noldova/desktop.electron";
   *
   * export function resolveAsync(session: IWebViewSession): Promise<readonly string[]> {
   *   return session.resolveHostAsync("example.com");
   * }
   * ```
   */
  resolveHostAsync(host: string): Promise<readonly string[]>;

  /**
   * Fetches a page's icon in the session, with its cookies and cache, without following a redirect; the session's own request checks still judge the request.
   *
   * @param url The icon's address.
   * @param byteLimit The most bytes it reads.
   * @param signal Stops the request and the read when it aborts.
   * @returns The icon's bytes, or null when the answer isn't a success or holds more than `byteLimit` bytes; it rejects when the request fails or `signal` aborts.
   * @example
   * ```ts
   * import type { IWebViewSession } from "@noldova/desktop.electron";
   *
   * export function readIconAsync(session: IWebViewSession): Promise<Uint8Array | null> {
   *   return session.readIconAsync("https://example.com/favicon.ico", 1_048_576, AbortSignal.timeout(10_000));
   * }
   * ```
   */
  readIconAsync(url: string, byteLimit: number, signal: AbortSignal): Promise<Uint8Array | null>;

  /**
   * Clears the session's cookies, storage and cache.
   *
   * @returns A promise that settles once they are cleared.
   * @throws ProfileNotClearedException asynchronously when the engine can't clear them; the host answers the module's clear as `Unavailable`.
   * @example
   * ```ts
   * import type { IWebViewSession } from "@noldova/desktop.electron";
   *
   * export function forgetAsync(session: IWebViewSession): Promise<void> {
   *   return session.clearStorageDataAsync();
   * }
   * ```
   */
  clearStorageDataAsync(): Promise<void>;
}

/**
 * The exception thrown when the engine can't clear a web view profile's data or cache.
 */
export declare class ProfileNotClearedException extends ElectronException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The engine's error, if any.
   * @example
   * ```ts
   * import { ProfileNotClearedException } from "@noldova/desktop.electron";
   *
   * export const failure: ProfileNotClearedException = new ProfileNotClearedException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * A request of a web view profile, as Electron's request listeners report it.
 */
export interface IWebViewRequest {
  /**
   * The request's id, which stays the same across its redirects.
   */
  readonly id: number;

  /**
   * The address it asks for.
   */
  readonly url: string;

  /**
   * The id of the page that made it, when a page did.
   */
  readonly webContentsId?: number;

  /**
   * What it loads, such as `mainFrame`, `subFrame`, `script` or `image`.
   */
  readonly resourceType: string;

  /**
   * The frame that asked, which for a `subFrame` load is the frame that navigates; `null` once it is gone.
   */
  readonly frame?: IWebViewFrame | null;

  /**
   * Its headers, once they are known.
   */
  readonly requestHeaders?: Readonly<Record<string, string>>;
}

/**
 * A key the person presses or releases in a web view's page, as Electron's `before-input-event` reports it.
 */
export interface IWebViewInput {
  /**
   * What happened to the key: `keyDown`, `rawKeyDown`, `keyUp` or `char`.
   */
  readonly type: string;

  /**
   * The key's value, such as `r` or `F5`.
   */
  readonly key: string;

  /**
   * The physical key, such as `KeyR`.
   */
  readonly code: string;

  /**
   * Whether the key is held and this press repeats it.
   */
  readonly isAutoRepeat: boolean;

  /**
   * Whether Control is held.
   */
  readonly control: boolean;

  /**
   * Whether Alt, or Option on macOS, is held.
   */
  readonly alt: boolean;

  /**
   * Whether Shift is held.
   */
  readonly shift: boolean;

  /**
   * Whether Command on macOS, or the Windows key, is held.
   */
  readonly meta: boolean;
}

/**
 * A response that redirected a web view profile's request, as Electron reports it.
 */
export interface IWebViewRedirect {
  /**
   * The request's id.
   */
  readonly id: number;

  /**
   * The address the redirecting response answered.
   */
  readonly url: string;

  /**
   * The address it redirects to.
   */
  readonly redirectURL: string;

  /**
   * The id of the page that made the request, when a page did.
   */
  readonly webContentsId?: number;

  /**
   * The IP address the response came from, when the engine connected to one.
   */
  readonly ip?: string;
}

/**
 * A navigation a window's web contents start, as Electron's `did-start-navigation` event describes it.
 */
export interface IWindowNavigation {
  /**
   * The address the navigation goes to.
   */
  readonly url: string;

  /**
   * Whether the window's own page navigates, rather than one of its frames.
   */
  readonly isMainFrame: boolean;

  /**
   * Whether the navigation stays in the same document, such as a change of the URL's fragment.
   */
  readonly isSameDocument: boolean;
}

/**
 * A window's web contents, as Electron's `WebContents` provides them.
 */
export interface IWindowContents {
  /**
   * The web contents' id, which IPC events name as their sender.
   */
  readonly id: number;

  /**
   * The session the web contents use, on which the main process serves its own scheme for files runtime parts share.
   */
  readonly session: IWindowSession;

  /**
   * Listens for a navigation, a redirect or a webview being attached, each of which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event and, for a navigation or a redirect, the target URL.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function stayOnPage(contents: IWindowContents, page: string): void {
   *   contents.on("will-navigate", (event, url) => {
   *     if (url !== page)
   *       event.preventDefault();
   *   });
   * }
   * ```
   */
  on(event: "will-navigate", listener: (event: IPreventableEvent, url: string) => void): unknown;

  /**
   * Listens for a redirect during a navigation, which the listener may cancel.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event and the URL the redirect leads to.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "will-redirect", listener: (event: IPreventableEvent, url: string) => void): unknown;

  /**
   * Listens for the page's renderer process having gone, for any reason including a clean exit.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event, which the main process does not use, and why the process went.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function watch(contents: IWindowContents, record: (reason: string) => void): void {
   *   contents.on("render-process-gone", (_event, details) => record(details.reason));
   * }
   * ```
   */
  on(event: "render-process-gone", listener: (event: unknown, details: RenderProcessGoneDetails) => void): unknown;

  /**
   * Listens for a navigation starting in the page or in one of its frames, including the first load and every reload.
   *
   * @param event The event's name.
   * @param listener Receives the navigation, which says whether the page itself starts a new document.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function count(contents: IWindowContents, loads: { count: number }): void {
   *   contents.on("did-start-navigation", t => {
   *     if (t.isMainFrame && !t.isSameDocument)
   *       loads.count++;
   *   });
   * }
   * ```
   */
  on(event: "did-start-navigation", listener: (navigation: IWindowNavigation) => void): unknown;

  /**
   * Listens for the page itself committing a new document, after which the old document no longer runs.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event, which the main process does not use, and the committed URL.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "did-navigate", listener: (event: unknown, url: string) => void): unknown;

  /**
   * Listens for the page asking for a context menu, which Electron reports only when the page did not cancel the
   * request.
   *
   * @param event The event's name.
   * @param listener Receives Electron's event and what it reports about the menu.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function follow(contents: IWindowContents, words: string[]): void {
   *   contents.on("context-menu", (_event, params) => words.push(params.misspelledWord));
   * }
   * ```
   */
  on(event: "context-menu", listener: (event: unknown, params: IContextMenuParams) => void): unknown;

  /**
   * Decides what happens when the page asks to open a window.
   *
   * @param handler Returns the decision.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function denyWindows(contents: IWindowContents): void {
   *   contents.setWindowOpenHandler(() => ({ action: "deny" }));
   * }
   * ```
   */
  setWindowOpenHandler(handler: () => WindowOpenHandlerResponse): void;

  /**
   * Sends a message to the page.
   *
   * @param channel The channel's name.
   * @param values The message's values.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function askToClose(contents: IWindowContents): void {
   *   contents.send("desktop:closeRequest", "request-1");
   * }
   * ```
   */
  send(channel: string, ...values: unknown[]): void;

  /**
   * Tells whether the page is still loading.
   *
   * @returns Whether it is loading.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function isLoading(contents: IWindowContents): boolean {
   *   return contents.isLoading();
   * }
   * ```
   */
  isLoading(): boolean;

  /**
   * Tells whether the page's renderer process has crashed.
   *
   * @returns Whether it has crashed.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function hasCrashed(contents: IWindowContents): boolean {
   *   return contents.isCrashed();
   * }
   * ```
   */
  isCrashed(): boolean;

  /**
   * Loads the page again, starting a new renderer process when the old one has gone.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function reload(contents: IWindowContents): void {
   *   contents.reload();
   * }
   * ```
   */
  reload(): void;

  /**
   * Ends the page's renderer process at once, which recovers a page that no longer responds before a reload.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function restart(contents: IWindowContents): void {
   *   contents.forcefullyCrashRenderer();
   *   contents.reload();
   * }
   * ```
   */
  forcefullyCrashRenderer(): void;

  /**
   * Undoes the last edit in the page's focused field.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function undo(contents: IWindowContents): void {
   *   contents.undo();
   * }
   * ```
   */
  undo(): void;

  /**
   * Redoes the last edit undone in the page's focused field.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function redo(contents: IWindowContents): void {
   *   contents.redo();
   * }
   * ```
   */
  redo(): void;

  /**
   * Cuts the page's selection in its focused field to the clipboard.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function cut(contents: IWindowContents): void {
   *   contents.cut();
   * }
   * ```
   */
  cut(): void;

  /**
   * Copies the page's selection to the clipboard.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function copy(contents: IWindowContents): void {
   *   contents.copy();
   * }
   * ```
   */
  copy(): void;

  /**
   * Pastes the clipboard into the page's focused field, replacing its selection.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function paste(contents: IWindowContents): void {
   *   contents.paste();
   * }
   * ```
   */
  paste(): void;

  /**
   * Selects all of the page's focused field, or all of the page when no field has focus.
   *
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function selectAll(contents: IWindowContents): void {
   *   contents.selectAll();
   * }
   * ```
   */
  selectAll(): void;

  /**
   * Replaces the misspelled word around the page's selection, as one step that Undo reverts.
   *
   * @param text The replacement.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function correct(contents: IWindowContents): void {
   *   contents.replaceMisspelling("world");
   * }
   * ```
   */
  replaceMisspelling(text: string): void;

  /**
   * Returns the operating system's id of the page's renderer process.
   *
   * @returns The process id.
   * @example
   * ```ts
   * import type { IWindowContents } from "@noldova/desktop.electron";
   *
   * export function rendererOf(contents: IWindowContents): number {
   *   return contents.getOSProcessId();
   * }
   * ```
   */
  getOSProcessId(): number;
}

/**
 * One notification shown through the operating system, as Electron's `Notification` provides it.
 */
export interface ISystemNotification {
  /**
   * Shows the notification without taking focus.
   *
   * @example
   * ```ts
   * import type { INotificationHost } from "@noldova/desktop.electron";
   *
   * export function announce(host: INotificationHost): void {
   *   host.create({ title: "Saved" }).show();
   * }
   * ```
   */
  show(): void;

  /**
   * Removes the notification from the screen and the operating system's list.
   *
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/desktop.electron";
   *
   * export function withdraw(notification: ISystemNotification): void {
   *   notification.close();
   * }
   * ```
   */
  close(): void;

  /**
   * Listens for the operating system showing the notification.
   *
   * @param event `"show"`.
   * @param listener Called once it shows.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/desktop.electron";
   *
   * export function whenShown(notification: ISystemNotification): Promise<void> {
   *   return new Promise(resolve => notification.on("show", resolve));
   * }
   * ```
   */
  on(event: "show", listener: () => void): unknown;

  /**
   * Listens for the person clicking the notification.
   *
   * @param event `"click"`.
   * @param listener Called on each click.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/desktop.electron";
   *
   * export function follow(notification: ISystemNotification, open: () => void): void {
   *   notification.on("click", open);
   * }
   * ```
   */
  on(event: "click", listener: () => void): unknown;

  /**
   * Listens for the notification closing, by the person or from code.
   *
   * @param event `"close"`.
   * @param listener Called once it closes.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/desktop.electron";
   *
   * export function forget(notification: ISystemNotification, shown: Set<ISystemNotification>): void {
   *   notification.on("close", () => shown.delete(notification));
   * }
   * ```
   */
  on(event: "close", listener: () => void): unknown;

  /**
   * Listens for the operating system failing to show the notification; Windows reports it.
   *
   * @param event `"failed"`.
   * @param listener Called with the operating system's reason.
   * @returns Electron's notification, for chaining.
   * @example
   * ```ts
   * import type { ISystemNotification } from "@noldova/desktop.electron";
   *
   * export function report(notification: ISystemNotification, write: (text: string) => void): void {
   *   notification.on("failed", (_event, error) => write(error));
   * }
   * ```
   */
  on(event: "failed", listener: (event: unknown, error: string) => void): unknown;
}

/**
 * An icon in the Windows notification area, the macOS menu bar or the Linux tray, as Electron's `Tray` provides it.
 */
export interface ITray {
  /**
   * Shows another image.
   *
   * @param image The image file: `.ico` on Windows, a template `.png` on macOS, `.png` on Linux.
   * @example
   * ```ts
   * import type { ITray } from "@noldova/desktop.electron";
   *
   * export function showIdle(tray: ITray): void {
   *   tray.setImage("/noldova-desktop/assets/icons/tray/tray-idle.png");
   * }
   * ```
   */
  setImage(image: string): void;

  /**
   * Sets the text shown when the pointer rests on the icon.
   *
   * @param toolTip The text.
   * @example
   * ```ts
   * import type { ITray } from "@noldova/desktop.electron";
   *
   * export function describe(tray: ITray): void {
   *   tray.setToolTip("Noldova Desktop Sample: 2 running");
   * }
   * ```
   */
  setToolTip(toolTip: string): void;

  /**
   * Sets the icon's menu.
   *
   * @param menu A menu that {@link IMenuHost.buildFromTemplate} built.
   * @example
   * ```ts
   * import type { IMenuHost, ITray } from "@noldova/desktop.electron";
   *
   * export function offerQuit(tray: ITray, menu: IMenuHost, quit: () => void): void {
   *   tray.setContextMenu(menu.buildFromTemplate([{ label: "Quit Noldova Desktop Sample", click: quit }]));
   * }
   * ```
   */
  setContextMenu(menu: unknown): void;

  /**
   * Listens for a click on the icon.
   *
   * @param event `click`.
   * @param listener Called on each click.
   * @returns The tray, for chaining.
   * @example
   * ```ts
   * import type { ITray } from "@noldova/desktop.electron";
   *
   * export function openOnClick(tray: ITray, open: () => void): void {
   *   tray.on("click", open);
   * }
   * ```
   */
  on(event: "click", listener: () => void): unknown;

  /**
   * Removes the icon.
   *
   * @example
   * ```ts
   * import type { ITray } from "@noldova/desktop.electron";
   *
   * export function hide(tray: ITray): void {
   *   tray.destroy();
   * }
   * ```
   */
  destroy(): void;
}

/**
 * The system's light or dark theme, as Electron's `nativeTheme` provides it.
 */
export interface IThemeHost {
  /**
   * Whether the system asks applications for dark colors.
   */
  readonly shouldUseDarkColors: boolean;

  /**
   * Whether the system's own surfaces, such as the Windows taskbar, are dark; on Windows they may differ from the applications' theme.
   */
  readonly shouldUseDarkColorsForSystemIntegratedUI: boolean;

  /**
   * Listens for a change of the system's theme.
   *
   * @param event The event's name.
   * @param listener Called each time the theme changes.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IThemeHost } from "@noldova/desktop.electron";
   *
   * export function follow(theme: IThemeHost, paint: (isDark: boolean) => void): void {
   *   theme.on("updated", () => paint(theme.shouldUseDarkColors));
   * }
   * ```
   */
  on(event: "updated", listener: () => void): unknown;

  /**
   * Stops a listener that `on` added.
   *
   * @param event The event's name.
   * @param listener The listener to stop.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IThemeHost } from "@noldova/desktop.electron";
   *
   * export function stop(theme: IThemeHost, listener: () => void): void {
   *   theme.off("updated", listener);
   * }
   * ```
   */
  off(event: "updated", listener: () => void): unknown;
}

/**
 * Creates tray icons, as Electron's `Tray` constructor does.
 */
export interface ITrayHost {
  /**
   * Shows a new icon.
   *
   * @param image The icon's image file.
   * @returns The icon.
   * @throws Error when the operating system cannot show it.
   * @example
   * ```ts
   * import type { ITray, ITrayHost } from "@noldova/desktop.electron";
   *
   * export function show(host: ITrayHost): ITray {
   *   return host.create("/noldova-desktop/assets/icons/tray/tray-idle.png");
   * }
   * ```
   */
  create(image: string): ITray;
}

/**
 * Takes keys system-wide, as Electron's `globalShortcut` does; on Linux under Wayland through the system's GlobalShortcuts portal.
 */
export interface IShortcutHost {
  /**
   * Takes a key system-wide.
   *
   * @param accelerator The key, in Electron's accelerator form.
   * @param callback Runs when the person presses the key.
   * @returns False when the system refuses the key, such as when another program holds it; under Wayland the portal's answer comes later and is never reported, so this is true.
   * @example
   * ```ts
   * import type { IShortcutHost } from "@noldova/desktop.electron";
   *
   * export function take(host: IShortcutHost, stop: () => void): boolean {
   *   return host.register("CommandOrControl+Shift+.", stop);
   * }
   * ```
   */
  register(accelerator: string, callback: () => void): boolean;

  /**
   * Gives a key back to the system.
   *
   * @param accelerator The key, as it was taken.
   * @example
   * ```ts
   * import type { IShortcutHost } from "@noldova/desktop.electron";
   *
   * export function release(host: IShortcutHost): void {
   *   host.unregister("CommandOrControl+Shift+.");
   * }
   * ```
   */
  unregister(accelerator: string): void;
}

/**
 * The operating system's notification service, as Electron's `Notification` class provides it.
 */
export interface INotificationHost {
  /**
   * Whether the operating system has a notification service.
   *
   * @returns `true` when notifications can show.
   * @example
   * ```ts
   * import type { INotificationHost } from "@noldova/desktop.electron";
   *
   * export function canNotify(host: INotificationHost): boolean {
   *   return host.isSupported();
   * }
   * ```
   */
  isSupported(): boolean;

  /**
   * Creates a notification without showing it.
   *
   * @param options Its title, text and icon.
   * @returns The notification.
   * @example
   * ```ts
   * import type { INotificationHost, ISystemNotification } from "@noldova/desktop.electron";
   *
   * export function prepare(host: INotificationHost): ISystemNotification {
   *   return host.create({ title: "Saved", body: "Plan.md" });
   * }
   * ```
   */
  create(options: NotificationConstructorOptions): ISystemNotification;
}

/**
 * Native dialogs, as Electron's `dialog` provides them: message boxes, which the main process uses only when its window's
 * page cannot draw, and the folder chooser and save dialog a window part asks for.
 */
export interface IDialogHost {
  /**
   * Shows a message box on a window, or on its own when the window is gone or none is given.
   *
   * @param windowId The window's id, or null for a box of its own.
   * @param options The box's message, buttons and, when it may be dismissed from code, its abort signal.
   * @returns A promise of the chosen button's index, or the cancel button's when the box was dismissed.
   * @example
   * ```ts
   * import type { IDialogHost } from "@noldova/desktop.electron";
   *
   * export async function askAsync(dialog: IDialogHost, windowId: number): Promise<boolean> {
   *   const { response } = await dialog.showMessageBox(windowId, { message: "Reload?", buttons: ["Reload", "Quit"], cancelId: 1 });
   *   return response === 0;
   * }
   * ```
   */
  showMessageBox(windowId: number | null, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;

  /**
   * Shows the system's own open dialog attached to a window; when the window is gone, it shows nothing and reports a cancel.
   *
   * @param windowId The window's id.
   * @param options What the dialog opens, such as a folder.
   * @returns A promise of the chosen paths, or of a cancel.
   * @example
   * ```ts
   * import type { IDialogHost } from "@noldova/desktop.electron";
   *
   * export async function chooseFolderAsync(dialog: IDialogHost, windowId: number): Promise<string | null> {
   *   const { canceled, filePaths } = await dialog.showOpenDialog(windowId, { properties: ["openDirectory"] });
   *   return canceled ? null : filePaths[0] ?? null;
   * }
   * ```
   */
  showOpenDialog(windowId: number, options: OpenDialogOptions): Promise<OpenDialogReturnValue>;

  /**
   * Shows the system's own save dialog attached to a window; when the window is gone, it shows nothing and reports a cancel.
   *
   * @param windowId The window's id.
   * @param options The dialog's options, such as the suggested file name.
   * @returns A promise of the chosen path, or of a cancel.
   * @example
   * ```ts
   * import type { IDialogHost } from "@noldova/desktop.electron";
   *
   * export async function choosePathAsync(dialog: IDialogHost, windowId: number): Promise<string | null> {
   *   const { canceled, filePath } = await dialog.showSaveDialog(windowId, { defaultPath: "photo.png" });
   *   return canceled ? null : filePath;
   * }
   * ```
   */
  showSaveDialog(windowId: number, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
}

/**
 * Where the main process records what a person or a support request may need to know.
 */
export interface IMainProcessLog {
  /**
   * Records a line.
   *
   * @param text What happened.
   * @example
   * ```ts
   * import type { IMainProcessLog } from "@noldova/desktop.electron";
   *
   * export function record(log: IMainProcessLog): void {
   *   log.write("The window's bounds could not be saved.");
   * }
   * ```
   */
  write(text: string): void;

  /**
   * Writes every line still waiting at once, before the main process exits.
   *
   * @example
   * ```ts
   * import type { IMainProcessLog } from "@noldova/desktop.electron";
   *
   * export function recordAndExit(log: IMainProcessLog, exit: () => void): void {
   *   log.write("The main process is exiting.");
   *   log.flush();
   *   exit();
   * }
   * ```
   */
  flush(): void;

  /**
   * Closes the log's file, when the log has one, before the main process exits: it resolves only once no write still
   * holds the file open. A line written afterwards still reaches standard error but no longer the file.
   *
   * @returns A promise that resolves once the file is closed; it never rejects.
   * @example
   * ```ts
   * import type { IMainProcessLog } from "@noldova/desktop.electron";
   *
   * export async function closeAndExitAsync(log: IMainProcessLog, exit: () => void): Promise<void> {
   *   log.flush();
   *   await log.closeAsync?.();
   *   exit();
   * }
   * ```
   */
  closeAsync?(): Promise<void>;
}

/**
 * A native window, as Electron's `BrowserWindow` provides it.
 */
export interface IMainProcessWindow {
  /**
   * The window's id, which a message box names as its parent.
   */
  readonly id: number;

  /**
   * The window's web contents.
   */
  readonly webContents: IWindowContents;

  /**
   * Loads a local page.
   *
   * @param filePath The page's file.
   * @returns A promise that settles when the page has loaded.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export async function loadAsync(window: IMainProcessWindow): Promise<void> {
   *   await window.loadFile("/repository/_build/window/browser/index.html");
   * }
   * ```
   */
  loadFile(filePath: string): Promise<void>;

  /**
   * Sets the color shown behind the page.
   *
   * @param color A CSS color.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function darken(window: IMainProcessWindow): void {
   *   window.setBackgroundColor("#181818");
   * }
   * ```
   */
  setBackgroundColor(color: string): void;

  /**
   * Sets the colors and height of the native window controls drawn over the page on Windows and Linux.
   *
   * @param options The overlay's colors and height.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function paintControls(window: IMainProcessWindow): void {
   *   window.setTitleBarOverlay({ color: "#181818", symbolColor: "#CCCCCC", height: 32 });
   * }
   * ```
   */
  setTitleBarOverlay(options: TitleBarOverlayOptions): void;

  /**
   * Describes the window to the Windows taskbar: its app ID, its icon and the command that starts this build again.
   *
   * @param options The taskbar details.
   * @example
   * ```ts
   * import { type IMainProcessWindow, TaskbarIdentity } from "@noldova/desktop.electron";
   *
   * export async function describeAsync(window: IMainProcessWindow): Promise<void> {
   *   window.setAppDetails((await TaskbarIdentity.createAsync(true, "/opt/noldova-desktop/noldova-desktop", "", "", [], "/opt/noldova-desktop")).toAppDetails());
   * }
   * ```
   */
  setAppDetails(options: AppDetailsOptions): void;

  /**
   * Shows an image as the window's icon, which Linux's window list shows. On Windows a taskbar button shows it only
   * when no Start menu shortcut is registered for the window's app ID and no relaunch icon was set before the button
   * appeared; otherwise the button keeps that icon.
   *
   * @param iconPath The image's absolute path.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function showLightIcon(window: IMainProcessWindow): void {
   *   window.setIcon("/noldova-desktop/assets/icons/icon-light-512.png");
   * }
   * ```
   */
  setIcon(iconPath: string): void;

  /**
   * The window's bounds when it is neither maximized nor minimized.
   *
   * @returns The bounds in screen pixels.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function widthOf(window: IMainProcessWindow): number {
   *   return window.getNormalBounds().width;
   * }
   * ```
   */
  getNormalBounds(): Rectangle;

  /**
   * The window's media source id, `window:<id>:<n>`, whose id is its window handle on Windows, its window number on macOS
   * and its X11 window on Linux; the main process reads the app's windows for the runtime from it, except under Wayland.
   *
   * @returns The media source id.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function sourceOf(window: IMainProcessWindow): string {
   *   return window.getMediaSourceId();
   * }
   * ```
   */
  getMediaSourceId(): string;

  /**
   * The window's title, which its page sets; the main process reports it to the runtime as the main window's title.
   *
   * @returns The title.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function titleOf(window: IMainProcessWindow): string {
   *   return window.getTitle();
   * }
   * ```
   */
  getTitle(): string;

  /**
   * Moves or resizes the window.
   *
   * @param bounds The new position, size or both, in screen pixels.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function resize(window: IMainProcessWindow): void {
   *   window.setBounds({ width: 1280, height: 800 });
   * }
   * ```
   */
  setBounds(bounds: Partial<Rectangle>): void;

  /**
   * Whether the window is maximized.
   *
   * @returns `true` when the window is maximized.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function isLarge(window: IMainProcessWindow): boolean {
   *   return window.isMaximized();
   * }
   * ```
   */
  isMaximized(): boolean;

  /**
   * Whether the window is in full screen.
   *
   * @returns `true` when the window is in full screen.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function fillsTheScreen(window: IMainProcessWindow): boolean {
   *   return window.isFullScreen();
   * }
   * ```
   */
  isFullScreen(): boolean;

  /**
   * Maximizes the window.
   *
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function enlarge(window: IMainProcessWindow): void {
   *   window.maximize();
   * }
   * ```
   */
  maximize(): void;

  /**
   * Returns a maximized window to its normal size.
   *
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function toggleMaximized(window: IMainProcessWindow): void {
   *   if (window.isMaximized())
   *     window.unmaximize();
   *   else
   *     window.maximize();
   * }
   * ```
   */
  unmaximize(): void;

  /**
   * Minimizes the window.
   *
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function hide(window: IMainProcessWindow): void {
   *   window.minimize();
   * }
   * ```
   */
  minimize(): void;

  /**
   * Whether the window is shown.
   *
   * @returns `true` when the window is visible.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function showOnce(window: IMainProcessWindow): void {
   *   if (!window.isVisible())
   *     window.show();
   * }
   * ```
   */
  isVisible(): boolean;

  /**
   * Whether the window has been destroyed.
   *
   * @returns `true` when the window is gone.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function closeIfOpen(window: IMainProcessWindow): void {
   *   if (!window.isDestroyed())
   *     window.close();
   * }
   * ```
   */
  isDestroyed(): boolean;

  /**
   * Whether the window is minimized.
   *
   * @returns `true` when the window is minimized.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function bringBack(window: IMainProcessWindow): void {
   *   if (window.isMinimized())
   *     window.restore();
   * }
   * ```
   */
  isMinimized(): boolean;

  /**
   * Whether the window has the keyboard focus.
   *
   * @returns `true` when the window is focused.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function isInUse(windows: readonly IMainProcessWindow[]): boolean {
   *   return windows.some(t => t.isFocused());
   * }
   * ```
   */
  isFocused(): boolean;

  /**
   * Shows the window.
   *
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function reveal(window: IMainProcessWindow): void {
   *   window.show();
   * }
   * ```
   */
  show(): void;

  /**
   * Restores a minimized window.
   *
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function unminimize(window: IMainProcessWindow): void {
   *   window.restore();
   * }
   * ```
   */
  restore(): void;

  /**
   * Gives the window the keyboard focus.
   *
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function bringForward(window: IMainProcessWindow): void {
   *   window.focus();
   * }
   * ```
   */
  focus(): void;

  /**
   * Asks the window to close, which raises its `close` event first.
   *
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function dismiss(window: IMainProcessWindow): void {
   *   window.close();
   * }
   * ```
   */
  close(): void;

  /**
   * Listens for the window being asked to close, which the listener may cancel; for the window being resized, moved,
   * maximized or restored from maximized; or for its page no longer responding or responding again.
   *
   * @param event The event's name.
   * @param listener Receives the cancellable event when the window is asked to close; called with nothing otherwise.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function keepOpen(window: IMainProcessWindow): void {
   *   window.on("close", event => event.preventDefault());
   * }
   * ```
   */
  on(event: "close", listener: (event: IPreventableEvent) => void): unknown;

  /**
   * Listens for the window having been resized.
   *
   * @param event The event's name.
   * @param listener Called after each resize.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "resize", listener: () => void): unknown;

  /**
   * Listens for the window having been moved.
   *
   * @param event The event's name.
   * @param listener Called after each move.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "move", listener: () => void): unknown;

  /**
   * Listens for the window being about to move.
   *
   * @param event The event's name.
   * @param listener Called before each move.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "will-move", listener: () => void): unknown;

  /**
   * Listens for the window being about to be resized.
   *
   * @param event The event's name.
   * @param listener Called before each resize.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "will-resize", listener: () => void): unknown;

  /**
   * Listens for the window being maximized.
   *
   * @param event The event's name.
   * @param listener Called each time the window is maximized.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "maximize", listener: () => void): unknown;

  /**
   * Listens for the window being restored from maximized.
   *
   * @param event The event's name.
   * @param listener Called each time the window leaves the maximized state.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "unmaximize", listener: () => void): unknown;

  /**
   * Listens for the window entering full screen.
   *
   * @param event The event's name.
   * @param listener Called each time the window has entered full screen.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "enter-full-screen", listener: () => void): unknown;

  /**
   * Listens for the window leaving full screen.
   *
   * @param event The event's name.
   * @param listener Called each time the window has left full screen.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "leave-full-screen", listener: () => void): unknown;

  /**
   * Listens for the window's page no longer responding.
   *
   * @param event The event's name.
   * @param listener Called each time the page stops responding.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "unresponsive", listener: () => void): unknown;

  /**
   * Listens for the window's page responding again after it stopped.
   *
   * @param event The event's name.
   * @param listener Called each time the page responds again.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "responsive", listener: () => void): unknown;

  /**
   * Listens for the window being shown.
   *
   * @param event The event's name.
   * @param listener Called each time the window is shown.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "show", listener: () => void): unknown;

  /**
   * Listens for the window being hidden.
   *
   * @param event The event's name.
   * @param listener Called each time the window is hidden.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "hide", listener: () => void): unknown;

  /**
   * Listens for the window's page setting its title.
   *
   * @param event The event's name.
   * @param listener Called with the new title each time the page sets one.
   * @returns Electron's own return value, which the main process does not use.
   */
  on(event: "page-title-updated", listener: (event: IPreventableEvent, title: string) => void): unknown;

  /**
   * Listens once for the window having closed.
   *
   * @param event The event's name.
   * @param listener Called when the window is gone.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IMainProcessWindow } from "@noldova/desktop.electron";
   *
   * export function onGone(window: IMainProcessWindow, gone: () => void): void {
   *   window.once("closed", gone);
   * }
   * ```
   */
  once(event: "closed", listener: () => void): unknown;
}

/**
 * The parent port of an Electron utility process, through which it answers the process that started it.
 */
export interface IParentPort {
  /**
   * Sends a message to the parent process.
   *
   * @param message A structured-cloneable value.
   * @example
   * ```ts
   * import type { IParentPort } from "@noldova/desktop.electron";
   *
   * export function answer(port: IParentPort): void {
   *   port.postMessage({ processId: 4120, failure: null });
   * }
   * ```
   */
  postMessage(message: unknown): void;

  /**
   * Listens once for the parent process's next message.
   *
   * @param event The event's name.
   * @param listener Called when the message arrives.
   * @returns Electron's own return value, which the main process does not use.
   * @example
   * ```ts
   * import type { IParentPort } from "@noldova/desktop.electron";
   *
   * export function onAcknowledged(port: IParentPort, acknowledged: () => void): void {
   *   port.once("message", acknowledged);
   * }
   * ```
   */
  once(event: "message", listener: () => void): unknown;
}

/**
 * The file operations {@link PathCommand} links the command with, as Node.js's `fs/promises` provides them.
 */
export interface IPathCommandFiles {
  /**
   * Reads a file's own status, without following a link.
   *
   * @param file The file to read.
   * @returns Its status; rejects with an error whose `code` is `ENOENT` when nothing is there.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/desktop.electron";
   *
   * export async function isLinkAsync(files: IPathCommandFiles, file: string): Promise<boolean> {
   *   return (await files.lstat(file)).isSymbolicLink();
   * }
   * ```
   */
  lstat(file: string): Promise<Stats>;

  /**
   * Reads where a link points.
   *
   * @param link The link to read.
   * @returns The path it points to.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/desktop.electron";
   *
   * export function targetAsync(files: IPathCommandFiles): Promise<string> {
   *   return files.readlink("/usr/local/bin/noldova-desktop");
   * }
   * ```
   */
  readlink(link: string): Promise<string>;

  /**
   * Removes a file or a link.
   *
   * @param file The file to remove.
   * @returns A promise that settles once it is removed.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/desktop.electron";
   *
   * export function unlinkAsync(files: IPathCommandFiles): Promise<void> {
   *   return files.rm("/usr/local/bin/noldova-desktop");
   * }
   * ```
   */
  rm(file: string): Promise<void>;

  /**
   * Makes a folder and any folders above it that are missing.
   *
   * @param folder The folder to make.
   * @param options Always recursive.
   * @returns The first folder it made, or `undefined` when all were there.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/desktop.electron";
   *
   * export async function prepareAsync(files: IPathCommandFiles): Promise<void> {
   *   await files.mkdir("/usr/local/bin", { recursive: true });
   * }
   * ```
   */
  mkdir(folder: string, options: { readonly recursive: true }): Promise<string | undefined>;

  /**
   * Makes a link.
   *
   * @param target The path the link points to.
   * @param link The link to make.
   * @returns A promise that settles once the link is made; rejects with an error whose `code` of `EACCES` or `EPERM`
   * makes {@link PathCommand.installAsync} ask for an administrator.
   * @example
   * ```ts
   * import type { IPathCommandFiles } from "@noldova/desktop.electron";
   *
   * export function linkAsync(files: IPathCommandFiles): Promise<void> {
   *   return files.symlink("/Applications/Noldova Desktop Sample.app/Contents/Resources/bin/noldova-desktop", "/usr/local/bin/noldova-desktop");
   * }
   * ```
   */
  symlink(target: string, link: string): Promise<void>;
}

/**
 * The files the main process reads and moves: those it checks a path with before it shows or opens a file, and the
 * listing and rename that put a macOS app's copy in its install folder, as Node.js's `fs/promises` provides them.
 */
export interface IMainProcessFiles extends IShownPathFiles {
  /**
   * Renames a file or folder, which fails rather than replacing a folder that holds anything.
   *
   * @param from The file or folder to rename.
   * @param to Its new path.
   * @returns A promise that resolves once it is renamed; rejects when it can't be.
   * @example
   * ```ts
   * import type { IMainProcessFiles } from "@noldova/desktop.electron";
   *
   * export function placeAsync(files: IMainProcessFiles): Promise<void> {
   *   return files.rename("/Applications/Sample Makers/.123-Sample.app", "/Applications/Sample Makers/Sample.app");
   * }
   * ```
   */
  rename(from: string, to: string): Promise<void>;

  /**
   * Lists the names of a folder's entries.
   *
   * @param folder The folder.
   * @returns A promise of the entries' names; rejects with code `ENOENT` when the folder is missing.
   * @example
   * ```ts
   * import type { IMainProcessFiles } from "@noldova/desktop.electron";
   *
   * export function listAsync(files: IMainProcessFiles): Promise<string[]> {
   *   return files.readdir("/Applications/Sample Makers");
   * }
   * ```
   */
  readdir(folder: string): Promise<string[]>;
}

/**
 * The file reads the main process checks a path with before it shows the file in its folder or opens it, as Node.js's
 * `fs/promises` provides them.
 */
export interface IShownPathFiles {
  /**
   * Reads a file's own status, without following a link.
   *
   * @param file The file to read.
   * @returns Its status; rejects when nothing can be read there.
   * @example
   * ```ts
   * import type { IShownPathFiles } from "@noldova/desktop.electron";
   *
   * export async function isLinkAsync(files: IShownPathFiles, file: string): Promise<boolean> {
   *   return (await files.lstat(file)).isSymbolicLink();
   * }
   * ```
   */
  lstat(file: string): Promise<IShownPathStatus>;

  /**
   * Reads where a link points, without looking at what is there.
   *
   * @param link The link to read.
   * @returns The path it points to, as the link holds it.
   * @example
   * ```ts
   * import type { IShownPathFiles } from "@noldova/desktop.electron";
   *
   * export function targetAsync(files: IShownPathFiles): Promise<string> {
   *   return files.readlink("/home/person/Documents/notes.md");
   * }
   * ```
   */
  readlink(link: string): Promise<string>;

  /**
   * Reads the path a file has once every link and mapped drive in it is resolved.
   *
   * @param file The file to read.
   * @returns Its real path; rejects when nothing can be read there.
   * @example
   * ```ts
   * import type { IShownPathFiles } from "@noldova/desktop.electron";
   *
   * export function realPathAsync(files: IShownPathFiles): Promise<string> {
   *   return files.realpath("Z:\\Reports\\report.pdf");
   * }
   * ```
   */
  realpath(file: string): Promise<string>;
}

/**
 * The part of a file's own status the main process reads to check a path, as Node.js's `Stats` provides it.
 */
export interface IShownPathStatus {
  /**
   * The file's kind and permission bits, as the system holds them.
   */
  readonly mode: number;

  /**
   * Whether the file is a regular file.
   *
   * @example
   * ```ts
   * import type { IShownPathStatus } from "@noldova/desktop.electron";
   *
   * export function isRegular(status: IShownPathStatus): boolean {
   *   return status.isFile();
   * }
   * ```
   */
  isFile(): boolean;

  /**
   * Whether the file is a folder.
   *
   * @example
   * ```ts
   * import type { IShownPathStatus } from "@noldova/desktop.electron";
   *
   * export function isFolder(status: IShownPathStatus): boolean {
   *   return status.isDirectory();
   * }
   * ```
   */
  isDirectory(): boolean;

  /**
   * Whether the file is a link, read without following it.
   *
   * @example
   * ```ts
   * import type { IShownPathStatus } from "@noldova/desktop.electron";
   *
   * export function isLink(status: IShownPathStatus): boolean {
   *   return status.isSymbolicLink();
   * }
   * ```
   */
  isSymbolicLink(): boolean;
}

/**
 * An Electron utility process, as the main process uses one.
 */
export interface IUtilityProcess {
  /**
   * Sends a message to the utility process; messages wait until it is ready.
   *
   * @param message A structured-cloneable value.
   * @example
   * ```ts
   * import type { IUtilityProcess } from "@noldova/desktop.electron";
   *
   * export function ask(child: IUtilityProcess): void {
   *   child.postMessage({ executable: "node", arguments: [], errorFile: "start.log", environment: {} });
   * }
   * ```
   */
  postMessage(message: unknown): void;

  /**
   * Listens once for the utility process's first message or its exit.
   *
   * @param event `message` or `exit`.
   * @param listener Receives the message, or the exit code.
   * @returns The utility process, for chaining.
   * @example
   * ```ts
   * import type { IUtilityProcess } from "@noldova/desktop.electron";
   *
   * export function watch(child: IUtilityProcess, exits: unknown[]): void {
   *   child.once("exit", code => exits.push(code));
   * }
   * ```
   */
  once(event: "message" | "exit", listener: (value: unknown) => void): this;
}

/**
 * Electron's `utilityProcess`, as the main process uses it.
 */
export interface IUtilityProcessHost {
  /**
   * Starts a utility process. Chromium's launcher gives it only the handles it lists, none of the main process's other handles.
   *
   * @param modulePath The script the utility process runs.
   * @param args The script's arguments.
   * @param options The utility process's standard streams, the name it shows in task managers, its environment and,
   * when given, the folder it starts in, which the program it starts inherits.
   * @returns The utility process.
   * @example
   * ```ts
   * import type { IUtilityProcess, IUtilityProcessHost } from "@noldova/desktop.electron";
   *
   * export function start(host: IUtilityProcessHost, script: string): IUtilityProcess {
   *   return host.fork(script, [], { stdio: "ignore", serviceName: "Example", env: process.env });
   * }
   * ```
   */
  fork(modulePath: string, args: string[], options: { stdio: "ignore"; serviceName: string; env: NodeJS.ProcessEnv; cwd?: string }): IUtilityProcess;
}

/**
 * The parts of Electron's main-process API the main process uses, which the real modules satisfy and package tests replace
 * with fakes.
 */
export interface IElectron {
  /**
   * The application's lifecycle.
   */
  readonly app: IApplicationHost;

  /**
   * The main process's side of IPC.
   */
  readonly ipcMain: IIpcHost;

  /**
   * The sessions, for their permission handlers.
   */
  readonly session: ISessionHost;

  /**
   * The protocol module, for registering the scheme of files runtime parts share before the app is ready.
   */
  readonly protocol: ISchemeRegistry;

  /**
   * The application menu.
   */
  readonly menu: IMenuHost;

  /**
   * The system clipboard, for copying text the window asks to copy.
   */
  readonly clipboard: IClipboardHost;

  /**
   * The system's file manager and browser, for opening the log folder and links.
   */
  readonly shell: IShellHost;

  /**
   * Native message boxes, for a window whose page cannot draw.
   */
  readonly dialog: IDialogHost;

  /**
   * The operating system's notifications, for notifications posted while no window is focused.
   */
  readonly notifications: INotificationHost;

  /**
   * The tray, for the icon in the Windows notification area, the macOS menu bar or the Linux tray.
   */
  readonly tray: ITrayHost;

  /**
   * Electron's `globalShortcut`, for the stop key taken system-wide while an agent session is open.
   */
  readonly shortcuts: IShortcutHost;

  /**
   * The system's theme, for the window's icon and the tray icon.
   */
  readonly theme: IThemeHost;

  /**
   * Electron's `autoUpdater`, Squirrel.Mac on macOS, which installs a staged update as the main process quits.
   */
  readonly nativeUpdater: INativeUpdater;

  /**
   * The web views of the windows' module panes.
   */
  readonly webViews: IWebViewEngine;

  /**
   * Electron's `safeStorage`, for encrypting the runtime's secrets with the system's keyring.
   */
  readonly safeStorage: ISecretStorageHost;

  /**
   * The displays, for placing a window on one that shows it.
   */
  readonly screen: IDisplayHost;

  /**
   * Creates a native window.
   *
   * @param options The window's options.
   * @returns The window.
   * @example
   * ```ts
   * import type { IMainProcessWindow, IElectron } from "@noldova/desktop.electron";
   *
   * export function openHidden(electron: IElectron): IMainProcessWindow {
   *   return electron.createWindow({ width: 1280, height: 800, show: false });
   * }
   * ```
   */
  createWindow(options: BrowserWindowConstructorOptions): IMainProcessWindow;
}

/**
 * The exception every exception of the Electron package extends, so that a
 * caller can catch any failure the package raises in one place.
 */
export declare class ElectronException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What failed.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ElectronException } from "@noldova/desktop.electron";
   *
   * export function fail(): never {
   *   throw new ElectronException("The main process could not finish the request.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when this device's identity file cannot be read or holds no valid identity.
 */
export declare class DeviceIdentityException extends ElectronException {
  /**
   * The path of the identity file that cannot be read or holds no valid identity.
   */
  public readonly file: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param file The path of the identity file.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { DeviceIdentityException } from "@noldova/desktop.electron";
   *
   * export const failure: DeviceIdentityException = new DeviceIdentityException("/home/person/.config/noldova-desktop/device.json");
   * ```
   */
  public constructor(file: string, options?: ExceptionOptions);
}

/**
 * This device's identity: a random id the main process creates once and keeps outside the data directory, so state tied
 * to a device, such as window bounds, never travels with the data.
 */
export declare class DeviceIdentity {
  /**
   * Reads the identity from the folder's `device.json`, creating the folder and a new identity when there is none.
   *
   * @param folder The folder that keeps the identity.
   * @returns A promise of the identity, a lowercase UUID.
   * @throws DeviceIdentityException as a rejection when the file cannot be read or holds no valid identity.
   * @example
   * ```ts
   * import { DeviceIdentity } from "@noldova/desktop.electron";
   *
   * export const id: string = await DeviceIdentity.readOrCreateAsync("/home/person/.local/state/noldova/desktop");
   * ```
   */
  public static readOrCreateAsync(folder: string): Promise<string>;
}

/**
 * Where the main process finds the window and its preload, and which platform it runs on.
 */
export declare class MainProcessSettings {
  /**
   * The operating system, as Node.js names it, such as `win32`, `darwin` or `linux`.
   */
  public readonly platform: string;

  /**
   * The built window's `index.html`.
   */
  public readonly windowIndexPath: string;

  /**
   * The compiled preload script the window runs before its page.
   */
  public readonly preloadPath: string;

  /**
   * Creates the settings.
   *
   * @param platform The operating system; not whitespace only.
   * @param windowIndexPath The built window's `index.html`; not whitespace only.
   * @param preloadPath The compiled preload script; not whitespace only.
   * @throws ArgumentException synchronously when a value is empty or whitespace only.
   * @example
   * ```ts
   * import { MainProcessSettings } from "@noldova/desktop.electron";
   *
   * export const settings: MainProcessSettings = new MainProcessSettings("linux", "/repository/_build/window/browser/index.html", "/repository/preload.cjs");
   * ```
   */
  public constructor(platform: string, windowIndexPath: string, preloadPath: string);

  /**
   * Locates the window and the preload relative to the installed main process package.
   *
   * @param moduleDirectory The folder of the main process's compiled entry point.
   * @param platform The operating system.
   * @returns The settings for a build run from the repository.
   * @example
   * ```ts
   * import { MainProcessSettings } from "@noldova/desktop.electron";
   *
   * export const settings: MainProcessSettings = MainProcessSettings.fromModule("/repository/node_modules/@noldova/desktop.electron", "darwin");
   * ```
   */
  public static fromModule(moduleDirectory: string, platform: string): MainProcessSettings;

  /**
   * The `file:` URL of the window's `index.html`, the only page the window may show.
   */
  public get windowUrl(): string;

  /**
   * Whether the platform is macOS.
   */
  public get isMac(): boolean;
}

/**
 * The work area of one display, in screen pixels.
 */
export declare class ScreenArea {
  /**
   * The left edge.
   */
  public readonly x: number;

  /**
   * The top edge.
   */
  public readonly y: number;

  /**
   * The width.
   */
  public readonly width: number;

  /**
   * The height.
   */
  public readonly height: number;

  /**
   * Creates the area.
   *
   * @param x The left edge.
   * @param y The top edge.
   * @param width The width.
   * @param height The height.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/desktop.electron";
   *
   * export const area: ScreenArea = new ScreenArea(0, 0, 1920, 1040);
   * ```
   */
  public constructor(x: number, y: number, width: number, height: number);

  /**
   * Makes the area of a rectangle, such as a display's work area.
   *
   * @param rectangle The rectangle.
   * @returns The area.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/desktop.electron";
   *
   * export const area: ScreenArea = ScreenArea.of({ x: 0, y: 25, width: 1024, height: 743 });
   * ```
   */
  public static of(rectangle: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): ScreenArea;

  /**
   * Counts the pixels a rectangle shares with the area.
   *
   * @param x The rectangle's left edge.
   * @param y The rectangle's top edge.
   * @param width The rectangle's width.
   * @param height The rectangle's height.
   * @returns The number of shared pixels, 0 when the rectangle does not overlap the area.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/desktop.electron";
   *
   * export const shared: number = new ScreenArea(0, 0, 1920, 1040).overlapArea(1900, 100, 800, 600);
   * ```
   */
  public overlapArea(x: number, y: number, width: number, height: number): number;

  /**
   * Tells whether a size fits in the area.
   *
   * @param width The width.
   * @param height The height.
   * @returns `true` when neither side is larger than the area's.
   * @example
   * ```ts
   * import { ScreenArea } from "@noldova/desktop.electron";
   *
   * export const fits: boolean = new ScreenArea(0, 25, 1024, 743).fits(1280, 800);
   * ```
   */
  public fits(width: number, height: number): boolean;
}

/**
 * The frame that sent an IPC message.
 */
export declare class SenderInfo {
  /**
   * The URL of the sending frame.
   */
  public readonly frameUrl: string;

  /**
   * Whether the frame is the window's main frame.
   */
  public readonly isTopLevel: boolean;

  /**
   * The id of the sending web contents.
   */
  public readonly contentsId: number;

  /**
   * Creates the description.
   *
   * @param frameUrl The URL of the sending frame.
   * @param isTopLevel Whether the frame is the main frame.
   * @param contentsId The id of the sending web contents.
   * @example
   * ```ts
   * import { SenderInfo } from "@noldova/desktop.electron";
   *
   * export const sender: SenderInfo = new SenderInfo("file:///repository/_build/window/browser/index.html", true, 1);
   * ```
   */
  public constructor(frameUrl: string, isTopLevel: boolean, contentsId: number);
}

/**
 * Where starting the runtime stands, with what the window shows for it: the location of data from before the shell,
 * the descriptions of an older build's work, a newer build's version, or why the runtime could not start.
 */
export declare class StartupState {
  /**
   * Where starting stands.
   */
  public readonly kind: StartupStateKind;

  /**
   * What the window shows for it; empty for {@link StartupStateKind.Connecting} and {@link StartupStateKind.Ready}.
   */
  public readonly details: readonly string[];

  private constructor();

  /**
   * The state while starting or attaching.
   *
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.connecting();
   * ```
   */
  public static connecting(): StartupState;

  /**
   * The state when data from before the shell must be moved aside first.
   *
   * @param location Where the data is.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.preShellData("/home/person/.noldova/desktop");
   * ```
   */
  public static preShellData(location: string): StartupState;

  /**
   * The state when an older build's runtime has work in progress.
   *
   * @param descriptions The work.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.workInProgress(["A reply"]);
   * ```
   */
  public static workInProgress(descriptions: readonly string[]): StartupState;

  /**
   * The state while waiting for an older build's work.
   *
   * @param descriptions The work still in progress.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.waitingForWork(["A reply"]);
   * ```
   */
  public static waitingForWork(descriptions: readonly string[]): StartupState;

  /**
   * The state when a newer build's runtime owns the data directory and this build cannot start it.
   *
   * @param version The newer build's product version.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.newerBuild("2.0.0");
   * ```
   */
  public static newerBuild(version: string): StartupState;

  /**
   * The state when the runtime could not be started or reached.
   *
   * @param message Why.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.failed("The runtime did not start in time.");
   * ```
   */
  public static failed(message: string): StartupState;

  /**
   * The state while Noldova Desktop Sample saves the window's work and closes for an update.
   *
   * @param version The version being installed.
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.updating("0.3.0");
   * ```
   */
  public static updating(version: string): StartupState;

  /**
   * The state once connected.
   *
   * @returns The state.
   * @example
   * ```ts
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const state: StartupState = StartupState.ready();
   * ```
   */
  public static ready(): StartupState;

  /**
   * Writes the state for the window.
   *
   * @returns The JSON form: `kind` and `details`.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { StartupState } from "@noldova/desktop.electron";
   *
   * export const json: JsonObject = StartupState.failed("The runtime did not start in time.").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The colors and title-bar height the window painted, which the main process gives its native title bar
 * before it shows the window.
 */
export declare class WindowAppearance {
  /**
   * The window's background color.
   */
  public readonly background: string;

  /**
   * The title bar's color.
   */
  public readonly titleBar: string;

  /**
   * The title bar's text and symbol color.
   */
  public readonly titleBarText: string;

  /**
   * The title bar's height in device-independent pixels.
   */
  public readonly titleBarHeight: number;

  /**
   * Creates the appearance.
   *
   * @param background A hexadecimal, `rgb()` or `rgba()` color.
   * @param titleBar A hexadecimal, `rgb()` or `rgba()` color.
   * @param titleBarText A hexadecimal, `rgb()` or `rgba()` color.
   * @param titleBarHeight A positive whole number of pixels.
   * @throws ArgumentException synchronously for a color in another form.
   * @throws ArgumentOutOfRangeException synchronously for a height that is not a positive integer.
   * @example
   * ```ts
   * import { WindowAppearance } from "@noldova/desktop.electron";
   *
   * export const appearance: WindowAppearance = new WindowAppearance("#181818", "#181818", "#CCCCCC", 32);
   * ```
   */
  public constructor(background: string, titleBar: string, titleBarText: string, titleBarHeight: number);

  /**
   * Reads an appearance received from the window.
   *
   * @param value The untrusted message payload.
   * @returns The appearance.
   * @throws JsonException synchronously when the payload is not an appearance, naming the field.
   * @example
   * ```ts
   * import { WindowAppearance } from "@noldova/desktop.electron";
   *
   * export const appearance: WindowAppearance = WindowAppearance.fromJson({ background: "#F8F8F8", titleBar: "#F8F8F8", titleBarText: "#1E1E1E", titleBarHeight: 32 });
   * ```
   */
  public static fromJson(value: unknown): WindowAppearance;

  /**
   * Writes the appearance as the window sends it.
   *
   * @returns The appearance as JSON.
   * @example
   * ```ts
   * import { WindowAppearance } from "@noldova/desktop.electron";
   *
   * export const message: string = JSON.stringify(new WindowAppearance("#181818", "#181818", "#CCCCCC", 32).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A window's place and size on the screen, as the main process saves and restores it.
 */
export declare class WindowState {
  /**
   * The left edge in screen pixels, or `null` to let the operating system place the window.
   */
  public readonly x: number | null;

  /**
   * The top edge in screen pixels, or `null` to let the operating system place the window.
   */
  public readonly y: number | null;

  /**
   * The width in pixels.
   */
  public readonly width: number;

  /**
   * The height in pixels.
   */
  public readonly height: number;

  /**
   * Whether the window is maximized; the other values then describe its normal bounds.
   */
  public readonly isMaximized: boolean;

  /**
   * Creates the state.
   *
   * @param x The left edge, an integer, or `null` together with `y`.
   * @param y The top edge, an integer, or `null` together with `x`.
   * @param width The width; an integer of at least the window's minimum width, 640.
   * @param height The height; an integer of at least the window's minimum height, 480.
   * @param isMaximized Whether the window is maximized.
   * @throws ArgumentException synchronously when only one coordinate is given.
   * @throws ArgumentOutOfRangeException synchronously for a coordinate that is not an integer or a size below the
   * minimum.
   * @example
   * ```ts
   * import { WindowState } from "@noldova/desktop.electron";
   *
   * export const state: WindowState = new WindowState(100, 80, 1280, 800, false);
   * ```
   */
  public constructor(x: number | null, y: number | null, width: number, height: number, isMaximized: boolean);

  /**
   * The state of a window that has not been placed yet: 1280 by 800 pixels, but no more than nine tenths of the work area
   * on each side and no less than the minimum size, where the operating system puts it.
   *
   * @param area The work area of the display the window opens on.
   * @returns The default state.
   * @example
   * ```ts
   * import { ScreenArea, WindowState } from "@noldova/desktop.electron";
   *
   * export const state: WindowState = WindowState.createDefault(new ScreenArea(0, 25, 1024, 743));
   * ```
   */
  public static createDefault(area: ScreenArea): WindowState;

  /**
   * Reads a saved state, growing a size below the window's minimum to it.
   *
   * @param value The saved JSON.
   * @returns The state.
   * @throws JsonException synchronously when the value is not a valid state, naming the field.
   * @example
   * ```ts
   * import { WindowState } from "@noldova/desktop.electron";
   *
   * export const state: WindowState = WindowState.fromJson({ x: null, y: null, width: 1280, height: 800, maximized: true });
   * ```
   */
  public static fromJson(value: unknown): WindowState;

  /**
   * Places the state's bounds on the connected displays. Bounds that a display shows and that fit its work area are kept,
   * on the display that shows most of them, when at least 160 pixels of their top row lie on one work area; otherwise
   * they move by the least into that display's work area, so the window's title row stays in reach. Otherwise the window is centered on that display, or on the primary display
   * when no display shows it or it has no position; a size that fits the work area is kept, and a larger one shrinks to no
   * more than nine tenths of the work area on each side.
   *
   * @param workAreas The work areas of the connected displays.
   * @param primary The work area of the primary display.
   * @returns The bounds to apply.
   * @example
   * ```ts
   * import { ScreenArea, WindowState } from "@noldova/desktop.electron";
   *
   * const primary: ScreenArea = new ScreenArea(0, 0, 1920, 1040);
   * export const bounds: ScreenArea = new WindowState(3000, 100, 1280, 800, false).placeOn([primary], primary);
   * ```
   */
  public placeOn(workAreas: readonly ScreenArea[], primary: ScreenArea): ScreenArea;

  /**
   * Writes the state for saving.
   *
   * @returns The state as JSON.
   * @example
   * ```ts
   * import { ScreenArea, WindowState } from "@noldova/desktop.electron";
   *
   * export const saved: string = JSON.stringify(WindowState.createDefault(new ScreenArea(0, 0, 1920, 1040)).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Runs the command line through the app's own program in Node mode, for a package that has no command of its own, such
 * as the AppImage: `<App>.AppImage --command-line <args>` answers like the command, opening no window. The main process
 * checks for the flag before anything else, takes only the arguments after it, runs the command line to its end while
 * holding its own thread, so Chromium never goes on to set up its display, and exits with the command line's exit code.
 */
export declare class CommandLineRelay {
  /**
   * Creates the relay.
   *
   * @param run Runs the command line's process to its end, as `child_process.spawnSync` does.
   * @param program The app's program, which runs the entry with `ELECTRON_RUN_AS_NODE=1`.
   * @param entry The command line's entry script.
   * @param environment The command line's environment, to which the relay adds `ELECTRON_RUN_AS_NODE=1`.
   * @param error Where the relay writes that the command line could not start.
   * @example
   * ```ts
   * import { spawnSync } from "node:child_process";
   *
   * import { CommandLineRelay } from "@noldova/desktop.electron";
   *
   * export const relay: CommandLineRelay = new CommandLineRelay((program, args, options) => spawnSync(program, [...args], options), process.execPath,
   *   "/opt/Sample/resources/app.asar/node_modules/@noldova/desktop.cli/services/cli-entry.js", process.env, process.stderr);
   * ```
   */
  public constructor(run: (program: string, programArguments: readonly string[], options: SpawnSyncOptions) => SpawnSyncReturns<string | Buffer>, program: string, entry: string,
    environment: NodeJS.ProcessEnv, error: Writable);

  /**
   * Reads the command line's arguments from the main process's arguments.
   *
   * @param argv The main process's arguments.
   * @returns The arguments after the first `--command-line`, or `null` when there is none.
   * @example
   * ```ts
   * import { CommandLineRelay } from "@noldova/desktop.electron";
   *
   * export const commandLine: readonly string[] | null = CommandLineRelay.readArguments(process.argv);
   * ```
   */
  public static readArguments(argv: readonly string[]): readonly string[] | null;

  /**
   * Runs the command line with the arguments to its end, sharing the main process's standard input, output and error.
   *
   * @param commandArguments The command line's arguments.
   * @returns The command line's exit code; 128 plus the signal's number when a signal ended it, and 1 when it could not start or nothing says how it ended.
   * @example
   * ```ts
   * import type { CommandLineRelay } from "@noldova/desktop.electron";
   *
   * export function relayStatus(relay: CommandLineRelay): number {
   *   return relay.relay(["status", "--json"]);
   * }
   * ```
   */
  public relay(commandArguments: readonly string[]): number;
}

/**
 * Asks one window to save before it closes, and decides whether it may close: a window that reports a failed save
 * stays open, while a window that is gone or does not answer in time does not block closing.
 */
export declare class CloseCoordinator {
  /**
   * Creates the coordinator.
   *
   * @param send Sends a close request with its id to the window; returns `false` when the window is gone.
   * @param timeout How long to wait for an answer, in milliseconds; a positive integer.
   * @throws ArgumentOutOfRangeException synchronously when the timeout is not a positive integer.
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/desktop.electron";
   *
   * export const coordinator: CloseCoordinator = new CloseCoordinator(() => true, 5000);
   * ```
   */
  public constructor(send: (requestId: string) => boolean, timeout: number);

  /**
   * Asks the window to save.
   *
   * @returns A promise of `true` when the window may close: it saved, it is gone or it did not answer in time; `false`
   * when it reported a failed save.
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/desktop.electron";
   *
   * const coordinator = new CloseCoordinator(t => coordinator.answer(t, true), 5000);
   * export const canClose: boolean = await coordinator.requestAsync();
   * ```
   */
  public requestAsync(): Promise<boolean>;

  /**
   * Takes the window's answer to a request.
   *
   * @param requestId The request's id, as the window sent it.
   * @param isSaved Whether the window saved.
   * @returns `true` when the answer settled a waiting request; `false` for an unknown or late id or a malformed answer.
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/desktop.electron";
   *
   * export const isAccepted: boolean = new CloseCoordinator(() => true, 5000).answer("unknown", true);
   * ```
   */
  public answer(requestId: unknown, isSaved: unknown): boolean;

  /**
   * Lets every waiting request close, as when the window is gone.
   *
   * @example
   * ```ts
   * import { CloseCoordinator } from "@noldova/desktop.electron";
   *
   * new CloseCoordinator(() => true, 5000).release();
   * ```
   */
  public release(): void;
}

/**
 * Asks in the window where an update began whether to wait for the work in progress or to stop it, listing the work by
 * data directory. Waiting keeps the list current, reading the work again each time a runtime reports a change of its
 * work or disconnects, and goes on once none is left; Cancel, or a window that can no longer ask, ends the update with
 * nothing changed.
 */
export declare class UpdateWorkQuestion {
  /**
   * Creates the question.
   *
   * @param prompt The window that asks.
   * @param readWorkAsync Reads the work again while the person waits; a runtime that has gone leaves the list.
   * @param waitForChangeAsync Resolves once the work may have changed since the last reading, at once when a change
   * came meanwhile, or rejects when the signal aborts.
   * @example
   * ```ts
   * import { type IQuitPrompt, UpdateWorkQuestion } from "@noldova/desktop.electron";
   *
   * export function create(prompt: IQuitPrompt, readWorkAsync: () => Promise<readonly string[]>, waitForChangeAsync: (signal: AbortSignal) => Promise<void>): UpdateWorkQuestion {
   *   return new UpdateWorkQuestion(prompt, readWorkAsync, waitForChangeAsync);
   * }
   * ```
   */
  public constructor(prompt: IQuitPrompt, readWorkAsync: () => Promise<readonly string[]>, waitForChangeAsync: (signal: AbortSignal) => Promise<void>);

  /**
   * Shows the question and settles with the person's choice. It asks once; withdraws the question when it settles.
   *
   * @param work The work in progress, each named with its data directory.
   * @returns A promise of the work the person agreed to stop: the list shown when they chose Stop, or empty when they
   * waited until none was left, which agrees to nothing; `null` when they cancelled.
   * @throws Error Rejected with the error of a reading that fails while the person waits.
   * @example
   * ```ts
   * import type { UpdateWorkQuestion } from "@noldova/desktop.electron";
   *
   * export function askAsync(question: UpdateWorkQuestion): Promise<readonly string[] | null> {
   *   return question.askAsync(["Indexing the project (/work/data)"]);
   * }
   * ```
   */
  public askAsync(work: readonly string[]): Promise<readonly string[] | null>;

  /**
   * Takes the person's choice from the window that asks.
   *
   * @param prompt The window that answered.
   * @param choice `Wait`, `Stop` or `Cancel`.
   * @returns `true` when the answer was taken; `false` for another window, an unknown choice, a second Wait or a
   * question already settled.
   * @example
   * ```ts
   * import { type IQuitPrompt, QuitChoice, type UpdateWorkQuestion } from "@noldova/desktop.electron";
   *
   * export function stop(question: UpdateWorkQuestion, prompt: IQuitPrompt): boolean {
   *   return question.answer(prompt, QuitChoice.Stop);
   * }
   * ```
   */
  public answer(prompt: IQuitPrompt, choice: unknown): boolean;

  /**
   * Ends the question with no answer once the window that asks closes, so the restart is cancelled rather than left
   * waiting for good.
   *
   * @param prompt The window that closed; any other window changes nothing.
   * @example
   * ```ts
   * import type { IQuitPrompt, UpdateWorkQuestion } from "@noldova/desktop.electron";
   *
   * export function closed(question: UpdateWorkQuestion, prompt: IQuitPrompt): void {
   *   question.dismiss(prompt);
   * }
   * ```
   */
  public dismiss(prompt: IQuitPrompt): void;
}

/**
 * Asks one window to save before Noldova Desktop Sample stops for an update, and collects what did not save: a window that is gone
 * or does not answer in time counts as not saved, since an update is never worth an unsaved change.
 */
export declare class UpdateSaveCoordinator {
  /**
   * Creates the coordinator.
   *
   * @param send Sends a save request with its id to the window; returns `false` when the window is gone.
   * @param timeout How long to wait for an answer, in milliseconds; a positive integer.
   * @throws ArgumentOutOfRangeException synchronously when the timeout is not a positive integer.
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/desktop.electron";
   *
   * export const coordinator: UpdateSaveCoordinator = new UpdateSaveCoordinator(() => true, 5000);
   * ```
   */
  public constructor(send: (requestId: string) => boolean, timeout: number);

  /**
   * Asks the window to save.
   *
   * @param window The window's number among the main process's open windows, from 1, which names it when it is gone or
   * does not answer.
   * @returns A promise of what did not save: the window's own list, or one problem naming the window when it is gone
   * or did not answer in time; empty when everything saved.
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/desktop.electron";
   *
   * const coordinator = new UpdateSaveCoordinator(t => coordinator.answer(t, []), 5000);
   * export const problems: readonly string[] = await coordinator.requestAsync(1);
   * ```
   */
  public requestAsync(window: number): Promise<readonly string[]>;

  /**
   * Takes the window's answer to a request.
   *
   * @param requestId The request's id, as the window sent it.
   * @param problems What the window could not save, as text.
   * @returns `true` when the answer settled a waiting request; `false` for an unknown or late id or a malformed answer.
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/desktop.electron";
   *
   * export const isAccepted: boolean = new UpdateSaveCoordinator(() => true, 5000).answer("unknown", []);
   * ```
   */
  public answer(requestId: unknown, problems: unknown): boolean;

  /**
   * Settles every waiting request as not saved, as when the window is gone.
   *
   * @example
   * ```ts
   * import { UpdateSaveCoordinator } from "@noldova/desktop.electron";
   *
   * new UpdateSaveCoordinator(() => true, 5000).release();
   * ```
   */
  public release(): void;
}

/**
 * One open window: it shows once its page has painted and its startup has settled, or unpainted after a limit; asks
 * its guard whether it may close, then its page to save; and keeps its bounds.
 */
export declare class OpenWindow implements IQuitPrompt {
  /**
   * The native window.
   */
  public readonly window: IMainProcessWindow;

  /**
   * Asks the page to save before the window closes.
   */
  public readonly coordinator: CloseCoordinator;

  /**
   * Asks the page to save before Noldova Desktop Sample stops for an update.
   */
  public readonly updateSaves: UpdateSaveCoordinator;

  /**
   * Restores and keeps the window's bounds.
   */
  public readonly bounds: WindowBoundsKeeper;

  /**
   * Limits how many errors from the window's page reach the main process log: ten a minute, then one notice.
   */
  public readonly errors: WindowErrorLimit;

  /**
   * The appearance the window was last painted in, or `null` until it is painted.
   */
  public appearance: WindowAppearance | null;

  /**
   * Takes charge of a window that is not yet shown.
   *
   * @param window The window, created hidden.
   * @param displays The displays, for placing restored bounds.
   * @param log Records why a window was shown unpainted and saves that failed.
   * @param guard Decides whether the window may close, or quits Noldova Desktop Sample instead.
   * @param platform The operating system's name, as Node reports it.
   * @param isPlacedByCompositor Whether the system places each window it shows, as a Wayland compositor does, so the
   * window's bounds keep the saved position rather than the system's; false when left out.
   * @example
   * ```ts
   * import { type ICloseGuard, type IMainProcessLog, type IMainProcessWindow, type IDisplayHost, OpenWindow } from "@noldova/desktop.electron";
   *
   * export function track(window: IMainProcessWindow, displays: IDisplayHost, log: IMainProcessLog, guard: ICloseGuard): OpenWindow {
   *   return new OpenWindow(window, displays, log, guard, "win32");
   * }
   * ```
   */
  public constructor(window: IMainProcessWindow, displays: IDisplayHost, log: IMainProcessLog, guard: ICloseGuard, platform: string, isPlacedByCompositor?: boolean);

  /**
   * Shows the page the question about work in progress, or takes it away.
   *
   * @param question The question, or `null` to take it away.
   * @returns Whether the page can show it: false when the window is gone or its page has crashed.
   * @example
   * ```ts
   * import { type OpenWindow, QuitQuestion } from "@noldova/desktop.electron";
   *
   * export function ask(open: OpenWindow): boolean {
   *   return open.show(new QuitQuestion(["Indexing the project"], false, false));
   * }
   * ```
   */
  public show(question: QuitQuestion | null): boolean;

  /**
   * Whether the page has really painted. It stays false for a window shown unpainted when its paint wait ran out.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function isPainted(open: OpenWindow): boolean {
   *   return open.isPagePainted;
   * }
   * ```
   */
  public get isPagePainted(): boolean;

  /**
   * Notes that the page has painted, and shows the window if its startup has settled.
   * When the window was already shown unpainted, it logs how long after opening the page painted.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function painted(open: OpenWindow): void {
   *   open.markPainted();
   * }
   * ```
   */
  public markPainted(): void;

  /**
   * Waits until the page has painted, or the window was shown unpainted.
   *
   * @returns A promise of `true` then, or `false` when the window closed first.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function readyAsync(open: OpenWindow): Promise<boolean> {
   *   return open.whenPaintedAsync();
   * }
   * ```
   */
  public whenPaintedAsync(): Promise<boolean>;

  /**
   * Waits until the page has really painted, which may come after the window was shown unpainted.
   *
   * @returns A promise of `true` then, or `false` when the window closed first.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function paintedAsync(open: OpenWindow): Promise<boolean> {
   *   return open.whenPagePaintedAsync();
   * }
   * ```
   */
  public whenPagePaintedAsync(): Promise<boolean>;

  /**
   * Asks the page to save, as closing does, then saves the window's bounds. A page that has crashed counts as saved
   * at once, and so does one that does not answer within five seconds.
   *
   * @returns A promise of whether the page saved; a failed bounds save is logged and does not count.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function saveAsync(open: OpenWindow): Promise<boolean> {
   *   return open.saveAsync();
   * }
   * ```
   */
  public saveAsync(): Promise<boolean>;

  /**
   * Closes the window at once, without its guard or another save, because Noldova Desktop Sample is exiting.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function exit(open: OpenWindow): void {
   *   open.closeNow();
   * }
   * ```
   */
  public closeNow(): void;

  /**
   * Settles the startup after a delay, whatever the runtime does by then.
   *
   * @param milliseconds The delay.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function settleSoon(open: OpenWindow): void {
   *   open.settleWithin(2_000);
   * }
   * ```
   */
  public settleWithin(milliseconds: number): void;

  /**
   * Notes that the startup has settled, and shows the window if its page has painted.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function settled(open: OpenWindow): void {
   *   open.settle();
   * }
   * ```
   */
  public settle(): void;

  /**
   * Shows the window after a limit even when its page has not painted by then, settling its startup, and records why:
   * the page is still loading, has crashed, or loaded without reporting its paint.
   *
   * @param milliseconds The limit.
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function showWithin(open: OpenWindow): void {
   *   open.showUnpaintedWithin(10_000);
   * }
   * ```
   */
  public showUnpaintedWithin(milliseconds: number): void;

  /**
   * Shows the window now, painted or not, settling its startup.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function showAtOnce(open: OpenWindow): void {
   *   open.showNow();
   * }
   * ```
   */
  public showNow(): void;

  /**
   * Brings the window forward, restoring it when minimized. A window not shown yet is left to show once it is
   * painted and settled, so focusing it never shows it early: it shows focused then, maximized when its restored
   * bounds were.
   *
   * @example
   * ```ts
   * import type { OpenWindow } from "@noldova/desktop.electron";
   *
   * export function bringForward(open: OpenWindow): void {
   *   open.focus();
   * }
   * ```
   */
  public focus(): void;
}

/**
 * Checks the installation's launch barrier when the main process starts, before it opens a window. While another main process
 * holds the barrier, it tells the person with the operating system's message box that Noldova Desktop Sample is installing an update,
 * and the main process exits. A barrier whose holder is gone after a handoff to another version may mean an installer is
 * still running, so it asks the person and removes the barrier only when they choose to open Noldova Desktop Sample. A barrier left
 * before the handoff is removed silently, and the main process's log says so.
 */
export declare class UpdateBarrierGate {
  /**
   * Creates the gate.
   *
   * @param installation The installation whose launch barrier it checks.
   * @param productVersion The main process's product version, which settles a barrier handed off to it.
   * @param dialog Shows the operating system's message box.
   * @param log Writes a line to the main process's log.
   * @example
   * ```ts
   * import { type IDialogHost, UpdateBarrierGate } from "@noldova/desktop.electron";
   * import type { Installation } from "@noldova/desktop.runtime";
   *
   * export function create(installation: Installation, dialog: IDialogHost): UpdateBarrierGate {
   *   return new UpdateBarrierGate(installation, "0.2.0", dialog, t => console.log(t));
   * }
   * ```
   */
  public constructor(installation: Pick<Installation, "readAsync" | "readTextAsync" | "checkAsync" | "removeAsync">, productVersion: string, dialog: Pick<IDialogHost, "showMessageBox">, log: (text: string) => void);

  /**
   * Checks the barrier and, when it holds, asks as {@link askAsync} does. A barrier that cannot be read lets the
   * main process start, and the runtime's launch reports it.
   *
   * @returns A promise of `true` when the main process may start, `false` when it exits.
   * @throws Error Rejected when the message box fails or the barrier cannot be removed.
   * @example
   * ```ts
   * import type { UpdateBarrierGate } from "@noldova/desktop.electron";
   *
   * export async function startAsync(gate: UpdateBarrierGate, open: () => void): Promise<void> {
   *   if (await gate.passAsync())
   *     open();
   * }
   * ```
   */
  public passAsync(): Promise<boolean>;

  /**
   * Tells the person what a barrier means: `Held` shows that Noldova Desktop Sample is installing an update, with OK; `Unfinished`
   * asks with Quit, the default, and Open Noldova Desktop Sample; `None` asks nothing. Open Noldova Desktop Sample reads and judges the barrier
   * again, since the person may have taken minutes, and removes it only while it is unchanged: a barrier that holds
   * by then is reported as `Held` is, and one that replaced it is judged in turn. When it cannot be removed, the
   * main process's log says why and an error box tells the person that Noldova Desktop Sample will quit.
   *
   * @param status What the barrier means for this installation.
   * @returns A promise of `true` when the main process may start, `false` when it exits.
   * @throws Error Rejected when a message box fails.
   * @example
   * ```ts
   * import type { UpdateBarrierGate } from "@noldova/desktop.electron";
   * import { UpdateBarrierStatus } from "@noldova/desktop.runtime";
   *
   * export function askAsync(gate: UpdateBarrierGate): Promise<boolean> {
   *   return gate.askAsync(UpdateBarrierStatus.Unfinished);
   * }
   * ```
   */
  public askAsync(status: UpdateBarrierStatus): Promise<boolean>;
}

/**
 * Ends the main process when its main process fails with an exception it does not catch or a rejection it does not handle,
 * because its state can no longer be trusted. It records each failure with its stack and asks once, with a native
 * message box of its own, whether to restart the application or quit, exiting with 0 either way; the log folder opens on
 * request and the box asks again. Until the main process log and its folder are attached, records go redacted to standard
 * error and the box offers only restarting or quitting. Restarting relaunches the application and exits; quitting exits.
 * Both exit at once, without the windows' close guard or the quit question, which would run through the failed process;
 * work in the runtime goes on. A box that cannot be shown is recorded, and the application exits with 1.
 */
export declare class MainProcessRecovery {
  /**
   * Prepares the recovery, before anything else the main process does; the main process passes each failure to
   * {@link MainProcessRecovery.receive}.
   *
   * @param app Waits until the application is ready, relaunches it and exits.
   * @param dialog Shows the message box.
   * @param errorOutput Receives the records until a log is attached.
   * @param redactor Redacts those records.
   * @example
   * ```ts
   * import { type IApplicationHost, type IMainProcessEnvironment, type IDialogHost, MainProcessFailureKind, MainProcessRecovery } from "@noldova/desktop.electron";
   * import { DiagnosticRedactor } from "@noldova/desktop.runtime";
   *
   * export function install(app: IApplicationHost, dialog: IDialogHost, mainProcess: IMainProcessEnvironment): MainProcessRecovery {
   *   const recovery = new MainProcessRecovery(app, dialog, mainProcess.errorOutput, new DiagnosticRedactor(mainProcess.homeFolder));
   *   mainProcess.onUncaughtException(error => recovery.receive(error, MainProcessFailureKind.UncaughtException));
   *   mainProcess.onUnhandledRejection(reason => recovery.receive(reason, MainProcessFailureKind.UnhandledRejection));
   *   return recovery;
   * }
   * ```
   */
  public constructor(app: IApplicationHost, dialog: IDialogHost, errorOutput: Writable, redactor: DiagnosticRedactor);

  /**
   * Records later failures and choices in the main process log, offers its folder in the box, and releases the main process's
   * watchers and helper programs before it exits, logging a release that fails.
   *
   * @param log The main process log.
   * @param openLogFolderAsync Opens the log folder; its promise tells whether it opened.
   * @param release Stops what the main process started that would outlive it, as a quit does.
   * @example
   * ```ts
   * import type { IMainProcessLog, MainProcessRecovery } from "@noldova/desktop.electron";
   *
   * export function attach(recovery: MainProcessRecovery, log: IMainProcessLog): void {
   *   recovery.attach(log, () => Promise.resolve(true), () => undefined);
   * }
   * ```
   */
  public attach(log: IMainProcessLog, openLogFolderAsync: () => Promise<boolean>, release: () => void): void;

  /**
   * Records a failure and, for the first one, asks the person whether to restart or quit. The box shows the message
   * of an {@link UnusableFolderException} before its advice.
   *
   * @param error The error or the rejection's reason, recorded with its stack.
   * @param kind How the main process failed.
   * @example
   * ```ts
   * import { MainProcessFailureKind, type MainProcessRecovery } from "@noldova/desktop.electron";
   *
   * export function fail(recovery: MainProcessRecovery): void {
   *   recovery.receive(new Error("The main process failed."), MainProcessFailureKind.UncaughtException);
   * }
   * ```
   */
  public receive(error: unknown, kind: MainProcessFailureKind): void;
}

/**
 * Keeps a window usable when its page's renderer process is gone or stops responding. It records each episode, its
 * outcome and the person's choice in the main process log, and asks with a native message box, because the page cannot draw:
 * a gone page offers Reload or Quit, or the log folder and Quit when it went again soon after a reload, so a page that
 * fails while loading never becomes a loop; a page that stops responding offers Wait or Reload once per episode, and the
 * box closes when the page responds again. Reload ends the page's renderer and reloads once it has gone; a renderer that
 * has not gone within a limit has its process ended, and a page with no renderer process of its own to end, or whose
 * process cannot be ended, is reloaded at once.
 */
export declare class WindowRecovery {
  /**
   * Starts watching a window.
   *
   * @param open The window.
   * @param dialog Shows the message boxes.
   * @param log Records each episode, its outcome and the person's choice.
   * @param process Ends a renderer process that did not stop when asked.
   * @param quit Quits the application.
   * @param openLogFolderAsync Opens the log folder; its promise tells whether it opened.
   * @param reloadCrashLimit How soon after a reload a page that goes again is offered the log folder instead, in
   * milliseconds.
   * @param rendererEndLimit How long a renderer asked to stop may take before its process is ended, in milliseconds.
   * @param now Reads the time in milliseconds, to tell how long ago the last reload was; `Date.now` by default.
   * @example
   * ```ts
   * import { type IMainProcessLog, type IMainProcessEnvironment, type IDialogHost, type OpenWindow, WindowRecovery } from "@noldova/desktop.electron";
   *
   * export function recover(open: OpenWindow, dialog: IDialogHost, log: IMainProcessLog, mainProcess: IMainProcessEnvironment): WindowRecovery {
   *   return new WindowRecovery(open, dialog, log, mainProcess, () => process.exit(0), () => Promise.resolve(true), 10_000, 5_000);
   * }
   * ```
   */
  public constructor(
    open: OpenWindow,
    dialog: IDialogHost,
    log: IMainProcessLog,
    process: IMainProcessEnvironment,
    quit: () => void,
    openLogFolderAsync: () => Promise<boolean>,
    reloadCrashLimit: number,
    rendererEndLimit: number,
    now?: () => number);
}

/**
 * The Electron main process: one sandboxed instance with one window, which it shows once the page has painted its
 * theme, or unpainted after ten seconds, and closes once the page has saved. Closing the last window quits it, except
 * on macOS and while its tray icon shows, where it keeps running and says so once on the device; a quit saves every
 * window before it asks the runtime to stop. It records its diagnostics in `logs/main.log` once the data directory
 * is usable, and on standard error.
 */
export declare class MainProcess {
  private constructor();

  /**
   * Starts the main process: chooses the data directory and keeps Electron's profile in its `mainProcess` folder (unless
   * `--user-data-dir=` gives one), claims the single-instance lock, checks the launch barrier and, once it passes, starts
   * or attaches to the runtime at once, without waiting for Electron, which runs from the main process's program in Node
   * mode. It opens the window when Electron is ready; the window reads the start's state as it loads and gets the runtime
   * events held until then, so the window works the same whether the runtime is ready before it or after. The files it reads
   * before Electron is ready (the folders a restarted version kept, the app's icons, the checkout's path and the shipped
   * dictionaries) are read without blocking, so an ES module entry point awaits the returned promise at its top level,
   * which Electron waits for before it becomes ready.
   *
   * @param electron Electron's main-process API.
   * @param process The main process's process; `--data-dir=` in its arguments gives the data directory.
   * @param moduleUrl The URL of the main process's compiled entry point, which locates the window, the preload and, in a
   * development run, the checkout.
   * @param createLauncher Creates the runtime launcher for the chosen settings and the installation, in the device folder, that the main process's program belongs to;
   * the launcher's log is the main process's.
   * @param readDeviceAsync Reads this device's identity from a folder: the one `--device-dir=` in the process's
   * arguments gives, otherwise the operating system's local application data. A failure leaves window bounds unkept.
   * @param createDeviceFile Creates the store of one of this device's files in the same folder: `appearance.json`, the
   * last appearance preferences, which the main process reads before it opens a window, so the window's first frame already
   * has them, and keeps as the window reports them; and `device-state.json`, which records the one-time hints the
   * device has shown and the value of `desktop.trayIcon` the main process follows, so the icon starts from it.
   * @param createPathCommand Creates the service that links the command line on the macOS PATH for the program the
   * main process runs from; the window's "Install command in PATH" command runs it and shows what happened.
   * @param recordMainProcessAsync Records this main process in its installation, as {@link MainProcessRecord.recordAsync} does, while
   * the main process checks the launch barrier, so an update waits for it to quit. A main process it could not record is logged
   * and starts anyway.
   * @param createUpdater Creates the updater of the installation and the handoff of its platform, given whether the
   * main process runs from a packaged build and the data directory's `logs` folder for the handoff's programs, or gives
   * `null` for a build that names no update feed, whose updates stay Off; the updater's log is the main process's. The
   * {@link UpdateController} it drives keeps `update-ready.json` in the installation's folder, follows
   * `desktop.updateChecks`, pushes each state on `desktop:updateState` and posts `desktop.updateReady` once over the
   * runtime connection. Before the updater starts, the handoff removes what an earlier one left. Restart to update runs
   * an {@link UpdateStop} that connects through an {@link UpdateTargetConnector}, asks section 9's question in a window
   * through an {@link UpdateWorkQuestion} and calls the handoff, with an {@link AppImageRestart} on Linux; a quit asked
   * for meanwhile, `noldova-desktop quit` included, waits until the handoff has finished or failed. Once the handoff has
   * succeeded, and only then, the main process quits without asking anything again: on macOS it closes its windows and calls
   * `nativeUpdater.quitAndInstall`, so the new version starts, and elsewhere it exits at once. When `quitAndInstall`
   * throws, Squirrel reports an `error`, or macOS hasn't quit within 10 seconds, the main process logs it, tells the person
   * that macOS installs the update but Noldova Desktop Sample can't open again by itself, and exits.
   * @param createUpdateLock Creates the lock that lets one main process of the installation check at a time; the lock's log
   * is the main process's.
   * @returns Settles once the main process has started, before Electron is ready; it rejects when the data folder can't be used.
   * @example
   * ```ts
   * import { ProcessPresence, RuntimeBuild, RuntimeLauncher } from "@noldova/desktop.runtime";
   * import { MainProcess, MainProcessRecord, DeviceFileStore, DeviceIdentity, type IMainProcessEnvironment, type IElectron, PathCommand, UpdateCheckLock } from "@noldova/desktop.electron";
   *
   * export function launchAsync(electron: IElectron, process: IMainProcessEnvironment): Promise<void> {
   *   return MainProcess.startAsync(
   *     electron,
   *     process,
   *     "file:///repository/node_modules/@noldova/desktop.electron/main.js",
   *     (settings, installation, log) => new RuntimeLauncher(settings, RuntimeBuild.identity, installation, log),
   *     t => DeviceIdentity.readOrCreateAsync(t),
   *     (folder, fileName) => new DeviceFileStore(folder, fileName),
   *     t => PathCommand.forBundle(t, () => Promise.resolve()),
   *     t => MainProcessRecord.recordAsync(t, ProcessPresence.create(process.platform), process.processId),
   *     () => null,
   *     (t, log) => new UpdateCheckLock(t.folder, () => Promise.resolve(null), () => Promise.resolve(false), log));
   * }
   * ```
   */
  public static startAsync(
    electron: IElectron,
    process: IMainProcessEnvironment,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings, installation: Installation, log: (text: string) => void) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createDeviceFile: (folder: string, fileName: string) => IDeviceFileStore,
    createPathCommand: (executablePath: string) => PathCommand,
    recordMainProcessAsync: (installation: Installation) => Promise<boolean>,
    createUpdater: (installation: Installation, isPackaged: boolean, logsFolder: string, log: (text: string) => void) => IUpdateSetup | null,
    createUpdateLock: (installation: Installation, log: (text: string) => void) => IUpdateCheckLock): Promise<void>;
}

/**
 * Records a main process in its installation, so an update can find it while it has no runtime connection.
 */
export declare class MainProcessRecord {
  /**
   * Stamps the main process's process with its start time and records it in the installation.
   *
   * @param installation The installation the main process's program belongs to.
   * @param presence Stamps the main process's process.
   * @param processId The main process's process id.
   * @returns A promise of whether the main process was recorded; false when its process is not in the process table.
   * @throws Error Rejected when the process table cannot be read or the record cannot be written.
   * @example
   * ```ts
   * import { type Installation, ProcessPresence } from "@noldova/desktop.runtime";
   * import { MainProcessRecord } from "@noldova/desktop.electron";
   *
   * export function recordAsync(installation: Installation): Promise<boolean> {
   *   return MainProcessRecord.recordAsync(installation, ProcessPresence.create(process.platform), process.pid);
   * }
   * ```
   */
  public static recordAsync(installation: Pick<Installation, "recordMainProcessAsync">, presence: Pick<ProcessPresence, "stampAsync">, processId: number): Promise<boolean>;
}

/**
 * Quits a main process that has no runtime connection once another main process's update reaches `Closing`, or has handed
 * off to install a version other than this build's (`HandedOff`), so it does not keep running the installation's files while
 * they are replaced.
 */
export declare class UpdateBarrierWatch {
  /**
   * Creates the watch.
   *
   * @param updates The main process's side of an update: its process id, the barrier, whether the update has ended and how
   * to quit.
   * @param folder The installation's folder, which holds the barrier; the watch reads the barrier on each change in it.
   * @param isConnected Whether the main process has a runtime connection, which tells it about an update itself.
   * @param onChange Called on each change in the folder, before the barrier is read, as {@link RuntimeStartup.barrierChanged} takes it.
   * @param log Writes a line to the main process's log, such as a folder that can't be watched.
   * @example
   * ```ts
   * import { type IUpdateHost, type RuntimeStartup, UpdateBarrierWatch } from "@noldova/desktop.electron";
   *
   * export function watch(updates: IUpdateHost, folder: string, isConnected: () => boolean, startup: RuntimeStartup): UpdateBarrierWatch {
   *   return new UpdateBarrierWatch(updates, folder, isConnected, () => startup.barrierChanged(), console.error);
   * }
   * ```
   */
  public constructor(updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">, folder: string, isConnected: () => boolean,
    onChange: () => void, log: (text: string) => void);

  /**
   * Starts watching the installation's folder and checks the barrier once, then on each change in the folder; starting it again
   * changes nothing. A folder that can't be watched, or a watch that fails later, is written to the log and leaves the watch
   * stopped.
   *
   * @example
   * ```ts
   * import type { UpdateBarrierWatch } from "@noldova/desktop.electron";
   *
   * export function begin(watch: UpdateBarrierWatch): void {
   *   watch.start();
   * }
   * ```
   */
  public start(): void;

  /**
   * Stops watching the installation's folder, and cancels a check waiting to run again.
   *
   * @example
   * ```ts
   * import type { UpdateBarrierWatch } from "@noldova/desktop.electron";
   *
   * export function end(watch: UpdateBarrierWatch): void {
   *   watch.stop();
   * }
   * ```
   */
  public stop(): void;

  /**
   * Checks the barrier once, unless the main process is connected; a check asked for while one is running makes that one
   * check again when it ends. It quits the main process, and stops, when the barrier is `Closing`, or `HandedOff` for a version
   * other than this build's, for another main process whose update has not ended; a barrier it cannot read, or an update it cannot tell has ended, keeps the main process running for now: it writes the error to the log and checks again a quarter of a second later, until a check succeeds, the main process is connected again or the watch stops.
   *
   * @returns A promise of whether it quit the main process.
   * @example
   * ```ts
   * import type { UpdateBarrierWatch } from "@noldova/desktop.electron";
   *
   * export function checkAsync(watch: UpdateBarrierWatch): Promise<boolean> {
   *   return watch.checkAsync();
   * }
   * ```
   */
  public checkAsync(): Promise<boolean>;
}

/**
 * One JSON object the main process keeps for this device in a file outside the data directory, such as the last appearance
 * preferences, so the next start has it before it reaches the runtime.
 */
export interface IDeviceFileStore {
  /**
   * Reads the object kept last.
   *
   * @returns A promise of the object, or `null` when none is kept; it rejects when the kept file cannot be read.
   * @example
   * ```ts
   * import type { IDeviceFileStore } from "@noldova/desktop.electron";
   *
   * export async function hasAppearanceAsync(store: IDeviceFileStore): Promise<boolean> {
   *   return await store.readAsync() !== null;
   * }
   * ```
   */
  readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps the object, replacing the one kept before; writes happen one at a time, in order.
   *
   * @param value The object to keep.
   * @returns A promise that settles once it is kept.
   * @example
   * ```ts
   * import type { IDeviceFileStore } from "@noldova/desktop.electron";
   *
   * export function keepDarkAsync(store: IDeviceFileStore): Promise<void> {
   *   return store.writeAsync({ "desktop.mode": "Dark" });
   * }
   * ```
   */
  writeAsync(value: JsonObject): Promise<void>;

  /**
   * Removes the kept object, after any write still in progress; nothing kept is not a failure.
   *
   * @returns A promise that settles once it is removed.
   * @example
   * ```ts
   * import type { IDeviceFileStore } from "@noldova/desktop.electron";
   *
   * export function forgetAsync(store: IDeviceFileStore): Promise<void> {
   *   return store.deleteAsync();
   * }
   * ```
   */
  deleteAsync(): Promise<void>;
}

/**
 * Puts the dictionaries that ship with the main process where Electron's spell checker finds them.
 */
export declare class SpellingDictionaries {
  /**
   * Puts each dictionary the folder's `dictionaries.json` lists into the profile's `Dictionaries` folder, where
   * Electron's spell checker finds it, unless it is already there. It runs before the application is ready, because
   * Electron reads that folder as it becomes ready, and without blocking the main process. A dictionary whose entry is
   * not valid or whose file cannot be copied is left out and logged.
   *
   * @param sourceFolder The folder of the shipped dictionaries.
   * @param profileFolder The profile folder, Electron's `userData`.
   * @param log Receives each line to log.
   * @returns The languages of the dictionaries in the profile, in the list's order; none when the list cannot be read.
   * @example
   * ```ts
   * import { SpellingDictionaries } from "@noldova/desktop.electron";
   *
   * export function installAsync(profile: string): Promise<readonly string[]> {
   *   return SpellingDictionaries.installAsync("/opt/noldova-desktop/assets/dictionaries", profile, line => console.error(line));
   * }
   * ```
   */
  public static installAsync(sourceFolder: string, profileFolder: string, log: (text: string) => void): Promise<readonly string[]>;

  /**
   * Gives the profile's `Dictionaries` folder as a `file:` URL ending in a slash, the address the spell checker gives
   * Chromium for downloads. Chromium cannot download from a `file:` URL, so a missing dictionary fails at once without
   * a connection, and no local process can answer in its place as one listening on a loopback port could.
   *
   * @param profileFolder The profile folder, Electron's `userData`.
   * @returns The folder's `file:` URL with a trailing slash.
   * @example
   * ```ts
   * import { SpellingDictionaries } from "@noldova/desktop.electron";
   *
   * export function addressOf(profile: string): string {
   *   return SpellingDictionaries.addressOf(profile);
   * }
   * ```
   */
  public static addressOf(profileFolder: string): string;
}

/**
 * Applies the spelling settings to the window's session. On Windows and Linux it checks only in shipped languages and
 * points the dictionary download address at the profile's own dictionary folder as a `file:` URL, from which Chromium
 * cannot download, so a dictionary is never downloaded; on macOS the system checker chooses the languages and only
 * checking on or off applies.
 */
export declare class SpellChecker {
  /**
   * Creates the spell checker.
   *
   * @param host Gives the session once the application is ready.
   * @param languages The shipped languages in the profile, in their order.
   * @param address The dictionary download address, the profile's own dictionary folder as a `file:` URL, which Chromium cannot download from.
   * @param platform The operating system, as `process.platform` names it.
   * @param readSystemLanguages Lists the operating system's preferred languages.
   * @param log Receives each line to log.
   * @example
   * ```ts
   * import { type ISpellCheckHost, SpellChecker } from "@noldova/desktop.electron";
   *
   * export function create(session: ISpellCheckHost): SpellChecker {
   *   return new SpellChecker(() => session, ["en-US"], "file:///home/person/.noldova-desktop/mainProcess/Dictionaries/", "linux", () => ["en-US"], line => console.error(line));
   * }
   * ```
   */
  public constructor(host: () => ISpellCheckHost, languages: readonly string[], address: string, platform: string, readSystemLanguages: () => readonly string[], log: (text: string) => void);

  /**
   * Points the dictionary download at the profile's own dictionary folder and checks in the languages an empty choice means, before any window opens.
   *
   * @example
   * ```ts
   * import type { SpellChecker } from "@noldova/desktop.electron";
   *
   * export function start(checker: SpellChecker): void {
   *   checker.start();
   * }
   * ```
   */
  public start(): void;

  /**
   * Turns checking on or off and checks in the chosen languages that ship, in their shipped order. With none of them,
   * it checks in the operating system's languages that ship, or else in the first shipped language. A language list
   * the session refuses is logged.
   *
   * @param isChecking Whether misspelled words are marked.
   * @param chosen The chosen language tags.
   * @example
   * ```ts
   * import type { SpellChecker } from "@noldova/desktop.electron";
   *
   * export function checkInEnglish(checker: SpellChecker): void {
   *   checker.apply(true, ["en-US"]);
   * }
   * ```
   */
  public apply(isChecking: boolean, chosen: readonly string[]): void;

  /**
   * Adds a word to the session's dictionary on every platform. On Linux that dictionary is Noldova Desktop Sample's own file in the
   * profile; on Windows and macOS it is the system's user dictionary, which other applications share.
   *
   * @param word The word to add.
   * @returns Whether the session took the word.
   * @example
   * ```ts
   * import type { SpellChecker } from "@noldova/desktop.electron";
   *
   * export function learn(checker: SpellChecker): boolean {
   *   return checker.addWord("Noldova Desktop Sample");
   * }
   * ```
   */
  public addWord(word: string): boolean;

  /**
   * Describes what the window may offer.
   *
   * @returns `languages`, the shipped languages, none on macOS; and `fallback`, the language an empty choice checks in
   * when none of the operating system's languages ships, or `null`.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import type { SpellChecker } from "@noldova/desktop.electron";
   *
   * export function describe(checker: SpellChecker): JsonObject {
   *   return checker.toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Keeps the device's own state in one keyed device file: the one-time hints it has shown, such as where Noldova Desktop Sample went
 * when its last window closed into the tray, and the tray icon setting the main process follows, written as it changes. It
 * reads the file once and writes one change at a time, so changes never overwrite each other.
 */
export declare class DeviceState {
  /**
   * Creates the state.
   *
   * @param store The device file that holds the state, keyed by name.
   * @param log Records a file that cannot be read or written.
   * @example
   * ```ts
   * import { DeviceFileStore, DeviceState } from "@noldova/desktop.electron";
   *
   * export const state: DeviceState = new DeviceState(new DeviceFileStore("/home/person/.local/state/noldova/desktop", "device-state.json"), console.error);
   * ```
   */
  public constructor(store: IDeviceFileStore, log: (text: string) => void);

  /**
   * Reads the state, from the file the first time and from memory after that. A file that is missing or cannot be read
   * counts as empty.
   *
   * @returns A promise of the state, which never rejects.
   * @example
   * ```ts
   * import type { DeviceState } from "@noldova/desktop.electron";
   *
   * export async function readTrayIconAsync(state: DeviceState): Promise<unknown> {
   *   return (await state.readAsync())["trayIcon"];
   * }
   * ```
   */
  public readAsync(): Promise<JsonObject>;

  /**
   * Shows a hint unless this device has shown it before, then records that it has; a hint is tried at most once a
   * run, and one that could not show is not recorded.
   *
   * @param key The hint's name in the state, such as `trayCloseHintShown`.
   * @param showAsync Shows the hint and resolves to whether the operating system showed it.
   * @returns A promise that settles once the hint is recorded or left alone.
   * @example
   * ```ts
   * import type { DeviceState } from "@noldova/desktop.electron";
   *
   * export function hintAsync(state: DeviceState): Promise<void> {
   *   return state.showOnceAsync("trayCloseHintShown", () => Promise.resolve(true));
   * }
   * ```
   */
  public showOnceAsync(key: string, showAsync: () => Promise<boolean>): Promise<void>;

  /**
   * Records a value under a key, after any change already being written; a failed write is logged.
   *
   * @param key The value's name in the state, such as `trayIcon`.
   * @param value The value.
   * @returns A promise that settles once the value is written or its failure logged.
   * @example
   * ```ts
   * import type { DeviceState } from "@noldova/desktop.electron";
   *
   * export function rememberAsync(state: DeviceState, isShown: boolean): Promise<void> {
   *   return state.rememberAsync("trayIcon", isShown);
   * }
   * ```
   */
  public rememberAsync(key: string, value: JsonValue): Promise<void>;
}

/**
 * Keeps one JSON object in a named file in a device folder, writing a temporary file and renaming it so an interrupted
 * write never leaves a partial file.
 */
export declare class DeviceFileStore implements IDeviceFileStore {
  /**
   * Creates the store.
   *
   * @param folder The device folder.
   * @param fileName The file's name in the folder, such as `appearance.json`.
   * @throws {ArgumentException} When the file name is empty or whitespace.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/desktop.electron";
   *
   * export const store: DeviceFileStore = new DeviceFileStore("/home/person/.local/state/noldova/desktop", "appearance.json");
   * ```
   */
  public constructor(folder: string, fileName: string);

  /**
   * Reads the object kept last.
   *
   * @returns A promise of the object, or `null` when the file does not exist.
   * @throws {JsonException} Asynchronously when the file is not JSON or holds JSON that is not an object.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/desktop.electron";
   *
   * export function readAsync(folder: string): Promise<unknown> {
   *   return new DeviceFileStore(folder, "appearance.json").readAsync();
   * }
   * ```
   */
  public readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps the object, after any write still in progress, creating the folder when needed.
   *
   * @param value The object to keep.
   * @returns A promise that settles once it is kept, and rejects when it could not be written.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/desktop.electron";
   *
   * export function keepAsync(folder: string): Promise<void> {
   *   return new DeviceFileStore(folder, "appearance.json").writeAsync({ "desktop.mode": "Light" });
   * }
   * ```
   */
  public writeAsync(value: JsonObject): Promise<void>;

  /**
   * Removes the kept file, after any write still in progress; a missing file is not a failure.
   *
   * @returns A promise that settles once it is removed, and rejects when it could not be.
   * @example
   * ```ts
   * import { DeviceFileStore } from "@noldova/desktop.electron";
   *
   * export function forgetAsync(folder: string): Promise<void> {
   *   return new DeviceFileStore(folder, "update-ready.json").deleteAsync();
   * }
   * ```
   */
  public deleteAsync(): Promise<void>;
}

/**
 * Starts or attaches to the runtime and turns each refusal into a {@link StartupState} the window shows, then carries
 * out the person's choice: move data from before the shell aside, wait for or stop an older build's work, or try again.
 */
export declare class RuntimeStartup {
  /**
   * Creates the startup.
   *
   * @param launcher Starts or attaches to the runtime.
   * @param publish Receives each new state.
   * @param handOver Hands the person over to a newer build; returns `false` when this build cannot, so the window
   * shows {@link StartupStateKind.NewerBuild}.
   * @param waitInterval How long to pause between attempts while waiting for an older build's work, in milliseconds.
   * @param forward Receives each event the runtime sends on the current connection.
   * @param log Receives each launch or connection failure, and the full description of any other failure.
   * @param now Reads the current time, in milliseconds.
   * @param wait Resolves after the given number of milliseconds, or rejects once the signal aborts.
   * @param updates Reads the launch barrier, saves the windows and quits, while it follows an update.
   * @example
   * ```ts
   * import { setTimeout as delay } from "node:timers/promises";
   *
   * import { type IRuntimeLauncher, type IUpdateHost, RuntimeStartup } from "@noldova/desktop.electron";
   *
   * export function create(launcher: IRuntimeLauncher, updates: IUpdateHost): RuntimeStartup {
   *   return new RuntimeStartup(
   *     launcher, state => console.log(state.kind), () => false, 2000, event => console.log(event.name.text), message => console.error(message),
   *     Date.now, (milliseconds, signal) => delay(milliseconds, undefined, { signal }), updates);
   * }
   * ```
   */
  public constructor(
    launcher: IRuntimeLauncher,
    publish: (state: StartupState) => void,
    handOver: (handover: RuntimeHandover) => boolean,
    waitInterval: number,
    forward: (event: Event) => void,
    log: (message: string) => void,
    now: () => number,
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void>,
    updates: IUpdateHost);

  /**
   * The latest state.
   */
  public get current(): StartupState;

  /**
   * The connection to the runtime while the state is {@link StartupStateKind.Ready}; otherwise `null`.
   */
  public get connection(): IRuntimeConnection | null;

  /**
   * Starts or attaches to the runtime, stopping an older build's runtime only when it is idle. Reconnects when the
   * runtime disconnects until {@link close}. A connection that ends within 30 seconds of being ready ends soon: after
   * the first such end in a row it reconnects at once, then after 1, 2, 4 and 8 seconds, and the sixth is logged and
   * shown as a failure with its cause and an offer to try again, which counts afresh. A start or reconnection that
   * fails for any reason other than data from before the shell, an older build's work or a newer build is logged, an
   * unexpected failure in full, and shows the failure with an offer to try again. A connection that replaces the
   * current one, as when it starts again while ready, closes the one it replaces, whose end then reconnects nothing.
   *
   * When the runtime announces `desktop.updating`, the state becomes {@link StartupStateKind.Updating} with the version
   * the launch barrier names, the windows save, and the runtime is told what did not save with `desktop.updateSaved`;
   * `desktop.updateEnded` makes it ready again. A runtime that disconnects meanwhile is not reconnected: it checks at
   * once whether the update has ended, again at once on each {@link barrierChanged}, a change it keeps when it comes
   * during a check, and again every second, since the barrier's holder can end without changing the barrier and Node
   * can't wait for the exit of a process it didn't start; it reconnects once the update has ended, and
   * {@link UpdateBarrierWatch} quits the main process once the barrier is `Closing`, or `HandedOff` for a version other than this
   * build's, and held by another main process.
   *
   * @returns A promise that settles once the state is ready or shows why not.
   * @example
   * ```ts
   * import type { RuntimeStartup } from "@noldova/desktop.electron";
   *
   * export async function startAsync(startup: RuntimeStartup): Promise<void> {
   *   await startup.startAsync();
   * }
   * ```
   */
  public startAsync(): Promise<void>;

  /**
   * Carries out the person's choice when it fits the current state: `moveAside` for data from before the shell,
   * `stopWork` or `wait` for an older build's work, and `retry` after a failure. The state is
   * {@link StartupStateKind.Connecting} while a choice attaches, so a second choice made meanwhile, such as `wait`
   * twice, does not fit and attaches nothing.
   *
   * @param action The choice, as the window sends it.
   * @returns A promise of `true` once the choice is carried out, or `false` when it does not fit the state.
   * @example
   * ```ts
   * import type { RuntimeStartup } from "@noldova/desktop.electron";
   *
   * export function moveAsideAsync(startup: RuntimeStartup): Promise<boolean> {
   *   return startup.actAsync("moveAside");
   * }
   * ```
   */
  public actAsync(action: unknown): Promise<boolean>;

  /**
   * Tells it that the installation's folder, which holds the launch barrier, changed, so a runtime gone during an
   * update is checked for again at once.
   *
   * @example
   * ```ts
   * import type { RuntimeStartup } from "@noldova/desktop.electron";
   *
   * export function follow(startup: RuntimeStartup): void {
   *   startup.barrierChanged();
   * }
   * ```
   */
  public barrierChanged(): void;

  /**
   * Closes the connection and stops reconnecting and waiting, ending a wait at once.
   *
   * @example
   * ```ts
   * import type { RuntimeStartup } from "@noldova/desktop.electron";
   *
   * export function quit(startup: RuntimeStartup): void {
   *   startup.close();
   * }
   * ```
   */
  public close(): void;
}

/**
 * Judges a web view's addresses against its allowed origins. The address checks hold for every request of the view's profile: the URL
 * parses, is at most 32768 characters long, has a web scheme and no credentials, isn't link-local, unspecified or one of the app's own
 * loopback endpoints, and reaches a loopback or private host only when an exact allowed origin names it; a WebSocket connects only to an
 * allowed origin. The navigation checks add that a page or a frame loads only an allowed origin, or the empty page.
 */
export declare class WebViewOriginCheck {
  /**
   * Creates the check.
   *
   * @param localOrigins The origins the app's settings mark as local addresses, which may connect to a loopback or private address; none by
   * default.
   * @param neverAllowedPorts The loopback ports of the app's own endpoints, refused even when an allowed origin names them, or a function
   * read at each check that answers them, or `null` while they are unknown, when every loopback port is refused; none by default.
   * @example
   * ```ts
   * import { WebViewOriginCheck } from "@noldova/desktop.electron";
   *
   * export const check: WebViewOriginCheck = new WebViewOriginCheck([], () => new Set([4600]));
   * ```
   */
  public constructor(localOrigins?: readonly string[], neverAllowedPorts?: readonly number[] | (() => ReadonlySet<number> | null));

  /**
   * Classifies an IP address, judging an IPv6 address that carries an IPv4 address, IPv4-mapped, IPv4-compatible or NAT64, as that IPv4
   * address.
   *
   * @param address An IPv4 or IPv6 address, with or without brackets.
   * @returns Its kind; the shared address space `100.64.0.0/10` is private.
   * @throws ArgumentException synchronously when the text is not an IP address.
   * @example
   * ```ts
   * import { WebAddressKind, WebViewOriginCheck } from "@noldova/desktop.electron";
   *
   * export const kind: WebAddressKind = WebViewOriginCheck.classify("::ffff:7f00:1");
   * ```
   */
  public static classify(address: string): WebAddressKind;

  /**
   * Whether a text is an allowed-origin entry: an `http:` or `https:` origin as the URL standard writes it, such as `https://example.com`, or
   * one whose host is a name that starts with a `*.` wildcard, such as `https://*.example.com`.
   *
   * @param text The text.
   * @returns True when it is an entry.
   * @example
   * ```ts
   * import { WebViewOriginCheck } from "@noldova/desktop.electron";
   *
   * export const isEntry: boolean = WebViewOriginCheck.isEntry("https://*.example.com");
   * ```
   */
  public static isEntry(text: string): boolean;

  /**
   * The address checks, for any request of the view's profile: a subresource on a public origin, a `data:` or a `blob:` address passes
   * without an allowed origin.
   *
   * @param url The request's address.
   * @param allowed The view's allowed origins.
   * @returns True when the request may go out.
   * @example
   * ```ts
   * import { WebViewOriginCheck } from "@noldova/desktop.electron";
   *
   * export const isAllowed: boolean = new WebViewOriginCheck().allowsRequest("http://192.168.1.1/a.png", ["https://example.com"]);
   * ```
   */
  public allowsRequest(url: string, allowed: readonly string[]): boolean;

  /**
   * The address and navigation checks, for a page or a frame that loads an address: only `http:` and `https:` of an allowed origin,
   * matched exactly or by a wildcard of whole labels, and `about:blank`; a frame may also load `about:srcdoc`.
   *
   * @param url The address it loads.
   * @param allowed The view's allowed origins.
   * @param isFrame Whether a frame, rather than the page, loads it.
   * @returns True when it may load.
   * @example
   * ```ts
   * import { WebViewOriginCheck } from "@noldova/desktop.electron";
   *
   * export const isAllowed: boolean = new WebViewOriginCheck().allowsNavigation("https://a.example.com/", ["https://*.example.com"], false);
   * ```
   */
  public allowsNavigation(url: string, allowed: readonly string[], isFrame: boolean): boolean;

  /**
   * Judges the address a request connected to, or its name resolved to: a public address passes, a loopback or private one only for a
   * local entry, an allowed origin whose host is an IP address, `localhost`, a name that ends in `.localhost`, or one the settings mark as
   * local; anything else, and an address the check can't judge, is refused.
   *
   * @param url The request's address.
   * @param allowed The view's allowed origins.
   * @param address The IP address, or `null` when none is known.
   * @returns True when the request may go on.
   * @example
   * ```ts
   * import { WebViewOriginCheck } from "@noldova/desktop.electron";
   *
   * export const isAllowed: boolean = new WebViewOriginCheck().allowsConnection("https://example.com/", ["https://example.com"], "127.0.0.1");
   * ```
   */
  public allowsConnection(url: string, allowed: readonly string[], address: string | null): boolean;
}

/**
 * Decides which frames may use the bridge: only the main frame of the window's own page.
 */
export declare class SenderPolicy {
  /**
   * Creates the policy.
   *
   * @param windowUrl The `file:` URL of the window's page; not whitespace only.
   * @throws ArgumentException synchronously when the URL is empty or whitespace only.
   * @example
   * ```ts
   * import { SenderPolicy } from "@noldova/desktop.electron";
   *
   * export const policy: SenderPolicy = new SenderPolicy("file:///repository/_build/window/browser/index.html");
   * ```
   */
  public constructor(windowUrl: string);

  /**
   * Tells whether a sender is the window's own main frame.
   *
   * @param sender The frame that sent a message.
   * @returns `true` for the main frame showing the window's page.
   * @example
   * ```ts
   * import { SenderInfo, SenderPolicy } from "@noldova/desktop.electron";
   *
   * const url = "file:///repository/_build/window/browser/index.html";
   * export const isTrusted: boolean = new SenderPolicy(url).isTrusted(new SenderInfo(`${url}#settings`, true, 1));
   * ```
   */
  public isTrusted(sender: SenderInfo): boolean;

  /**
   * Tells whether a URL is the window's page, with or without a fragment or query.
   *
   * @param url The URL to check, such as a navigation target.
   * @returns `true` for the window's page.
   * @example
   * ```ts
   * import { SenderPolicy } from "@noldova/desktop.electron";
   *
   * export const isWindow: boolean = new SenderPolicy("file:///repository/_build/window/browser/index.html").isWindowUrl("https://example.com/");
   * ```
   */
  public isWindowUrl(url: string): boolean;
}

/**
 * Shows new notifications through the operating system while no Noldova Desktop Sample window is focused. A notification is new when
 * its sequence is above every one seen since the window last read the notifications, so it counts from the same point
 * as the window's toasts; while a window loads, broadcasts wait for its read. Updates, work in progress, notifications
 * from a muted module and those posted while Do not disturb is on for the device never show. An operating system notification closes
 * when its notification is dismissed or replaced, and a failure to show one is logged once.
 */
export declare class SystemNotifier {
  /**
   * Creates the notifier.
   *
   * @param host The operating system's notification service.
   * @param log Where the first failure to show a notification is written.
   * @param readIcon Gives the application icon's path for each notification.
   * @param isAnyWindowFocused Tells whether a Noldova Desktop Sample window has the focus.
   * @param open Brings Noldova Desktop Sample forward and opens a clicked notification, by its id.
   * @example
   * ```ts
   * import type { IMainProcessLog, INotificationHost } from "@noldova/desktop.electron";
   * import { SystemNotifier } from "@noldova/desktop.electron";
   *
   * export function create(host: INotificationHost, log: IMainProcessLog): SystemNotifier {
   *   return new SystemNotifier(host, log, () => "/noldova-desktop/icon.png", () => false, t => console.log(t));
   * }
   * ```
   */
  public constructor(host: INotificationHost, log: IMainProcessLog, readIcon: () => string, isAnyWindowFocused: () => boolean, open: (id: string) => void);

  /**
   * The number to pass to {@link begin} for a read starting now; a reset or a hold changes it, so a read started before
   * them is ignored.
   */
  public get epoch(): number;

  /**
   * Forgets the runtime's notifications and closes those shown, when the runtime connection ends or starts again.
   *
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/desktop.electron";
   *
   * export function disconnect(notifier: SystemNotifier): void {
   *   notifier.reset();
   * }
   * ```
   */
  public reset(): void;

  /**
   * Holds broadcasts while a window loads, until its read of the notifications answers.
   *
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/desktop.electron";
   *
   * export function reload(notifier: SystemNotifier): void {
   *   notifier.hold();
   * }
   * ```
   */
  public hold(): void;

  /**
   * Shows notifications above the sequence a window's read returned, including any in a broadcast held since.
   *
   * @param epoch The {@link epoch} when the read started.
   * @param device This device's id, to know when its Do not disturb is on.
   * @param sequence The sequence the read returned.
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/desktop.electron";
   *
   * export function connect(notifier: SystemNotifier, device: string): void {
   *   notifier.begin(notifier.epoch, device, 0);
   * }
   * ```
   */
  public begin(epoch: number, device: string, sequence: number): void;

  /**
   * Follows a broadcast of the runtime's notifications.
   *
   * @param broadcast The notifications, the quiet devices and the latest sequence.
   * @example
   * ```ts
   * import type { SystemNotifier } from "@noldova/desktop.electron";
   * import { NotificationBroadcast } from "@noldova/desktop.protocol";
   *
   * export function clear(notifier: SystemNotifier): void {
   *   notifier.receive(new NotificationBroadcast([], [], [], 0));
   * }
   * ```
   */
  public receive(broadcast: NotificationBroadcast): void;
}

/**
 * Puts the command line on the macOS PATH by linking a folder on it, `/usr/local/bin`, to the command inside the app
 * bundle. When the folder cannot be written, it asks for an administrator through the system's prompt.
 */
export declare class PathCommand {
  /**
   * Creates the service for one command and one link.
   *
   * @param target The command inside the app bundle.
   * @param link The link to make on the PATH.
   * @param files The file operations it links with.
   * @param runProgramAsync Runs a program to its end, for the system's administrator prompt, and rejects with an error
   * whose message holds the program's standard error when it fails; `(-128)` in it means the person cancelled.
   * @example
   * ```ts
   * import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
   *
   * import { PathCommand } from "@noldova/desktop.electron";
   *
   * export const command: PathCommand = new PathCommand("/Applications/Noldova Desktop Sample.app/Contents/Resources/bin/noldova-desktop", "/usr/local/bin/noldova-desktop",
   *   { lstat, readlink, rm, mkdir, symlink }, () => Promise.resolve());
   * ```
   */
  public constructor(target: string, link: string, files: IPathCommandFiles, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>);

  /**
   * The link this service makes.
   *
   * @example
   * ```ts
   * import type { PathCommand } from "@noldova/desktop.electron";
   *
   * export function describe(command: PathCommand): string {
   *   return `The command line is linked at ${command.linkPath}.`;
   * }
   * ```
   */
  public get linkPath(): string;

  /**
   * Creates the service for the bundle the main process runs from, with Node.js's file operations: the command is
   * `Contents/Resources/bin/noldova-desktop` and the link `/usr/local/bin/noldova-desktop`.
   *
   * @param executablePath The program the main process runs from, in `Contents/MacOS`.
   * @param runProgramAsync Runs a program to its end, for the system's administrator prompt, and rejects with an error
   * whose message holds the program's standard error when it fails; `(-128)` in it means the person cancelled.
   * @returns The service.
   * @example
   * ```ts
   * import { PathCommand } from "@noldova/desktop.electron";
   *
   * export const command: PathCommand = PathCommand.forBundle("/Applications/Noldova Desktop Sample.app/Contents/MacOS/Noldova Desktop Sample", () => Promise.resolve());
   * ```
   */
  public static forBundle(executablePath: string, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>): PathCommand;

  /**
   * Links the command on the PATH. A link to elsewhere is replaced; a file that is not a link is left alone. When the
   * link's folder cannot be written or read, the system's administrator prompt makes the folder and the link, and
   * leaves alone a file that is not a link, which it finds there with administrator rights.
   *
   * @returns A promise of what happened.
   * @throws PathCommandException, through the promise, when the link cannot be read or made, or the administrator
   * prompt fails for another reason than the person cancelling it.
   * @example
   * ```ts
   * import { type PathCommand, PathCommandOutcome } from "@noldova/desktop.electron";
   *
   * export async function isLinkedAsync(command: PathCommand): Promise<boolean> {
   *   const outcome = await command.installAsync();
   *   return outcome === PathCommandOutcome.Installed || outcome === PathCommandOutcome.AlreadyInstalled;
   * }
   * ```
   */
  public installAsync(): Promise<PathCommandOutcome>;
}

/**
 * The exception thrown when the command cannot be linked on the macOS PATH.
 */
export declare class PathCommandException extends ElectronException {
  /**
   * The path where the command could not be linked.
   */
  public readonly link: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param link The path of the link.
   * @param cause The error that linking gave.
   * @example
   * ```ts
   * import { PathCommandException } from "@noldova/desktop.electron";
   *
   * export const failure: PathCommandException = new PathCommandException("/usr/local/bin/noldova-desktop", new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(link: string, cause: unknown);
}

/**
 * Runs other programs for the main process, without a shell or a window.
 */
export interface IProgramHost {
  /**
   * Runs a program to its end.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @returns A promise of the program's standard output.
   * @throws ProgramException, through the promise, when the program cannot start, ends with an error or runs too long.
   * @example
   * ```ts
   * import type { IProgramHost } from "@noldova/desktop.electron";
   *
   * export function readVersionAsync(programs: IProgramHost): Promise<string> {
   *   return programs.runAsync("/usr/bin/gdbus", ["--version"], process.env);
   * }
   * ```
   */
  runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string>;

  /**
   * Starts a program that keeps running and passes its standard output on as it comes.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param onOutput Receives each piece of the program's standard output.
   * @param onExit Called once, when the program ends or cannot start.
   * @returns The running program.
   * @example
   * ```ts
   * import type { IProgramHost, StartedProgram } from "@noldova/desktop.electron";
   *
   * export function monitor(programs: IProgramHost): StartedProgram {
   *   return programs.start("/usr/bin/gdbus", ["monitor", "--session"], process.env, t => console.log(t), () => console.log("ended"));
   * }
   * ```
   */
  start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram;
}

/**
 * A program that an {@link IProgramHost} started.
 */
export declare class StartedProgram {
  /**
   * Creates the running program.
   *
   * @param end Ends the program.
   * @example
   * ```ts
   * import { StartedProgram } from "@noldova/desktop.electron";
   *
   * export const program: StartedProgram = new StartedProgram(() => undefined);
   * ```
   */
  public constructor(end: () => void);

  /**
   * Ends the program; its host's exit callback follows once it has ended.
   *
   * @example
   * ```ts
   * import type { StartedProgram } from "@noldova/desktop.electron";
   *
   * export function end(program: StartedProgram): void {
   *   program.stop();
   * }
   * ```
   */
  public stop(): void;
}

/**
 * Runs other programs as child processes of the main process, with no shell. A detached program starts through an
 * `IProcessStarter`, by default the runtime's `ChildProcessStarter`, which on Linux and macOS starts it through the
 * runtime's POSIX addon with every descriptor but its standard ones closed.
 */
export declare class ChildProgramHost implements IProgramHost {
  /**
   * Creates the host.
   *
   * @param platform The platform, as in `process.platform`.
   * @param timeout How long, in milliseconds, a program run to its end may take before it is ended and fails.
   * @param starter Starts the detached programs; by default the runtime's `ChildProcessStarter` for the platform, which on Windows doesn't hide the program's windows, so an app it starts opens its first window shown.
   * @example
   * ```ts
   * import { ChildProgramHost } from "@noldova/desktop.electron";
   *
   * export const programs: ChildProgramHost = new ChildProgramHost(process.platform, 5000);
   * ```
   */
  public constructor(platform: string, timeout: number, starter?: IProcessStarter);

  /**
   * Runs a program to its end.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @returns A promise of the program's standard output.
   * @throws ProgramException, through the promise, when the program cannot start, ends with an error, runs longer than
   * the timeout or writes more than 64 KiB.
   * @throws ArgumentException, through the promise, when the program's path is empty or whitespace.
   * @example
   * ```ts
   * import type { ChildProgramHost } from "@noldova/desktop.electron";
   *
   * export function readVersionAsync(programs: ChildProgramHost): Promise<string> {
   *   return programs.runAsync("/usr/bin/gdbus", ["--version"], process.env);
   * }
   * ```
   */
  public runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string>;

  /**
   * Starts a program that keeps running and passes its standard output on as it comes.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param onOutput Receives each piece of the program's standard output.
   * @param onExit Called once, when the program ends or cannot start.
   * @throws {ArgumentException} When the program's path is empty or whitespace.
   * @returns The running program.
   * @example
   * ```ts
   * import type { ChildProgramHost, StartedProgram } from "@noldova/desktop.electron";
   *
   * export function monitor(programs: ChildProgramHost): StartedProgram {
   *   return programs.start("/usr/bin/gdbus", ["monitor", "--session"], process.env, t => console.log(t), () => console.log("ended"));
   * }
   * ```
   */
  public start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram;

  /**
   * Starts a program in its own session that outlives the main process, with its standard streams ignored.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param onFailure Called with a `LaunchException`, whose cause is the reason the system gives, when the program
   * cannot be started.
   * @throws {ArgumentException} When the program's path is empty or whitespace.
   * @example
   * ```ts
   * import type { ChildProgramHost } from "@noldova/desktop.electron";
   *
   * export function handOver(programs: ChildProgramHost, executablePath: string, log: (text: string) => void): void {
   *   programs.startDetached(executablePath, ["--data-dir=/home/person/work-data"], process.env, t => log(String(t)));
   * }
   * ```
   */
  public startDetached(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onFailure: (error: Error) => void): void;

  /**
   * Starts a program in its own session that outlives the main process, with its standard streams ignored, in the given
   * folder.
   *
   * @param file The program, by its full path.
   * @param programArguments The program's arguments.
   * @param environment The program's environment.
   * @param workingDirectory The folder the program starts in.
   * @returns A promise that settles once the program has started.
   * @throws {LaunchException} Asynchronously when the program cannot be started, with the reason the system gives as
   * its cause, including when the folder does not exist.
   * @throws {ArgumentException} Asynchronously when the program's path is empty or whitespace.
   * @example
   * ```ts
   * import type { ChildProgramHost } from "@noldova/desktop.electron";
   *
   * export function relaunchAsync(programs: ChildProgramHost, executablePath: string): Promise<void> {
   *   return programs.startDetachedAsync(executablePath, [], process.env, process.cwd());
   * }
   * ```
   */
  public startDetachedAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, workingDirectory: string): Promise<void>;
}

/**
 * The exception a program host gives when a program cannot start, ends with an error or runs too long.
 */
export declare class ProgramException extends ElectronException {
  /**
   * The path of the program that failed.
   */
  public readonly file: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param file The path of the program.
   * @param cause The error the program gave.
   * @example
   * ```ts
   * import { ProgramException } from "@noldova/desktop.electron";
   *
   * export const failure: ProgramException = new ProgramException("/usr/bin/gdbus", new Error("spawn /usr/bin/gdbus ENOENT"));
   * ```
   */
  public constructor(file: string, cause: Error);
}

/**
 * Tells whether the main process has somewhere to show a tray icon. Windows and macOS always have one. On Linux it asks the
 * session bus, through `/usr/bin/gdbus`, whether a StatusNotifierWatcher has a host registered, and asks again whenever
 * the watcher's name changes owner or the watcher signals a host coming or going. A missing `gdbus`, a missing watcher
 * or a failed answer means no host. When the monitor ends, it asks once and starts the monitor again after a wait that
 * begins at a second and doubles up to a minute, back to a second once the monitor is heard again.
 */
export declare class TrayHostWatcher {
  /**
   * Creates the watcher.
   *
   * @param platform The platform, as `process.platform` names it.
   * @param programs Runs `gdbus`.
   * @param environment The environment `gdbus` runs in, which names the session bus.
   * @param delayAsync Waits the given milliseconds before the monitor starts again.
   * @param onChange Called with the new answer whenever it changes.
   * @example
   * ```ts
   * import { ChildProgramHost, TrayHostWatcher } from "@noldova/desktop.electron";
   *
   * export const watcher: TrayHostWatcher = new TrayHostWatcher(process.platform, new ChildProgramHost(process.platform, 5000), process.env,
   *   t => new Promise<void>(resolve => setTimeout(resolve, t)), t => console.log(t));
   * ```
   */
  public constructor(platform: string, programs: IProgramHost, environment: NodeJS.ProcessEnv, delayAsync: (milliseconds: number) => Promise<void>, onChange: (isAvailable: boolean) => void);

  /**
   * Whether a tray host is there: always on Windows and macOS; on Linux, not until the session bus says so.
   */
  public get isAvailable(): boolean;

  /**
   * Starts watching the session bus on Linux; elsewhere, and when it already watches, it does nothing.
   *
   * @example
   * ```ts
   * import type { TrayHostWatcher } from "@noldova/desktop.electron";
   *
   * export function watch(watcher: TrayHostWatcher): void {
   *   watcher.start();
   * }
   * ```
   */
  public start(): void;

  /**
   * Stops watching, ends the monitor and ignores answers that arrive afterward; the last answer stays.
   *
   * @example
   * ```ts
   * import type { TrayHostWatcher } from "@noldova/desktop.electron";
   *
   * export function close(watcher: TrayHostWatcher): void {
   *   watcher.stop();
   * }
   * ```
   */
  public stop(): void;
}

/**
 * The update's states, which the window shows.
 */
export declare enum UpdateStateKind {
  /**
   * The build names no update feed, so it never checks.
   */
  Off = "Off",
  /**
   * No newer version was found, or no check has run yet.
   */
  UpToDate = "UpToDate",
  /**
   * A check is running.
   */
  Checking = "Checking",
  /**
   * A newer version was found on macOS outside an Applications folder, where nothing downloads.
   */
  Available = "Available",
  /**
   * A newer version is downloading.
   */
  Downloading = "Downloading",
  /**
   * A downloaded, checked version waits for Restart to update.
   */
  Ready = "Ready",
  /**
   * A check the person asked for, or a download, failed.
   */
  Failed = "Failed"
}

/**
 * The exception thrown when the main process cannot use the data folder it was given, whose message names the folder and
 * the reason and is what the start-failure box shows.
 */
export declare class UnusableFolderException extends ElectronException {
  /**
   * The data folder the main process cannot use.
   */
  public readonly folder: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param folder The data folder.
   * @param cause The error that using the folder gave.
   * @example
   * ```ts
   * import { UnusableFolderException } from "@noldova/desktop.electron";
   *
   * export const failure: UnusableFolderException = new UnusableFolderException("/home/person/data", new Error("Failed to set path"));
   * ```
   */
  public constructor(folder: string, cause: unknown);
}

/**
 * The category of a failed update, whose message is the reason the window shows.
 * Its subclasses name each condition: {@link UpdateFeedRefusedException}, {@link UpdateFeedRedirectedException}, {@link UpdateFeedUnreachableException}, {@link UpdateInfoInvalidException}, {@link UpdateDownloadInterruptedException}, {@link UpdateDownloadMismatchException}, {@link UpdateNotSignedException}, {@link UpdateCheckerUnknownException}, {@link UpdateFailedUnexpectedlyException}.
 */
export declare abstract class UpdateException extends ElectronException {
  /**
   * Initializes the message and the cause for a subclass.
   *
   * @param message The complete explanation, from the package's own text.
   * @param options The failure that caused this one, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the update feed answers with an HTTP status that isn't a success.
 */
export declare class UpdateFeedRefusedException extends UpdateException {
  /**
   * The HTTP status the update feed answered with.
   */
  public readonly status: number;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param status The HTTP status the update feed answered with.
   * @example
   * ```ts
   * import { UpdateFeedRefusedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateFeedRefusedException = new UpdateFeedRefusedException(404);
   * ```
   */
  public constructor(status: number);
}

/**
 * The exception thrown when the update feed redirects to an address with another protocol.
 */
export declare class UpdateFeedRedirectedException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { UpdateFeedRedirectedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateFeedRedirectedException = new UpdateFeedRedirectedException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the update feed cannot be reached.
 */
export declare class UpdateFeedUnreachableException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The failure that kept the feed from being reached, if any.
   * @example
   * ```ts
   * import { UpdateFeedUnreachableException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateFeedUnreachableException = new UpdateFeedUnreachableException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when the release's information from the update feed is invalid.
 */
export declare class UpdateInfoInvalidException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The failure that found the information invalid, if any.
   * @example
   * ```ts
   * import { UpdateInfoInvalidException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateInfoInvalidException = new UpdateInfoInvalidException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when an update's download is interrupted.
 */
export declare class UpdateDownloadInterruptedException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The failure that interrupted the download, if any.
   * @example
   * ```ts
   * import { UpdateDownloadInterruptedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateDownloadInterruptedException = new UpdateDownloadInterruptedException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when an update's download doesn't match the release.
 */
export declare class UpdateDownloadMismatchException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The failure that found the mismatch, if any.
   * @example
   * ```ts
   * import { UpdateDownloadMismatchException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateDownloadMismatchException = new UpdateDownloadMismatchException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when a downloaded update isn't signed by the publisher.
 */
export declare class UpdateNotSignedException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The failure that refused the signature, if any.
   * @example
   * ```ts
   * import { UpdateNotSignedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateNotSignedException = new UpdateNotSignedException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when the main process cannot identify its own process, so it cannot check for updates.
 */
export declare class UpdateCheckerUnknownException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { UpdateCheckerUnknownException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateCheckerUnknownException = new UpdateCheckerUnknownException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when a check or a download stops on an unexpected error.
 */
export declare class UpdateFailedUnexpectedlyException extends UpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The unexpected error, if any.
   * @example
   * ```ts
   * import { UpdateFailedUnexpectedlyException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateFailedUnexpectedlyException = new UpdateFailedUnexpectedlyException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The runtime options electron-updater gives a custom provider, which {@link FeedProvider} passes on.
 */
export interface IFeedRuntimeOptions {
  /**
   * Whether a download may ask for several byte ranges in one request.
   */
  readonly isUseMultipleRangeRequest: boolean;

  /**
   * The platform the update is for.
   */
  readonly platform: "darwin" | "linux" | "win32";

  /**
   * electron-updater's HTTP executor, which must be its `ElectronHttpExecutor`.
   */
  readonly executor: object;
}

/**
 * The response of the update feed, as `fetch` gives it.
 */
export interface IFeedResponse {
  /**
   * Whether the status is in the 200 range.
   */
  readonly ok: boolean;

  /**
   * The HTTP status.
   */
  readonly status: number;

  /**
   * The URL that answered, after any redirects.
   */
  readonly url: string;

  /**
   * The body as a stream, as `fetch` gives it; optional. The feed provider
   * cancels it when it refuses the answer without reading it, so a server
   * that keeps the body open doesn't hold the connection until the timeout.
   */
  readonly body?: ReadableStream<Uint8Array> | null;

  /**
   * Reads the body as text.
   *
   * @returns A promise of the body.
   * @example
   * ```ts
   * import type { IFeedResponse } from "@noldova/desktop.electron";
   *
   * export function readAsync(response: IFeedResponse): Promise<string> {
   *   return response.text();
   * }
   * ```
   */
  text(): Promise<string>;
}

/**
 * What a main process updates with: its platform's updater and the handoff that installs what the updater made ready.
 */
export interface IUpdateSetup {
  /**
   * The updater, which checks, downloads and validates.
   */
  readonly updater: IUpdater;

  /**
   * The handoff of the main process's platform.
   */
  readonly handoff: IUpdateHandoff;
}

/**
 * Checks for a newer version and downloads it.
 */
export interface IUpdater {
  /**
   * The file the last download in this process gave, or `null` before one has and while a download runs.
   */
  readonly downloadedFile: string | null;

  /**
   * Checks the feed.
   *
   * @returns A promise of the newer version, or `null` when this one is up to date; it rejects with an
   * {@link UpdateException} that gives the reason.
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/desktop.electron";
   *
   * export async function isUpToDateAsync(updater: IUpdater): Promise<boolean> {
   *   return await updater.checkAsync() === null;
   * }
   * ```
   */
  checkAsync(): Promise<string | null>;

  /**
   * Downloads the version the last check found and checks it against the release.
   *
   * @param version The version the last check found, which names the only file the download may give,
   * {@link IUpdater.formatPackagePath}.
   * @param onProgress Receives the progress as a whole percentage.
   * @returns A promise of the downloaded file; it rejects with an {@link UpdateException} that gives the reason.
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/desktop.electron";
   *
   * export function downloadAsync(updater: IUpdater): Promise<string> {
   *   return updater.downloadAsync("1.3.0", t => console.log(`${t}%`));
   * }
   * ```
   */
  downloadAsync(version: string, onProgress: (percent: number) => void): Promise<string>;

  /**
   * Gives the only file a download of a version may give: the version's released package in the updater's cache for
   * the installation.
   *
   * @param version The version.
   * @returns The package's path.
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/desktop.electron";
   *
   * export function isPackage(updater: IUpdater, file: string): boolean {
   *   return file === updater.formatPackagePath("1.3.0");
   * }
   * ```
   */
  formatPackagePath(version: string): string;

  /**
   * Gives the signature the update information of the last check carries for a file, which the ready update's record
   * keeps, so a handoff after a restart can check it again.
   *
   * @param file The downloaded package.
   * @returns The signature, in base64, or `null` when the information carries none for the file.
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/desktop.electron";
   *
   * export function isSigned(updater: IUpdater, file: string): boolean {
   *   return updater.readSignature(file) !== null;
   * }
   * ```
   */
  readSignature(file: string): string | null;

  /**
   * Cancels the download in progress, if any.
   *
   * @example
   * ```ts
   * import type { IUpdater } from "@noldova/desktop.electron";
   *
   * export function quit(updater: IUpdater): void {
   *   updater.cancel();
   * }
   * ```
   */
  cancel(): void;
}

/**
 * Lets one main process of an installation check for updates at a time.
 */
export interface IUpdateCheckLock {
  /**
   * Takes the lock unless a running main process holds it.
   *
   * @returns A promise of whether this main process now holds the lock.
   * @example
   * ```ts
   * import type { IUpdateCheckLock } from "@noldova/desktop.electron";
   *
   * export function tryAsync(lock: IUpdateCheckLock): Promise<boolean> {
   *   return lock.tryAcquireAsync();
   * }
   * ```
   */
  tryAcquireAsync(): Promise<boolean>;

  /**
   * Lets go of the lock this main process holds, if any.
   *
   * @returns A promise that settles once the lock is let go.
   * @example
   * ```ts
   * import type { IUpdateCheckLock } from "@noldova/desktop.electron";
   *
   * export function releaseAsync(lock: IUpdateCheckLock): Promise<void> {
   *   return lock.releaseAsync();
   * }
   * ```
   */
  releaseAsync(): Promise<void>;
}

/**
 * The part of electron-updater's `AppUpdater` that {@link FeedUpdater} drives.
 */
export interface IAppUpdater {
  /**
   * Whether a check downloads at once.
   */
  autoDownload: boolean;
  /**
   * Whether quitting installs a downloaded update.
   */
  autoInstallOnAppQuit: boolean;
  /**
   * Whether an older version is offered.
   */
  allowDowngrade: boolean;
  /**
   * Whether a prerelease is offered.
   */
  allowPrerelease: boolean;
  /**
   * Whether only changed blocks download.
   */
  disableDifferentialDownload: boolean;
  /**
   * Whether a web installer is refused.
   */
  disableWebInstaller: boolean;
  /**
   * Receives the updater's messages.
   */
  logger: Logger | null;
  /**
   * The file of the updater's own settings.
   */
  updateConfigPath: string | null;
  /**
   * Decides whether a found version is offered.
   */
  isUpdateSupported: (info: UpdateInfo) => boolean | Promise<boolean>;

  /**
   * Sets the feed's provider.
   *
   * @param options The custom provider and its source.
   * @example
   * ```ts
   * import { FeedProvider, type FeedSource, type IAppUpdater } from "@noldova/desktop.electron";
   *
   * export function point(updater: IAppUpdater, source: FeedSource): void {
   *   updater.setFeedURL({ provider: "custom", updateProvider: FeedProvider, source });
   * }
   * ```
   */
  setFeedURL(options: { readonly provider: "custom"; readonly updateProvider: typeof FeedProvider; readonly source: FeedSource }): void;

  /**
   * Checks the feed.
   *
   * @returns A promise of the result, or `null` when the updater is not active.
   * @example
   * ```ts
   * import type { IAppUpdater } from "@noldova/desktop.electron";
   *
   * export async function hasUpdateAsync(updater: IAppUpdater): Promise<boolean> {
   *   return (await updater.checkForUpdates())?.isUpdateAvailable === true;
   * }
   * ```
   */
  checkForUpdates(): Promise<{ readonly isUpdateAvailable: boolean; readonly updateInfo: UpdateInfo } | null>;

  /**
   * Downloads the update the last check found.
   *
   * @param cancellationToken Cancels the download.
   * @returns A promise of the downloaded files.
   * @example
   * ```ts
   * import { CancellationToken } from "electron-updater";
   * import type { IAppUpdater } from "@noldova/desktop.electron";
   *
   * export function downloadAsync(updater: IAppUpdater): Promise<string[]> {
   *   return updater.downloadUpdate(new CancellationToken());
   * }
   * ```
   */
  downloadUpdate(cancellationToken: CancellationToken): Promise<string[]>;

  /**
   * Listens to the download's progress.
   *
   * @param event `download-progress`.
   * @param listener Receives the progress.
   * @returns The updater.
   * @example
   * ```ts
   * import type { IAppUpdater } from "@noldova/desktop.electron";
   *
   * export function watch(updater: IAppUpdater): void {
   *   updater.on("download-progress", t => console.log(t.percent));
   * }
   * ```
   */
  on(event: "download-progress", listener: (info: ProgressInfo) => void): unknown;

  /**
   * Stops listening to the download's progress.
   *
   * @param event `download-progress`.
   * @param listener The listener given to {@link IAppUpdater.on}.
   * @returns The updater.
   * @example
   * ```ts
   * import type { IAppUpdater } from "@noldova/desktop.electron";
   *
   * export function unwatch(updater: IAppUpdater, listener: () => void): void {
   *   updater.removeListener("download-progress", listener);
   * }
   * ```
   */
  removeListener(event: "download-progress", listener: (info: ProgressInfo) => void): unknown;
}

/**
 * What a window part asks the main process for when it asks for files: the module the grants are for, how long they live
 * and whether the person may pick more than one.
 */
export declare class FileGrantRequest {
  /**
   * The module whose runtime part may redeem the grants.
   */
  public readonly module: string;

  /**
   * How long each grant lives, in milliseconds, at most {@link FileGrant.maximumLifetime}.
   */
  public readonly lifetime: number;

  /**
   * Whether the file chooser lets the person pick more than one file.
   */
  public readonly isMultiple: boolean;

  /**
   * Creates the request.
   *
   * @param module The module whose runtime part may redeem the grants.
   * @param lifetime How long each grant lives, in milliseconds.
   * @param isMultiple Whether the person may pick more than one file.
   * @example
   * ```ts
   * import { FileGrantRequest } from "@noldova/desktop.electron";
   *
   * export const request: FileGrantRequest = new FileGrantRequest("notes", 60_000, false);
   * ```
   */
  public constructor(module: string, lifetime: number, isMultiple: boolean);

  /**
   * Reads a request a window's page sent.
   *
   * @param module The module id, never `desktop`.
   * @param options An object with an optional `lifetime`, a positive whole number of milliseconds up to
   * {@link FileGrant.maximumLifetime} and that by default, and an optional `multiple`, `false` by default.
   * @returns The request, or `null` when the module is not a module id or the options are not such an object.
   * @example
   * ```ts
   * import { FileGrantRequest } from "@noldova/desktop.electron";
   *
   * export const request: FileGrantRequest | null = FileGrantRequest.read("notes", { multiple: true });
   * ```
   */
  public static read(module: unknown, options: unknown): FileGrantRequest | null;
}

/**
 * What a window part asks the main process for when it asks the person to choose one file by its path: the extensions
 * the person may pick and the folder the chooser starts in.
 */
export declare class FilePathChoice {
  /**
   * The file name extensions the person may pick, without the dot; any file when empty.
   */
  public readonly extensions: readonly string[];

  /**
   * The absolute path of the folder the chooser starts in, or `null` for where the system starts it.
   */
  public readonly folder: string | null;

  /**
   * Creates the choice.
   *
   * @param extensions The file name extensions the person may pick; any file when empty.
   * @param folder The absolute path of the folder the chooser starts in, or `null`.
   * @example
   * ```ts
   * import { FilePathChoice } from "@noldova/desktop.electron";
   *
   * export const choice: FilePathChoice = new FilePathChoice(["exe"], null);
   * ```
   */
  public constructor(extensions: readonly string[], folder: string | null);

  /**
   * Reads a choice a window's page sent.
   *
   * @param options An object with an optional `extensions`, 1 to 32 extensions of 1 to 16 letters and digits each, any
   * file by default, and an optional `folder`, an absolute path without control characters.
   * @returns The choice, or `null` when the options are not such an object.
   * @example
   * ```ts
   * import { FilePathChoice } from "@noldova/desktop.electron";
   *
   * export const choice: FilePathChoice | null = FilePathChoice.read({ extensions: ["exe", "cmd"] });
   * ```
   */
  public static read(options: unknown): FilePathChoice | null;
}

/**
 * A file a window part offers a module: a file the person picked or dropped, by its path, or one they pasted, by its bytes.
 */
export declare class OfferedFile {
  /**
   * The file's name as the person sees it.
   */
  public readonly name: string;

  /**
   * The file's media type in lowercase, `application/octet-stream` when the window didn't know it.
   */
  public readonly mediaType: string;

  /**
   * The file's absolute path, or `null` for a pasted file.
   */
  public readonly path: string | null;

  /**
   * A pasted file's bytes, or `null` for a file with a path and for a paste larger than the main process stages.
   */
  public readonly bytes: Uint8Array | null;

  /**
   * The file's size in bytes as the window saw it; a granted path's size is measured again.
   */
  public readonly size: number;

  /**
   * Creates the offered file.
   *
   * @param name The file's name.
   * @param mediaType The file's media type.
   * @param filePath The file's absolute path, or `null`.
   * @param bytes A pasted file's bytes, or `null`.
   * @param size The file's size in bytes.
   * @example
   * ```ts
   * import { OfferedFile } from "@noldova/desktop.electron";
   *
   * export const pasted: OfferedFile = new OfferedFile("image.png", "image/png", null, new Uint8Array([137, 80, 78, 71]), 4);
   * ```
   */
  public constructor(name: string, mediaType: string, filePath: string | null, bytes: Uint8Array | null, size: number);

  /**
   * The file the person picked in a file chooser, named by its path, with no media type.
   *
   * @param filePath The picked file's absolute path.
   * @returns The offered file.
   * @example
   * ```ts
   * import { OfferedFile } from "@noldova/desktop.electron";
   *
   * export const picked: OfferedFile = OfferedFile.ofPath("/home/ada/report.pdf");
   * ```
   */
  public static ofPath(filePath: string): OfferedFile;

  /**
   * Reads a file a window's page sent: an object with a `name`, a `type` and a `size`, and either an absolute `path` or
   * `bytes` of that size; with neither, a paste that would take its call past 64 MiB, which is then refused. A blank or overlong name
   * becomes the path's last part, or `pasted`; a type that is not a type and subtype becomes `application/octet-stream`.
   *
   * @param value The value the page sent.
   * @returns The offered file, or `null` when the value is not one.
   * @example
   * ```ts
   * import { OfferedFile } from "@noldova/desktop.electron";
   *
   * export const dropped: OfferedFile | null = OfferedFile.read({ name: "report.pdf", type: "application/pdf", path: "/home/ada/report.pdf", size: 1204 });
   * ```
   */
  public static read(value: unknown): OfferedFile | null;
}

/**
 * What the main process answers a window part that asked for files: each granted file's grant, name, media type and size,
 * and why each other file was not granted.
 */
export declare class IssuedFiles {
  /**
   * The answer when no file was granted or refused, such as when the person cancelled the file chooser.
   */
  public static readonly none: IssuedFiles;

  /**
   * Each granted file as `{ grant, name, mediaType, size }`, never its path.
   */
  public readonly granted: readonly JsonObject[];

  /**
   * One sentence for each file not granted, naming the file and why.
   */
  public readonly refused: readonly string[];

  /**
   * Creates the answer.
   *
   * @param granted The granted files.
   * @param refused Why each other file was not granted.
   * @example
   * ```ts
   * import { IssuedFiles } from "@noldova/desktop.electron";
   *
   * export const issued: IssuedFiles = new IssuedFiles([], ["pipe was not given to the module: it is not a regular file."]);
   * ```
   */
  public constructor(granted: readonly JsonObject[], refused: readonly string[]);

  /**
   * Writes the answer as JSON, `{ granted, refused }`.
   *
   * @returns The answer's JSON form.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { IssuedFiles } from "@noldova/desktop.electron";
   *
   * export const answer: JsonObject = IssuedFiles.none.toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Serves the files runtime parts share with a window on the main process's own scheme, `desktop-file`, each at
 * `desktop-file://<grant>/`. For each request it asks the runtime for the share through `desktop.resolveFileShare`,
 * checks that the share's page is still the one its window shows, opens the file without waiting and, off Windows,
 * without following a link, compares the open file's identity with the share's, and streams the file. A raster image the
 * allow-list names, PNG, JPEG, GIF or WebP, is served with its media type, and any other file as
 * `application/octet-stream`; every answer carries `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` and a
 * sandboxing content security policy. Anything refused is a plain 404 with a log line that names the reason, never the
 * path or the grant.
 */
export declare class SharedFileServer {
  /**
   * The scheme with its privileges: standard and secure, and nothing more, so it can't fetch, bypass the page's content
   * security policy, or be read across origins.
   */
  public static readonly scheme: CustomScheme;

  /**
   * Creates the server.
   *
   * @param resolveAsync Asks the runtime for a share by its grant.
   * @param isLive Tells whether a window, by its web contents' id, still shows the page of that serial.
   * @param log Writes a refusal's line.
   * @example
   * ```ts
   * import { FileShareResolve, ShellMethods } from "@noldova/desktop.protocol";
   * import { type IRuntimeConnection, SharedFileServer } from "@noldova/desktop.electron";
   *
   * export function createServer(connection: IRuntimeConnection): SharedFileServer {
   *   return new SharedFileServer(t => connection.callAsync(ShellMethods.resolveFileShare, new FileShareResolve(t).toJson()), () => true,
   *     t => process.stderr.write(`${t}\n`));
   * }
   * ```
   */
  public constructor(resolveAsync: (grant: string) => Promise<Response>, isLive: (window: number, page: number) => boolean, log: (line: string) => void);

  /**
   * Serves the scheme on a window's session, once however many windows share it.
   *
   * @param session The window's session.
   * @example
   * ```ts
   * import type { IMainProcessWindow, SharedFileServer } from "@noldova/desktop.electron";
   *
   * export function serve(server: SharedFileServer, window: IMainProcessWindow): void {
   *   server.serveOn(window.webContents.session);
   * }
   * ```
   */
  public serveOn(session: IWindowSession): void;

  /**
   * Answers one request on the scheme: the file's bytes, or a plain 404 when the request is not a `GET` of a share's
   * exact address, the runtime refuses the grant, the share's page ended, the file can't be opened, or it changed or was
   * replaced since it was shared.
   *
   * @param request The request.
   * @returns The answer.
   * @example
   * ```ts
   * import type { SharedFileServer } from "@noldova/desktop.electron";
   *
   * export function loadAsync(server: SharedFileServer): Promise<globalThis.Response> {
   *   return server.serveAsync(new Request("desktop-file://8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21/"));
   * }
   * ```
   */
  public serveAsync(request: Request): Promise<globalThis.Response>;
}

/**
 * Issues file grants for the files a window part offers a module, through `desktop.grantFile`. A path is resolved to the
 * real file it names, which must be a regular file, never a folder, a FIFO, a socket or a device, and is granted with its
 * identity; it is never opened here, so nothing can block. On Windows only a path on a drive is granted, never a network or
 * device path: another path is refused before any file system call, a link that leads off the drive before it is followed,
 * and a file whose real path is off the drive, such as one on a mapped network drive, before it is granted. A paste's bytes are staged as a new file named by its grant in
 * the staged folder, at most 64 MiB in one call and 256 MiB in the folder, and the copy is deleted when the runtime refuses
 * it. Calls are issued one at a time, so concurrent calls stay within those limits.
 */
export declare class FileGrantIssuer {
  /**
   * Creates the issuer.
   *
   * @param stagedFolder The data directory's staged folder, which the runtime clears.
   * @param platform The platform whose path rules apply, such as `process.platform`.
   * @param files The file system calls that resolve a path, such as Node.js's `lstat`, `readlink` and `realpath`.
   * @param grantAsync Sends one grant to the runtime.
   * @param drawGrant Draws a new grant; 16 random bytes in hexadecimal by default.
   * @example
   * ```ts
   * import { lstat, readlink, realpath } from "node:fs/promises";
   *
   * import { ShellMethods } from "@noldova/desktop.protocol";
   * import { FileGrantIssuer, type IRuntimeConnection } from "@noldova/desktop.electron";
   * import type { DataDirectory } from "@noldova/desktop.runtime";
   *
   * export function createIssuer(directory: DataDirectory, connection: IRuntimeConnection): FileGrantIssuer {
   *   return new FileGrantIssuer(directory.stagedFolder, process.platform, { lstat, readlink, realpath },
   *     t => connection.callAsync(ShellMethods.grantFile, t.toJson()));
   * }
   * ```
   */
  public constructor(stagedFolder: string, platform: string, files: IShownPathFiles, grantAsync: (grant: FileGrant) => Promise<Response>, drawGrant?: () => string);

  /**
   * Grants each offered file to the module for the window's page, in order.
   *
   * @param files The offered files.
   * @param module The module whose runtime part may redeem the grants.
   * @param window The window, by its web contents' id.
   * @param page The serial of the window's page.
   * @param lifetime How long each grant lives, in milliseconds.
   * @returns The granted files and why each other one was not granted; a file the runtime refuses is refused with its reason.
   * @example
   * ```ts
   * import { type FileGrantIssuer, type IssuedFiles, OfferedFile } from "@noldova/desktop.electron";
   *
   * export function grantAsync(issuer: FileGrantIssuer, window: number, page: number): Promise<IssuedFiles> {
   *   return issuer.issueAsync([OfferedFile.ofPath("/home/ada/report.pdf")], "notes", window, page, 600_000);
   * }
   * ```
   */
  public issueAsync(files: readonly OfferedFile[], module: string, window: number, page: number, lifetime: number): Promise<IssuedFiles>;
}

/**
 * Where the update feed is and which of its files belong to this platform and processor.
 */
export declare class FeedSource {
  /**
   * The feed's URL, ending in `/`.
   */
  public readonly feed: string;
  /**
   * The update information's file, `latest-<platform>-<arch>.yml`.
   */
  public readonly channelFile: string;
  /**
   * The package's name without a version, `<product>-<platform>-<arch>.<ext>`, which a feed whose files carry no version
   * lists for every version.
   */
  public readonly packageFile: string;
  /**
   * Fetches a URL anonymously, following redirects, until the signal aborts.
   */
  public readonly fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>;
  /**
   * Gives the signal that aborts a fetch after the milliseconds it takes, `AbortSignal.timeout` unless the source was
   * given another.
   */
  public readonly timeout: (milliseconds: number) => AbortSignal;
  /**
   * Names the package of a version as the update information lists it and the feed serves it,
   * `<product>-<version>-<platform>-<arch>.<ext>` for a source {@link FeedSource.create} makes.
   */
  public readonly formatReleasedFile: (version: string) => string;

  /**
   * Creates the source.
   *
   * @param feed The feed's URL, ending in `/`.
   * @param channelFile The update information's file.
   * @param packageFile The package's name without a version.
   * @param fetchAsync Fetches a URL anonymously, following redirects, until the signal aborts; the signal aborts when the
   * feed hasn't answered with the whole information file within 30 seconds.
   * @param timeout Gives the signal that aborts a fetch after the milliseconds it takes; `AbortSignal.timeout` by default.
   * @param formatReleasedFile Names the package of the version the update information names, as it lists it; by default
   * `packageFile` for every version.
   * @example
   * ```ts
   * import { FeedSource } from "@noldova/desktop.electron";
   *
   * export const source: FeedSource = new FeedSource("http://127.0.0.1:8080/", "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", (url, signal) => fetch(url, { signal }),
   *   undefined, version => `Noldova Desktop Sample-${version}-linux-x64.AppImage`);
   * ```
   */
  public constructor(feed: string, channelFile: string, packageFile: string, fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>, timeout?: (milliseconds: number) => AbortSignal,
    formatReleasedFile?: (version: string) => string);

  /**
   * Creates the source of a platform and processor: Windows' installer, macOS's ZIP or Linux's AppImage, or its Debian
   * package for a copy installed from one, on x64 or ARM64; the feed has 30 seconds to answer.
   *
   * @param feed The product's feed, or `null` for a build that never checks.
   * @param productName The product's name, which starts the package's name.
   * @param platform Node's platform, such as `win32`.
   * @param architecture Node's processor, such as `arm64`.
   * @param fetchAsync Fetches a URL anonymously, following redirects, until the signal aborts.
   * @param isDebianPackage Whether this copy was installed from the Debian package, as {@link DebianPackage.isInstalled}
   * tells, so that on Linux the source names the `.deb` rather than the AppImage; `false` by default.
   * @returns The source, or `null` when there is no feed or the target has no packages.
   * @example
   * ```ts
   * import { FeedSource } from "@noldova/desktop.electron";
   *
   * export const source: FeedSource | null = FeedSource.create("http://127.0.0.1:8080/", "Noldova Desktop Sample", process.platform, process.arch, (url, signal) => fetch(url, { signal }));
   * ```
   */
  public static create(feed: string | null, productName: string, platform: string, architecture: string, fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>,
    isDebianPackage?: boolean): FeedSource | null;
}

/**
 * The part of an Electron session's `webRequest` that {@link FeedRequestGuard} uses.
 */
export interface IFeedWebRequest {
  /**
   * Decides, before it is sent, whether a request of the session goes ahead, a redirect's next request too.
   *
   * @param listener Gets the request's URL and answers whether to cancel it.
   * @example
   * ```ts
   * import type { IFeedWebRequest } from "@noldova/desktop.electron";
   *
   * export function allowHttps(webRequest: IFeedWebRequest): void {
   *   webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith("https:") }));
   * }
   * ```
   */
  onBeforeRequest(listener: (details: { readonly url: string }, callback: (response: { readonly cancel: boolean }) => void) => void): void;

  /**
   * Gives the headers a request of the session sends.
   *
   * @param listener Gets the request's headers and answers with those it sends.
   * @example
   * ```ts
   * import type { IFeedWebRequest } from "@noldova/desktop.electron";
   *
   * export function sendAsIs(webRequest: IFeedWebRequest): void {
   *   webRequest.onBeforeSendHeaders((details, callback) => callback({ requestHeaders: { ...details.requestHeaders } }));
   * }
   * ```
   */
  onBeforeSendHeaders(listener: (details: { readonly id: number; readonly requestHeaders: Readonly<Record<string, string>> },
    callback: (response: { readonly requestHeaders: Record<string, string> }) => void) => void): void;

  /**
   * Tells when the first byte of a request's response arrives.
   *
   * @param listener Gets the request's identifier.
   * @example
   * ```ts
   * import type { IFeedWebRequest } from "@noldova/desktop.electron";
   *
   * export function logAnswers(webRequest: IFeedWebRequest): void {
   *   webRequest.onResponseStarted(details => console.log(`Request ${details.id} was answered.`));
   * }
   * ```
   */
  onResponseStarted(listener: (details: { readonly id: number }) => void): void;

  /**
   * Tells when a request fails before or while its response arrives.
   *
   * @param listener Gets the request's identifier.
   * @example
   * ```ts
   * import type { IFeedWebRequest } from "@noldova/desktop.electron";
   *
   * export function logFailures(webRequest: IFeedWebRequest): void {
   *   webRequest.onErrorOccurred(details => console.log(`Request ${details.id} failed.`));
   * }
   * ```
   */
  onErrorOccurred(listener: (details: { readonly id: number }) => void): void;
}

/**
 * The part of an Electron session that {@link FeedSession} uses: its `webRequest` and `fetch`.
 */
export interface IFeedNetSession {
  /**
   * The session's request events.
   */
  readonly webRequest: IFeedWebRequest;

  /**
   * Fetches a URL through the session.
   *
   * @param url The URL.
   * @param init The signal that aborts the request.
   * @returns A promise of the response.
   * @example
   * ```ts
   * import type { IFeedNetSession, IFeedResponse } from "@noldova/desktop.electron";
   *
   * export function fetchAsync(session: IFeedNetSession, url: string): Promise<IFeedResponse> {
   *   return session.fetch(url, { signal: AbortSignal.timeout(30000) });
   * }
   * ```
   */
  fetch(url: string, init: { readonly signal: AbortSignal }): Promise<IFeedResponse>;
}

/**
 * Keeps the date of an app's last update check marked as the day's first, by the app's local date, and nothing else.
 */
export declare class DailyCheckMark {
  /**
   * Creates the mark kept in a file.
   *
   * @param file The file that holds the date of the last marked check.
   * @param now Gives the current time.
   * @param log Writes a line to the main process's log, when the date could not be recorded.
   * @example
   * ```ts
   * import { DailyCheckMark } from "@noldova/desktop.electron";
   *
   * const mark = new DailyCheckMark("/tmp/last-daily-update-check", () => new Date(), console.log);
   * ```
   */
  public constructor(file: string, now: () => Date, log: (text: string) => void);

  /**
   * Formats a local date as the mark's file holds it.
   *
   * @param date The date.
   * @returns The local date, such as `2026-11-08`.
   * @example
   * ```ts
   * import { DailyCheckMark } from "@noldova/desktop.electron";
   *
   * const today = DailyCheckMark.formatDate(new Date());
   * ```
   */
  public static formatDate(date: Date): string;

  /**
   * Takes the day's mark: a call gets it unless the file, read on every call, or this mark already holds today's local date,
   * and then the mark holds the date until it is recorded or released.
   * Calls take their turn one after another, so two requests at once never both get it.
   *
   * @returns A promise of whether this request carries the day's mark.
   * @example
   * ```ts
   * import type { DailyCheckMark } from "@noldova/desktop.electron";
   *
   * export function isFirstTodayAsync(mark: DailyCheckMark): Promise<boolean> {
   *   return mark.takeAsync();
   * }
   * ```
   */
  public takeAsync(): Promise<boolean>;

  /**
   * Records the date the mark holds in its file, once the marked request was answered; it does nothing when the mark holds no date.
   * When the date can't be written, the mark still holds for this main process, and the failure is logged.
   *
   * @returns A promise that settles once the date is written or the failure logged.
   * @example
   * ```ts
   * import type { DailyCheckMark } from "@noldova/desktop.electron";
   *
   * export function answeredAsync(mark: DailyCheckMark): Promise<void> {
   *   return mark.recordAsync();
   * }
   * ```
   */
  public recordAsync(): Promise<void>;

  /**
   * Releases the date the mark holds, when the marked request failed, so the day's next request takes the mark.
   *
   * @example
   * ```ts
   * import type { DailyCheckMark } from "@noldova/desktop.electron";
   *
   * export function failed(mark: DailyCheckMark): void {
   *   mark.release();
   * }
   * ```
   */
  public release(): void;
}

/**
 * Keeps the updater's requests to the feed: each request, a redirect's too, goes only to the feed's origin or GitHub's release asset
 * host, and anything else is cancelled and logged with its host alone. A request sends the User-Agent that names the app, its
 * version, platform and architecture, and `daily` on the day's first request, and of its own headers only `Accept`, `Range` and
 * `Cache-Control`. The day's mark is recorded once the marked request's response starts, and released when it fails.
 */
export declare class FeedRequestGuard {
  /**
   * Creates the guard of a feed.
   *
   * @param feed The feed's folder URL.
   * @param product The app's slug, version, platform and architecture.
   * @param mark The day's first-check mark.
   * @param log Writes a line to the main process's log.
   * @example
   * ```ts
   * import { DailyCheckMark, FeedRequestGuard } from "@noldova/desktop.electron";
   *
   * const mark = new DailyCheckMark("/tmp/last-daily-update-check", () => new Date(), console.log);
   * const guard = new FeedRequestGuard("https://updates.example.test/", ["sample-app", "1.2.3", "linux", "x64"], mark, console.log);
   * ```
   */
  public constructor(feed: string, product: readonly [slug: string, version: string, platform: string, architecture: string], mark: DailyCheckMark,
    log: (text: string) => void);

  /**
   * Formats the User-Agent of an app's update requests.
   *
   * @param product The app's slug, version, platform and architecture.
   * @param isDaily Whether the request is the day's first.
   * @returns The User-Agent, such as `sample-app/1.2.3 (linux; x64)`, or `sample-app/1.2.3 (linux; x64; daily)` for the day's first.
   * @example
   * ```ts
   * import { FeedRequestGuard } from "@noldova/desktop.electron";
   *
   * const userAgent = FeedRequestGuard.formatUserAgent(["sample-app", "1.2.3", process.platform, process.arch], false);
   * ```
   */
  public static formatUserAgent(product: readonly [slug: string, version: string, platform: string, architecture: string], isDaily: boolean): string;

  /**
   * Says whether a request may go to a URL: one on the feed's origin or GitHub's release asset host.
   *
   * @param url The request's URL.
   * @returns Whether the request may go ahead.
   * @example
   * ```ts
   * import type { FeedRequestGuard } from "@noldova/desktop.electron";
   *
   * export function isAllowed(guard: FeedRequestGuard, url: string): boolean {
   *   return guard.allows(url);
   * }
   * ```
   */
  public allows(url: string): boolean;

  /**
   * Gives the headers a request sends: of its own only `Accept`, `Range` and `Cache-Control`, and the guard's User-Agent.
   *
   * @param headers The request's headers.
   * @param isDaily Whether the request is the day's first.
   * @returns The headers to send.
   * @example
   * ```ts
   * import type { FeedRequestGuard } from "@noldova/desktop.electron";
   *
   * export function headersOf(guard: FeedRequestGuard): Record<string, string> {
   *   return guard.headersOf({ Accept: "*\/*" }, false);
   * }
   * ```
   */
  public headersOf(headers: Readonly<Record<string, string>>, isDaily: boolean): Record<string, string>;

  /**
   * Keeps a session's requests by the guard's rules.
   *
   * @param webRequest The session's `webRequest`.
   * @example
   * ```ts
   * import type { FeedRequestGuard, IFeedWebRequest } from "@noldova/desktop.electron";
   *
   * export function guard(feed: FeedRequestGuard, webRequest: IFeedWebRequest): void {
   *   feed.install(webRequest);
   * }
   * ```
   */
  public install(webRequest: IFeedWebRequest): void;
}

/**
 * The session the updater fetches its feed through: it creates the session on the first fetch, installs a guard on it before
 * that fetch goes out, and reuses the session afterwards.
 */
export declare class FeedSession {
  /**
   * Creates the feed's session.
   *
   * @param create Creates the session, on the first fetch.
   * @param guard The guard installed on the session.
   * @example
   * ```ts
   * import { FeedSession, type FeedRequestGuard, type IFeedNetSession } from "@noldova/desktop.electron";
   *
   * export function sessionOf(create: () => IFeedNetSession, guard: FeedRequestGuard): FeedSession {
   *   return new FeedSession(create, guard);
   * }
   * ```
   */
  public constructor(create: () => IFeedNetSession, guard: FeedRequestGuard);

  /**
   * Fetches a URL through the guarded session.
   *
   * @param url The URL.
   * @param signal Aborts the request.
   * @returns A promise of the response.
   * @example
   * ```ts
   * import type { FeedSession, IFeedResponse } from "@noldova/desktop.electron";
   *
   * export function fetchLatestAsync(session: FeedSession): Promise<IFeedResponse> {
   *   return session.fetchAsync("https://updates.example.test/latest.yml", AbortSignal.timeout(30000));
   * }
   * ```
   */
  public fetchAsync(url: string, signal: AbortSignal): Promise<IFeedResponse>;
}

/**
 * electron-updater's provider for Noldova Desktop Sample's feed: it reads the update information of the source's target and gives
 * the package it names, resolved against the URL that answered, so the package comes from the same release.
 */
export declare class FeedProvider extends Provider<UpdateInfo> {
  /**
   * Creates the provider, as electron-updater does for a custom provider.
   *
   * @param options The feed's options, whose `source` is a {@link FeedSource}.
   * @param _updater The updater, which the provider does not use.
   * @param runtimeOptions electron-updater's runtime options, as it passes them to a custom provider.
   * @throws {ArgumentException} When the options hold no source, or the runtime options no electron-updater HTTP executor.
   * @example
   * ```ts
   * import { FeedProvider, type FeedSource, type IFeedRuntimeOptions } from "@noldova/desktop.electron";
   *
   * export function create(source: FeedSource, runtimeOptions: IFeedRuntimeOptions): FeedProvider {
   *   return new FeedProvider({ source }, null, runtimeOptions);
   * }
   * ```
   */
  public constructor(options: Readonly<Record<string, unknown>>, _updater: unknown, runtimeOptions: IFeedRuntimeOptions);

  /**
   * Reads the update information: its version and a package named as the source's, with a SHA-512 and a size.
   *
   * @returns A promise of the information; it rejects with an {@link UpdateException} when the feed cannot be
   * reached or refuses, or the information is invalid.
   * @example
   * ```ts
   * import type { FeedProvider } from "@noldova/desktop.electron";
   *
   * export async function latestAsync(provider: FeedProvider): Promise<string> {
   *   return (await provider.getLatestVersion()).version;
   * }
   * ```
   */
  public getLatestVersion(): Promise<UpdateInfo>;

  /**
   * Gives the package to download, beside the update information that was read.
   *
   * @param updateInfo The update information {@link FeedProvider.getLatestVersion} gave.
   * @returns The package.
   * @throws {UpdateException} When no information was read or it names no such package.
   * @example
   * ```ts
   * import type { UpdateInfo } from "electron-updater";
   * import type { FeedProvider } from "@noldova/desktop.electron";
   *
   * export function packageUrl(provider: FeedProvider, info: UpdateInfo): string | undefined {
   *   return provider.resolveFiles(info)[0]?.url.href;
   * }
   * ```
   */
  public resolveFiles(updateInfo: UpdateInfo): ResolvedUpdateFileInfo[];
}

/**
 * Drives electron-updater against Noldova Desktop Sample's feed: it checks without downloading, offers only a higher version without
 * a prerelease suffix, installs nothing by itself and gives each failure its reason.
 */
export declare class FeedUpdater implements IUpdater {
  /**
   * The file the last download in this process gave, or `null` before one has and while a download runs.
   */
  public get downloadedFile(): string | null;

  /**
   * Creates the updater and sets electron-updater up.
   *
   * @param updater electron-updater's updater for the platform.
   * @param source The feed.
   * @param installationFolder The installation's folder, which holds electron-updater's settings file
   * `update-config.json` and whose name, the installation's id, names its cache folder.
   * @param cacheRoot The user's cache folder, where electron-updater keeps `<slug>-updater-<installation id>`.
   * @param productSlug The product's slug.
   * @param verifyAsync Checks a downloaded file, given the update information of the last check, resolving to `null`
   * when it is the product's publisher's on Windows, or signed by a key the product ships on Linux, and otherwise to
   * why not; or `null` on macOS, whose updates Squirrel.Mac checks.
   * @param log Records the updater's warnings and errors, why a download failed its check, before the download is
   * deleted, and a download that failed its check but could not be deleted.
   * @example
   * ```ts
   * import { AppImageUpdater } from "electron-updater";
   * import { FeedSource, FeedUpdater } from "@noldova/desktop.electron";
   *
   * export const updater: FeedUpdater = new FeedUpdater(new AppImageUpdater(),
   *   new FeedSource("http://127.0.0.1:8080/", "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", (url, signal) => fetch(url, { signal })),
   *   "/home/person/.local/state/noldova/desktop/installations/0123456789abcdef", "/home/person/.cache", "noldova-desktop", null, console.error);
   * ```
   */
  public constructor(
    updater: IAppUpdater,
    source: FeedSource,
    installationFolder: string,
    cacheRoot: string,
    productSlug: string,
    verifyAsync: ((file: string, info: UpdateInfo | null) => Promise<string | null>) | null,
    log: (text: string) => void);

  /**
   * Checks the feed; before the first check it writes electron-updater's settings and then points it at the feed, since
   * naming the settings file drops the feed set before.
   *
   * @returns A promise of the newer version, or `null` when this one is up to date; it rejects with an
   * {@link UpdateException} that gives the reason, by default that the update stopped on an unexpected error.
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/desktop.electron";
   *
   * export function checkAsync(updater: FeedUpdater): Promise<string | null> {
   *   return updater.checkAsync();
   * }
   * ```
   */
  public checkAsync(): Promise<string | null>;

  /**
   * Downloads the version the last check found; electron-updater checks its SHA-512, and then the updater checks its
   * publisher, deleting a file that fails.
   *
   * @param version The version the last check found.
   * @param onProgress Receives the progress as a whole percentage.
   * @returns A promise of the downloaded file; it rejects with an {@link UpdateException} that gives the reason, by
   * default that the download was interrupted, and with an unexpected error when the file is not
   * {@link FeedUpdater.formatPackagePath} for the version.
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/desktop.electron";
   *
   * export function downloadAsync(updater: FeedUpdater): Promise<string> {
   *   return updater.downloadAsync("1.3.0", t => console.log(`${t}%`));
   * }
   * ```
   */
  public downloadAsync(version: string, onProgress: (percent: number) => void): Promise<string>;

  /**
   * Gives the only file a download of a version may give: the name electron-updater keeps it under, the last part of
   * the address {@link FeedProvider} gives, the source's {@link FeedSource.formatReleasedFile} for the version, in the
   * `pending` folder of its cache folder for the installation.
   *
   * @param version The version.
   * @returns The package's path.
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/desktop.electron";
   *
   * export function isPackage(updater: FeedUpdater, file: string): boolean {
   *   return file === updater.formatPackagePath("1.3.0");
   * }
   * ```
   */
  public formatPackagePath(version: string): string;

  /**
   * Gives the signature the update information of the last check carries for a file, as
   * {@link UpdateSignatureCheck.readSignature} reads it.
   *
   * @param file The downloaded package.
   * @returns The signature, in base64, or `null` before a check or when the information carries none for the file.
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/desktop.electron";
   *
   * export function readSignature(updater: FeedUpdater): string | null {
   *   return updater.readSignature(updater.formatPackagePath("1.3.0"));
   * }
   * ```
   */
  public readSignature(file: string): string | null;

  /**
   * Cancels the download in progress, if any.
   *
   * @example
   * ```ts
   * import type { FeedUpdater } from "@noldova/desktop.electron";
   *
   * export function quit(updater: FeedUpdater): void {
   *   updater.cancel();
   * }
   * ```
   */
  public cancel(): void;
}

/**
 * Lets one main process of an installation check for updates at a time with `update-check.lock` in the installation's
 * folder, which names the holder's process. It is created whole through a temporary file and a link, and a lock whose
 * process is gone, or that cannot be read as a process, is taken over; a lock that cannot be read at all counts as
 * held.
 */
export declare class UpdateCheckLock implements IUpdateCheckLock {
  /**
   * Creates the lock.
   *
   * @param folder The installation's folder.
   * @param stampAsync Gives this main process's process, or `null` when it cannot be found.
   * @param isRunningAsync Whether a holder's process still runs.
   * @param log Records a lock that could not be removed.
   * @example
   * ```ts
   * import type { Installation, ProcessPresence } from "@noldova/desktop.runtime";
   * import { UpdateCheckLock } from "@noldova/desktop.electron";
   *
   * export function create(installation: Installation, presence: ProcessPresence): UpdateCheckLock {
   *   return new UpdateCheckLock(installation.folder, async () => (await presence.stampAsync([[process.pid, "mainProcess"]]))[0] ?? null, t => presence.isRunningAsync(t), console.error);
   * }
   * ```
   */
  public constructor(folder: string, stampAsync: () => Promise<UpdateProcess | null>, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>, log: (text: string) => void);

  /**
   * Takes the lock unless another running main process holds it; a lock that still names this main process's process, left
   * behind by a release that failed, is taken back.
   *
   * @returns A promise of whether this main process now holds the lock.
   * @throws {UpdateException} Rejected when this main process's process cannot be found.
   * @throws {Error} Rejected when the lock can neither be created nor found, or a stale one cannot be removed. A stale lock is removed
   * through the runtime's `StaleFileRemoval`, only while it still holds the text judged stale, so main processes racing to
   * take it over end with one holder.
   * @example
   * ```ts
   * import type { UpdateCheckLock } from "@noldova/desktop.electron";
   *
   * export function tryAsync(lock: UpdateCheckLock): Promise<boolean> {
   *   return lock.tryAcquireAsync();
   * }
   * ```
   */
  public tryAcquireAsync(): Promise<boolean>;

  /**
   * Lets go of the lock this main process holds; a lock another main process has taken over since is left in place, and a lock
   * that cannot be removed is logged and left behind.
   *
   * @returns A promise that settles once the lock is let go; it never rejects.
   * @example
   * ```ts
   * import type { UpdateCheckLock } from "@noldova/desktop.electron";
   *
   * export function releaseAsync(lock: UpdateCheckLock): Promise<void> {
   *   return lock.releaseAsync();
   * }
   * ```
   */
  public releaseAsync(): Promise<void>;
}

/**
 * Checks that a Windows update carries a valid signature by the publisher. It reads the signature through the
 * runtime's Windows addon, off the main thread, and passes it only when Windows verifies it and its signer's
 * distinguished name holds every field of the publisher's; any other signature, one without a readable signer or a
 * failed read counts as failed, with one line saying why.
 */
export declare class PublisherCheck {
  /**
   * Creates the check.
   *
   * @param publisher The publisher's distinguished name, or null for an unsigned build, which fails every check.
   * @param signatures Reads a file's signature, as {@link IWindowsProcessApi.verifySignatureAsync} does.
   * @param log Records each check, its duration and whether it passed, in one line; the reason of a failure is left to
   * the caller, so it is logged once: {@link FeedUpdater} logs it before it deletes the download, and a handoff names
   * it in the exception it rejects with.
   * @param now Gives the time in milliseconds.
   * @example
   * ```ts
   * import { WindowsProcessApi } from "@noldova/desktop.runtime";
   * import { PublisherCheck } from "@noldova/desktop.electron";
   *
   * export const check: PublisherCheck = new PublisherCheck("CN=Fixture Works, O=Fixture Works, C=US", WindowsProcessApi.create(), console.log, Date.now);
   * ```
   */
  public constructor(publisher: string | null, signatures: Pick<IWindowsProcessApi, "verifySignatureAsync">, log: (text: string) => void, now: () => number);

  /**
   * Checks a file.
   *
   * @param file The downloaded installer.
   * @returns A promise of `null` when the signature is the publisher's, otherwise of why it is not.
   * @example
   * ```ts
   * import type { PublisherCheck } from "@noldova/desktop.electron";
   *
   * export async function isSignedAsync(check: PublisherCheck, file: string): Promise<boolean> {
   *   return await check.checkAsync(file) === null;
   * }
   * ```
   */
  public checkAsync(file: string): Promise<string | null>;
}

/**
 * Checks that a Linux update carries a valid Ed25519 signature by one of the keys the product ships. The signature is
 * the file's entry's `signature` in the update information, over the text `noldova-desktop-update/1`, the version, the
 * target such as `linux-x64`, the file's name and its SHA-512 in base64, each followed by a line feed; the check hashes
 * the downloaded file again. A build that ships no key, a file the information doesn't list, a missing or invalid
 * signature, a hash that differs or a failed check counts as failed, with one line saying why.
 */
export declare class UpdateSignatureCheck {
  /**
   * Creates the check.
   *
   * @param keys The product's `linuxUpdateKeys`; none fails every check.
   * @param platform The platform, `process.platform`.
   * @param architecture The processor, `process.arch`.
   * @param log Records each check, its duration and whether it passed, in one line; the reason of a failure is left to
   * the caller, so it is logged once: {@link FeedUpdater} logs it before it deletes the download, and a handoff names
   * it in the exception it rejects with.
   * @param now Gives the time in milliseconds.
   * @example
   * ```ts
   * import { ProductInfo } from "@noldova/desktop.runtime";
   * import { UpdateSignatureCheck } from "@noldova/desktop.electron";
   *
   * export const check: UpdateSignatureCheck = new UpdateSignatureCheck(ProductInfo.current.linuxUpdateKeys, process.platform, process.arch, console.log, Date.now);
   * ```
   */
  public constructor(keys: readonly string[], platform: string, architecture: string, log: (text: string) => void, now: () => number);

  /**
   * Checks a file.
   *
   * @param file The downloaded package.
   * @param info The update information that offered it, or `null` when none was read.
   * @returns A promise of `null` when a key the product ships signed it, otherwise of why not.
   * @example
   * ```ts
   * import type { UpdateInfo } from "electron-updater";
   * import type { UpdateSignatureCheck } from "@noldova/desktop.electron";
   *
   * export async function isSignedAsync(check: UpdateSignatureCheck, file: string, info: UpdateInfo): Promise<boolean> {
   *   return await check.checkAsync(file, info) === null;
   * }
   * ```
   */
  public checkAsync(file: string, info: UpdateInfo | null): Promise<string | null>;

  /**
   * Checks a ready update again before its handoff, as after a restart: its file's SHA-512 now, its name, its version
   * and the build's target, against the signature its record keeps. A record without a signature, or a signature that
   * no key the product ships made over that file, counts as failed.
   *
   * @param record The ready update's record.
   * @returns A promise of `null` when a key the product ships signed the file, otherwise of why not.
   * @example
   * ```ts
   * import type { UpdateReadyRecord, UpdateSignatureCheck } from "@noldova/desktop.electron";
   *
   * export async function isStillSignedAsync(check: UpdateSignatureCheck, record: UpdateReadyRecord): Promise<boolean> {
   *   return await check.checkReadyAsync(record) === null;
   * }
   * ```
   */
  public checkReadyAsync(record: UpdateReadyRecord): Promise<string | null>;

  /**
   * Reads the signature the update information carries for a file, the `signature` field of its entry in `files`,
   * which electron-updater keeps as the feed's YAML gives it.
   *
   * @param info The update information, or `null` when none was read.
   * @param file The package, whose name is its entry's `url`.
   * @returns The signature, in base64, or `null` when the information lists no such file or carries no signature for it.
   * @example
   * ```ts
   * import type { UpdateInfo } from "electron-updater";
   * import { UpdateSignatureCheck } from "@noldova/desktop.electron";
   *
   * export function hasSignature(info: UpdateInfo): boolean {
   *   return UpdateSignatureCheck.readSignature(info, "/tmp/Noldova Desktop Sample-1.3.0-linux-x64.AppImage") !== null;
   * }
   * ```
   */
  public static readSignature(info: UpdateInfo | null, file: string): string | null;
}

/**
 * The update's state as the window reads it.
 */
export declare class UpdateStatus {
  /**
   * The state of a build that names no feed.
   */
  public static readonly off: UpdateStatus;

  /**
   * The state's kind.
   */
  public readonly kind: UpdateStateKind;
  /**
   * The version found, downloading or ready, otherwise `null`.
   */
  public readonly version: string | null;
  /**
   * The download's whole percentage, or `null`.
   */
  public readonly progress: number | null;
  /**
   * When the last check succeeded, in milliseconds since the epoch, or `null`.
   */
  public readonly checkedAt: number | null;
  /**
   * Why the last check or download failed, or `null`.
   */
  public readonly reason: string | null;
  /**
   * Whether Noldova Desktop Sample must move to Applications to update.
   */
  public readonly mustMove: boolean;

  /**
   * Creates the state.
   *
   * @param kind The state's kind.
   * @param version The version, or `null`.
   * @param progress The download's percentage, or `null`.
   * @param checkedAt When the last check succeeded, or `null`.
   * @param reason Why the last check or download failed, or `null`.
   * @param mustMove Whether Noldova Desktop Sample must move to Applications.
   * @example
   * ```ts
   * import { UpdateStateKind, UpdateStatus } from "@noldova/desktop.electron";
   *
   * export const ready: UpdateStatus = new UpdateStatus(UpdateStateKind.Ready, "1.3.0", null, null, null, false);
   * ```
   */
  public constructor(kind: UpdateStateKind, version: string | null, progress: number | null, checkedAt: number | null, reason: string | null, mustMove: boolean);

  /**
   * Whether a check, a download or a ready update rules out a new check.
   */
  public get isBusy(): boolean;

  /**
   * Gives the state as the window reads it.
   *
   * @returns The state's fields.
   * @example
   * ```ts
   * import { UpdateStatus } from "@noldova/desktop.electron";
   *
   * export const off: unknown = UpdateStatus.off.toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The record of a ready update in its installation's folder, `update-ready.json`.
 */
export declare class UpdateReadyRecord {
  /**
   * The ready version.
   */
  public readonly version: string;
  /**
   * The downloaded file.
   */
  public readonly file: string;
  /**
   * The file's SHA-512 in base64.
   */
  public readonly sha512: string;
  /**
   * Whether the main process has posted `desktop.updateReady` for it.
   */
  public readonly isNotified: boolean;
  /**
   * The signature the update information carried for the file, in base64, which a Linux handoff checks again; `null`
   * when it carried none, as on Windows and macOS, or for a record written before the field.
   */
  public readonly signature: string | null;

  /**
   * Creates the record.
   *
   * @param version The ready version.
   * @param file The downloaded file.
   * @param sha512 The file's SHA-512 in base64.
   * @param isNotified Whether `desktop.updateReady` was posted.
   * @param signature The file's signature from the update information, or `null` when it carried none.
   * @example
   * ```ts
   * import { UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export const record: UpdateReadyRecord = new UpdateReadyRecord("1.3.0", "/tmp/Noldova Desktop Sample-linux-x64.AppImage", "c2hh", false, null);
   * ```
   */
  public constructor(version: string, file: string, sha512: string, isNotified: boolean, signature: string | null);

  /**
   * Reads a record; one without `signature` reads as having none.
   *
   * @param value The record's JSON.
   * @returns The record.
   * @throws {JsonException} When a field is missing or of the wrong type.
   * @example
   * ```ts
   * import { UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export const record: UpdateReadyRecord = UpdateReadyRecord.fromJson({ version: "1.3.0", file: "/tmp/a", sha512: "c2hh", notified: true });
   * ```
   */
  public static fromJson(value: unknown): UpdateReadyRecord;

  /**
   * Gives the same record, marked as posted.
   *
   * @returns The record.
   * @example
   * ```ts
   * import type { UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export function post(record: UpdateReadyRecord): UpdateReadyRecord {
   *   return record.notified();
   * }
   * ```
   */
  public notified(): UpdateReadyRecord;

  /**
   * Gives the record's JSON.
   *
   * @returns The record's fields.
   * @example
   * ```ts
   * import type { UpdateReadyRecord } from "@noldova/desktop.electron";
   *
   * export function write(record: UpdateReadyRecord): unknown {
   *   return record.toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Runs the update up to Ready: the checks `desktop.updateChecks` asks for, the download, the ready record, which a
 * restart checks again, and the one `desktop.updateReady` notification of each ready version.
 */
export declare class UpdateController {
  /**
   * Creates the controller.
   *
   * @param updater Checks and downloads.
   * @param record The ready record's file.
   * @param lock Lets one main process of the installation check and download at a time.
   * @param currentVersion The installed version.
   * @param mustMove Whether Noldova Desktop Sample runs on macOS outside an Applications folder, where a newer version only shows
   * as available.
   * @param refusal Why this copy can never install an update, such as {@link IUpdateHandoff.refusal}, or `null`. A newer
   * version, and a ready update from its record, then show as failed with this reason, so nothing is downloaded,
   * posted or restarted.
   * @param publish Receives each state.
   * @param postReadyAsync Posts `desktop.updateReady` for a version, resolving to whether the runtime took it.
   * @param log Records each failure in one line with its reason, without the exception's name, and the message of its
   * cause when the reason doesn't already hold it.
   * @param now Gives the time in milliseconds.
   * @param schedule Runs a callback after a delay and gives what cancels it.
   * @param restartAsync Restarts to install a ready update: asks about work in progress, stops the installation and
   * hands the update over, resolving when the person cancels; or `null` while Restart to update is refused.
   * @example
   * ```ts
   * import { DeviceFileStore, type IUpdateCheckLock, type IUpdater, UpdateController } from "@noldova/desktop.electron";
   *
   * export function create(updater: IUpdater, lock: IUpdateCheckLock): UpdateController {
   *   return new UpdateController(updater, new DeviceFileStore("/tmp/installation", "update-ready.json"), lock, "1.2.0", false, null, console.log,
   *     () => Promise.resolve(true), console.error, Date.now, (wait, run) => {
   *       const timer = setTimeout(run, wait);
   *       return () => clearTimeout(timer);
   *     }, null);
   * }
   * ```
   */
  public constructor(
    updater: IUpdater,
    record: IDeviceFileStore,
    lock: IUpdateCheckLock,
    currentVersion: string,
    mustMove: boolean,
    refusal: string | null,
    publish: (status: UpdateStatus) => void,
    postReadyAsync: (version: string) => Promise<boolean>,
    log: (text: string) => void,
    now: () => number,
    schedule: (delay: number, run: () => void) => () => void,
    restartAsync: ((record: UpdateReadyRecord) => Promise<void>) | null);

  /**
   * Gives a file's SHA-512.
   *
   * @param file The file.
   * @returns A promise of the SHA-512 in base64; it rejects when the file cannot be read.
   * @example
   * ```ts
   * import { UpdateController } from "@noldova/desktop.electron";
   *
   * export const hash: Promise<string> = UpdateController.hashFileAsync("/tmp/Noldova Desktop Sample-linux-x64.AppImage");
   * ```
   */
  public static hashFileAsync(file: string): Promise<string>;

  /**
   * The current state.
   */
  public get status(): UpdateStatus;

  /**
   * Starts: a ready record whose version is newer than the installed one and whose file is the updater's package and
   * still has its SHA-512 shows as Ready, without the network, or as Available when the application must first move
   * to an Applications folder; any other record is removed. Then the automatic checks begin: 30 seconds after the
   * start and then every 10 minutes, once, or never, as the followed choice says; while they are automatic, a requested
   * check moves the next one 10 minutes on.
   *
   * @returns A promise that settles once the record is read.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/desktop.electron";
   *
   * export function startAsync(controller: UpdateController): Promise<void> {
   *   return controller.startAsync();
   * }
   * ```
   */
  public startAsync(): Promise<void>;

  /**
   * Follows the value of `desktop.updateChecks`: `Automatic`, `AtStart` or `OnRequest`; any other value counts as
   * `Automatic`.
   *
   * @param choice The setting's value.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/desktop.electron";
   *
   * export function onlyWhenAsked(controller: UpdateController): void {
   *   controller.follow("OnRequest");
   * }
   * ```
   */
  public follow(choice: JsonValue): void;

  /**
   * Runs the window's action: `Check` starts a check unless one, a download or a ready update rules it out, and
   * `Restart` starts the restart that installs the ready update unless one runs or the controller has none, which it
   * never has while the application must first move to an Applications folder. A restart clears the reason an earlier
   * one left. A
   * restart that fails leaves the update ready, with its reason, except on a {@link StaleUpdateException}: then the
   * controller removes the ready record and shows the update as failed, so checks run again. Once it holds the lock,
   * a check that finds a usable ready update another main process of the installation recorded shows it as ready, or as
   * available when the application must move, instead of reaching the feed.
   *
   * @param action The action.
   * @returns Whether the action started.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/desktop.electron";
   *
   * export function check(controller: UpdateController): boolean {
   *   return controller.act("Check");
   * }
   * ```
   */
  public act(action: unknown): boolean;

  /**
   * Posts `desktop.updateReady` for the ready version unless this or another main process posted it before, and records that
   * it was; a call during a post runs it again once the post ends.
   *
   * @returns A promise that settles once it is posted or left for the next connection.
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/desktop.electron";
   *
   * export function notifyAsync(controller: UpdateController): Promise<void> {
   *   return controller.notifyAsync();
   * }
   * ```
   */
  public notifyAsync(): Promise<void>;

  /**
   * Stops the automatic checks, refuses new ones and cancels the download in progress; nothing is published afterwards,
   * a check that was taking the lock reaches no feed, and what a running check or download gives is dropped.
   *
   * @example
   * ```ts
   * import type { UpdateController } from "@noldova/desktop.electron";
   *
   * export function stop(controller: UpdateController): void {
   *   controller.stop();
   * }
   * ```
   */
  public stop(): void;
}

/**
 * The category of the exceptions thrown when an update's handoff cannot install it; the message is the reason the updater shows.
 * Its subclasses name each condition: {@link NotAnAppImageException}, {@link AppImageUnreadableException}, {@link AppImageFolderUnwritableException}, {@link AppImageLeftoverNotRemovedException}, {@link AppImageNotReplacedException}, {@link InstallerNotHeldException}, {@link InstallerNotCopiedException}, {@link InstallerUnsignedException}, {@link InstallerNotStartedException}, {@link RestartArgumentsNotWrittenException}, {@link ShipItNotFoundException}, {@link ShipItNotRemovedException}, {@link ShipItUnreadableException}, {@link UpdateNotStagedException}, {@link UpdateNotStagedInTimeException}, {@link StaleUpdateException}.
 */
export declare abstract class UpdateHandoffException extends ElectronException {
  /**
   * Initializes the message and the cause for a subclass.
   *
   * @param message The complete explanation, from the package's own text.
   * @param options The failure that caused this one, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when this copy doesn't run from an AppImage, so its handoff can't install the update.
 */
export declare class NotAnAppImageException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { NotAnAppImageException } from "@noldova/desktop.electron";
   *
   * export const failure: NotAnAppImageException = new NotAnAppImageException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when this copy is a Debian package's install but the system has no pkexec, so its handoff can't install the update.
 */
export declare class DebianInstallerMissingException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { DebianInstallerMissingException } from "@noldova/desktop.electron";
   *
   * export const failure: DebianInstallerMissingException = new DebianInstallerMissingException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the Debian package's update installer refuses the arguments it was given for the
 * downloaded file, so the installed version is left as it was.
 */
export declare class DebianUpdateArgumentsRefusedException extends UpdateHandoffException {
  /**
   * The downloaded package the update installer refused.
   */
  public readonly file: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param file The downloaded package the update installer refused.
   * @example
   * ```ts
   * import { DebianUpdateArgumentsRefusedException } from "@noldova/desktop.electron";
   *
   * export const failure: DebianUpdateArgumentsRefusedException = new DebianUpdateArgumentsRefusedException("/tmp/Sample-linux-x64.deb");
   * ```
   */
  public constructor(file: string);
}

/**
 * The exception thrown when this copy is a Debian package's install but its update installer is missing or someone
 * other than root can change it, so its handoff can't install the update.
 */
export declare class DebianUpdateInstallerMissingException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { DebianUpdateInstallerMissingException } from "@noldova/desktop.electron";
   *
   * export const failure: DebianUpdateInstallerMissingException = new DebianUpdateInstallerMissingException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the downloaded Debian package cannot be installed, so the installed version is left as it was; its message ends with the cause.
 */
export declare class DebianPackageNotInstalledException extends UpdateHandoffException {
  /**
   * The downloaded package that was not installed.
   */
  public readonly file: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param file The downloaded package that was not installed.
   * @param cause The error installing it gave.
   * @example
   * ```ts
   * import { DebianPackageNotInstalledException } from "@noldova/desktop.electron";
   *
   * export const failure: DebianPackageNotInstalledException = new DebianPackageNotInstalledException("/tmp/Sample-linux-x64.deb", new Error("Command failed: pkexec"));
   * ```
   */
  public constructor(file: string, cause: unknown);
}

/**
 * The exception thrown when the AppImage cannot be read, so the update is not installed; its message ends with the cause.
 */
export declare class AppImageUnreadableException extends UpdateHandoffException {
  /**
   * The AppImage that could not be read.
   */
  public readonly image: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param image The AppImage that could not be read.
   * @param cause The error reading the AppImage gave.
   * @example
   * ```ts
   * import { AppImageUnreadableException } from "@noldova/desktop.electron";
   *
   * export const failure: AppImageUnreadableException = new AppImageUnreadableException("/opt/Sample.AppImage", new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(image: string, cause: unknown);
}

/**
 * The exception thrown when the AppImage's folder cannot be written, so the AppImage in it cannot be replaced; its message ends with the cause.
 */
export declare class AppImageFolderUnwritableException extends UpdateHandoffException {
  /**
   * The AppImage's folder.
   */
  public readonly folder: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param folder The AppImage's folder.
   * @param cause The error writing the folder gave.
   * @example
   * ```ts
   * import { AppImageFolderUnwritableException } from "@noldova/desktop.electron";
   *
   * export const failure: AppImageFolderUnwritableException = new AppImageFolderUnwritableException("/opt", new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(folder: string, cause: unknown);
}

/**
 * The exception thrown when an unfinished copy of an earlier update cannot be removed, so the AppImage is not replaced.
 */
export declare class AppImageLeftoverNotRemovedException extends UpdateHandoffException {
  /**
   * The AppImage's folder.
   */
  public readonly folder: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param folder The AppImage's folder.
   * @param options The error removing the copy gave, if any.
   * @example
   * ```ts
   * import { AppImageLeftoverNotRemovedException } from "@noldova/desktop.electron";
   *
   * export const failure: AppImageLeftoverNotRemovedException = new AppImageLeftoverNotRemovedException("/opt");
   * ```
   */
  public constructor(folder: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the AppImage cannot be replaced with the update and is left as it was; its message ends with the cause.
 */
export declare class AppImageNotReplacedException extends UpdateHandoffException {
  /**
   * The AppImage that was not replaced.
   */
  public readonly image: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param image The AppImage that was not replaced.
   * @param cause The error replacing the AppImage gave.
   * @example
   * ```ts
   * import { AppImageNotReplacedException } from "@noldova/desktop.electron";
   *
   * export const failure: AppImageNotReplacedException = new AppImageNotReplacedException("/opt/Sample.AppImage", new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(image: string, cause: unknown);
}

/**
 * The exception thrown when the update's installer cannot be held unchanged for its start.
 */
export declare class InstallerNotHeldException extends UpdateHandoffException {
  /**
   * The Windows error code opening the installer gave.
   */
  public readonly errorCode: number;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param errorCode The Windows error code opening the installer gave.
   * @example
   * ```ts
   * import { InstallerNotHeldException } from "@noldova/desktop.electron";
   *
   * export const failure: InstallerNotHeldException = new InstallerNotHeldException(32);
   * ```
   */
  public constructor(errorCode: number);
}

/**
 * The exception thrown when a protected copy of the update's installer cannot be made.
 */
export declare class InstallerNotCopiedException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The error copying or hashing the installer gave, if any.
   * @example
   * ```ts
   * import { InstallerNotCopiedException } from "@noldova/desktop.electron";
   *
   * export const failure: InstallerNotCopiedException = new InstallerNotCopiedException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when the update's installer is not signed by the publisher, so it is not started.
 */
export declare class InstallerUnsignedException extends UpdateHandoffException {
  /**
   * The installer that was not started.
   */
  public readonly installer: string;

  /**
   * Why the installer's signature was refused.
   */
  public readonly problem: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param installer The installer that was not started.
   * @param problem Why the installer's signature was refused.
   * @example
   * ```ts
   * import { InstallerUnsignedException } from "@noldova/desktop.electron";
   *
   * export const failure: InstallerUnsignedException = new InstallerUnsignedException("/tmp/setup.exe", "the signature is not trusted");
   * ```
   */
  public constructor(installer: string, problem: string);
}

/**
 * The exception thrown when the update's installer cannot be started; its message ends with the cause.
 */
export declare class InstallerNotStartedException extends UpdateHandoffException {
  /**
   * The installer that could not be started.
   */
  public readonly installer: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param installer The installer that could not be started.
   * @param cause The error starting the installer gave.
   * @example
   * ```ts
   * import { InstallerNotStartedException } from "@noldova/desktop.electron";
   *
   * export const failure: InstallerNotStartedException = new InstallerNotStartedException("/tmp/setup.exe", new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(installer: string, cause: unknown);
}

/**
 * The exception thrown when the data and device folders cannot be kept for the new version, so the update is not installed.
 */
export declare class RestartArgumentsNotWrittenException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The error writing the folders gave, if any.
   * @example
   * ```ts
   * import { RestartArgumentsNotWrittenException } from "@noldova/desktop.electron";
   *
   * export const failure: RestartArgumentsNotWrittenException = new RestartArgumentsNotWrittenException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when macOS prepared the update but nothing is waiting to install it.
 */
export declare class ShipItNotFoundException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { ShipItNotFoundException } from "@noldova/desktop.electron";
   *
   * export const failure: ShipItNotFoundException = new ShipItNotFoundException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the staged update cannot be withdrawn; its message ends with the cause.
 */
export declare class ShipItNotRemovedException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param cause The error withdrawing the staged update gave.
   * @example
   * ```ts
   * import { ShipItNotRemovedException } from "@noldova/desktop.electron";
   *
   * export const failure: ShipItNotRemovedException = new ShipItNotRemovedException(new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(cause: unknown);
}

/**
 * The exception thrown when the installer process of the staged update cannot be looked up; its message ends with the cause.
 */
export declare class ShipItUnreadableException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param cause The error looking up the process gave.
   * @example
   * ```ts
   * import { ShipItUnreadableException } from "@noldova/desktop.electron";
   *
   * export const failure: ShipItUnreadableException = new ShipItUnreadableException(new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(cause: unknown);
}

/**
 * The exception thrown when macOS cannot prepare the update for installing.
 */
export declare class UpdateNotStagedException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The error macOS reported, if any.
   * @example
   * ```ts
   * import { UpdateNotStagedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateNotStagedException = new UpdateNotStagedException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when macOS doesn't prepare the update for installing in time.
 */
export declare class UpdateNotStagedInTimeException extends UpdateHandoffException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { UpdateNotStagedInTimeException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateNotStagedInTimeException = new UpdateNotStagedInTimeException();
   * ```
   */
  public constructor();
}

/**
 * The category of the exceptions thrown when a ready update is no longer the one to install; the message is the reason the updater shows.
 * Its subclasses name each condition: {@link UpdateChangedBeforeHandoffException}, {@link UpdateNoLongerOfferedException}.
 */
export declare abstract class StaleUpdateException extends UpdateHandoffException {
  /**
   * Initializes the message and the cause for a subclass.
   *
   * @param message The complete explanation, from the package's own text.
   * @param options The failure that caused this one, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the downloaded update has changed since it was checked, so it is not installed.
 */
export declare class UpdateChangedBeforeHandoffException extends StaleUpdateException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { UpdateChangedBeforeHandoffException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateChangedBeforeHandoffException = new UpdateChangedBeforeHandoffException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the update feed no longer offers the ready update's version.
 */
export declare class UpdateNoLongerOfferedException extends StaleUpdateException {
  /**
   * The version the update feed no longer offers.
   */
  public readonly version: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param version The version the update feed no longer offers.
   * @example
   * ```ts
   * import { UpdateNoLongerOfferedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateNoLongerOfferedException = new UpdateNoLongerOfferedException("1.3.0");
   * ```
   */
  public constructor(version: string);
}

/**
 * The category of the exceptions thrown when an update cannot stop the installation; the message is the reason the updater shows.
 * Its subclasses name each condition: {@link UpdateUnderWayException}, {@link UpdateHolderNotFoundException}, {@link WorkStartedMeanwhileException}, {@link UpdateRuntimeNotFoundException}, {@link UpdateRuntimeNotReachedException}, {@link UpdateRuntimeStillStartingException}, {@link UpdateRefusedException}, {@link UpdateUnsavedException}, {@link DatabasesNotBackedUpException}, {@link ProcessesNotExitedException}, {@link UpdateStopFailedUnexpectedlyException}.
 */
export declare abstract class UpdateStopException extends ElectronException {
  /**
   * Initializes the message and the cause for a subclass.
   *
   * @param message The complete explanation, from the package's own text.
   * @param options The failure that caused this one, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when another update is under way.
 */
export declare class UpdateUnderWayException extends UpdateStopException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { UpdateUnderWayException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateUnderWayException = new UpdateUnderWayException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the main process cannot find its own process in the process table.
 */
export declare class UpdateHolderNotFoundException extends UpdateStopException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { UpdateHolderNotFoundException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateHolderNotFoundException = new UpdateHolderNotFoundException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when work starts while the update is being prepared; its message lists the work.
 */
export declare class WorkStartedMeanwhileException extends UpdateStopException {
  /**
   * The work that started meanwhile, each with its data folder.
   */
  public readonly work: readonly string[];

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param work The work that started meanwhile, each with its data folder.
   * @example
   * ```ts
   * import { WorkStartedMeanwhileException } from "@noldova/desktop.electron";
   *
   * export const failure: WorkStartedMeanwhileException = new WorkStartedMeanwhileException(["Saving notes (/home/person/data)"]);
   * ```
   */
  public constructor(work: readonly string[]);
}

/**
 * The exception thrown when the runtime of a data folder cannot be identified, so it can't be verified to stop for the update.
 */
export declare class UpdateRuntimeNotFoundException extends UpdateStopException {
  /**
   * The data folder.
   */
  public readonly dataDirectory: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param dataDirectory The data folder.
   * @example
   * ```ts
   * import { UpdateRuntimeNotFoundException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateRuntimeNotFoundException = new UpdateRuntimeNotFoundException("/home/person/data");
   * ```
   */
  public constructor(dataDirectory: string);
}

/**
 * The exception thrown when the runtime of a data folder cannot be reached to stop it for the update.
 */
export declare class UpdateRuntimeNotReachedException extends UpdateStopException {
  /**
   * The data folder.
   */
  public readonly dataDirectory: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param dataDirectory The data folder.
   * @param options The failure reaching the runtime, if any.
   * @example
   * ```ts
   * import { UpdateRuntimeNotReachedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateRuntimeNotReachedException = new UpdateRuntimeNotReachedException("/home/person/data");
   * ```
   */
  public constructor(dataDirectory: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the runtime of a data folder is still starting, so it can't be stopped for the update.
 */
export declare class UpdateRuntimeStillStartingException extends UpdateStopException {
  /**
   * The data folder.
   */
  public readonly dataDirectory: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param dataDirectory The data folder.
   * @example
   * ```ts
   * import { UpdateRuntimeStillStartingException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateRuntimeStillStartingException = new UpdateRuntimeStillStartingException("/home/person/data");
   * ```
   */
  public constructor(dataDirectory: string);
}

/**
 * The exception thrown when the runtime of a data folder refuses to prepare for the update; its message ends with the runtime's answer.
 */
export declare class UpdateRefusedException extends UpdateStopException {
  /**
   * The data folder.
   */
  public readonly dataDirectory: string;

  /**
   * The runtime's answer.
   */
  public readonly failure: Failure;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param dataDirectory The data folder.
   * @param failure The runtime's answer.
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/desktop.protocol";
   * import { UpdateRefusedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateRefusedException = new UpdateRefusedException("/home/person/data", new Failure(FailureCode.Conflict, "Work is running."));
   * ```
   */
  public constructor(dataDirectory: string, failure: Failure);
}

/**
 * The exception thrown when not everything of a data folder was saved; its message lists what wasn't.
 */
export declare class UpdateUnsavedException extends UpdateStopException {
  /**
   * The data folder.
   */
  public readonly dataDirectory: string;

  /**
   * What was not saved.
   */
  public readonly problems: readonly string[];

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param dataDirectory The data folder.
   * @param problems What was not saved.
   * @example
   * ```ts
   * import { UpdateUnsavedException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateUnsavedException = new UpdateUnsavedException("/home/person/data", ["notes.md"]);
   * ```
   */
  public constructor(dataDirectory: string, problems: readonly string[]);
}

/**
 * The exception thrown when a ready Linux update, at its handoff after the download or a restart, carries no valid
 * signature by a key the build ships, so it is not installed.
 */
export declare class UpdateUnsignedAtHandoffException extends UpdateHandoffException {
  /**
   * The update that was not installed.
   */
  public readonly file: string;

  /**
   * Why the update's signature was refused.
   */
  public readonly problem: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param file The update that was not installed.
   * @param problem Why the update's signature was refused.
   * @example
   * ```ts
   * import { UpdateUnsignedAtHandoffException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateUnsignedAtHandoffException = new UpdateUnsignedAtHandoffException("/tmp/app.deb", "its signature is not by a key this build ships");
   * ```
   */
  public constructor(file: string, problem: string);
}

/**
 * The exception thrown when the databases of a data folder cannot be backed up, so the update doesn't start; its message ends with the cause's message.
 */
export declare class DatabasesNotBackedUpException extends UpdateStopException {
  /**
   * The data folder.
   */
  public readonly dataDirectory: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param dataDirectory The data folder.
   * @param cause The error the backup gave.
   * @example
   * ```ts
   * import { DatabasesNotBackedUpException } from "@noldova/desktop.electron";
   *
   * export const failure: DatabasesNotBackedUpException = new DatabasesNotBackedUpException("/home/person/data", new Error("EACCES: permission denied"));
   * ```
   */
  public constructor(dataDirectory: string, cause: unknown);
}

/**
 * The exception thrown when processes do not exit in time; its message lists them.
 */
export declare class ProcessesNotExitedException extends UpdateStopException {
  /**
   * The processes still running.
   */
  public readonly processes: readonly UpdateProcess[];

  /**
   * How long the processes were given to exit, in milliseconds.
   */
  public readonly milliseconds: number;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param processes The processes still running.
   * @param milliseconds How long the processes were given to exit, in milliseconds.
   * @example
   * ```ts
   * import { UpdateProcess } from "@noldova/desktop.protocol";
   * import { ProcessesNotExitedException } from "@noldova/desktop.electron";
   *
   * export const failure: ProcessesNotExitedException = new ProcessesNotExitedException([new UpdateProcess(4120, 1500, 1501, "runtime")], 15_000);
   * ```
   */
  public constructor(processes: readonly UpdateProcess[], milliseconds: number);
}

/**
 * The exception thrown when stopping the installation for an update fails on an unexpected error.
 */
export declare class UpdateStopFailedUnexpectedlyException extends UpdateStopException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The unexpected error, if any.
   * @example
   * ```ts
   * import { UpdateStopFailedUnexpectedlyException } from "@noldova/desktop.electron";
   *
   * export const failure: UpdateStopFailedUnexpectedlyException = new UpdateStopFailedUnexpectedlyException();
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The category of the exceptions thrown when a window's state cannot be read or kept through the runtime.
 * Its subclasses name each condition: {@link WindowStateRefusedException}, {@link WindowStateUnavailableException}.
 */
export declare abstract class WindowStateException extends ElectronException {
  /**
   * Initializes the message and the cause for a subclass.
   *
   * @param message The complete explanation, from the package's own text.
   * @param options The failure that caused this one, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the runtime refuses to read or keep a window's state; its message names the method and ends with the runtime's answer.
 */
export declare class WindowStateRefusedException extends WindowStateException {
  /**
   * The method the runtime refused.
   */
  public readonly method: QualifiedName;

  /**
   * The runtime's answer.
   */
  public readonly failure: Failure;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param method The method the runtime refused.
   * @param failure The runtime's answer.
   * @example
   * ```ts
   * import { Failure, FailureCode, QualifiedName } from "@noldova/desktop.protocol";
   * import { WindowStateRefusedException } from "@noldova/desktop.electron";
   *
   * export const failure: WindowStateRefusedException = new WindowStateRefusedException(new QualifiedName("desktop", "writeWindowBounds"), new Failure(FailureCode.Internal, "The database is busy."));
   * ```
   */
  public constructor(method: QualifiedName, failure: Failure);
}

/**
 * The category of the exceptions thrown when a window's state cannot be read or kept because the runtime cannot be reached. A refusal from the runtime is a {@link WindowStateRefusedException} instead.
 * Its subclasses name each condition: {@link WindowStateNotConnectedException}, {@link WindowStateRuntimeUnreachableException}.
 */
export declare abstract class WindowStateUnavailableException extends WindowStateException {
  /**
   * Initializes the message and the cause for a subclass.
   *
   * @param message The complete explanation, from the package's own text.
   * @param options The failure that caused this one, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a window's state cannot be read or kept because the main process has no connection to the runtime.
 */
export declare class WindowStateNotConnectedException extends WindowStateUnavailableException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { WindowStateNotConnectedException } from "@noldova/desktop.electron";
   *
   * export const failure: WindowStateNotConnectedException = new WindowStateNotConnectedException();
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when a window's state cannot be read or kept because the connection to the runtime failed; its message is the connection's.
 */
export declare class WindowStateRuntimeUnreachableException extends WindowStateUnavailableException {
  /**
   * Creates the exception, with the message of the connection's failure.
   *
   * @param cause The connection's failure, kept as the cause.
   * @example
   * ```ts
   * import type { ConnectionException } from "@noldova/desktop.runtime";
   * import { WindowStateRuntimeUnreachableException } from "@noldova/desktop.electron";
   *
   * export function unreachable(cause: ConnectionException): WindowStateRuntimeUnreachableException {
   *   return new WindowStateRuntimeUnreachableException(cause);
   * }
   * ```
   */
  public constructor(cause: ConnectionException);
}

/**
 * The exception thrown when the runtime starter reports that it could not start the runtime; its message ends with the starter's reason.
 */
export declare class RuntimeStarterFailedException extends LaunchException {
  /**
   * Why the runtime starter could not start the runtime.
   */
  public readonly failure: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param failure Why the runtime starter could not start the runtime.
   * @example
   * ```ts
   * import { RuntimeStarterFailedException } from "@noldova/desktop.electron";
   *
   * export const failure: RuntimeStarterFailedException = new RuntimeStarterFailedException("the runtime file is missing");
   * ```
   */
  public constructor(failure: string);
}

/**
 * The exception thrown when the runtime starter ends before it starts the runtime.
 */
export declare class RuntimeStarterEndedException extends LaunchException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { RuntimeStarterEndedException } from "@noldova/desktop.electron";
   *
   * export const failure: RuntimeStarterEndedException = new RuntimeStarterEndedException();
   * ```
   */
  public constructor();
}

/**
 * Keeps one window's state, its bounds or its layout, in the shell's database through the runtime.
 */
export declare class RuntimeWindowStateStore implements IWindowStateStore {
  /**
   * Creates the store.
   *
   * @param connection Returns the current connection to the runtime, or `null` while there is none.
   * @param key The device and window the state belongs to.
   * @param readMethod The method that reads the state, such as `ShellMethods.readWindowBounds`.
   * @param writeMethod The method that keeps the state, such as `ShellMethods.writeWindowBounds`.
   * @example
   * ```ts
   * import { ShellMethods, WindowStateKey } from "@noldova/desktop.protocol";
   * import { type RuntimeStartup, RuntimeWindowStateStore } from "@noldova/desktop.electron";
   *
   * export function boundsOf(startup: RuntimeStartup, device: string): RuntimeWindowStateStore {
   *   return new RuntimeWindowStateStore(() => startup.connection, new WindowStateKey(device, "main"), ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds);
   * }
   * ```
   */
  public constructor(connection: () => IRuntimeConnection | null, key: WindowStateKey, readMethod: QualifiedName, writeMethod: QualifiedName);

  /**
   * Reads the kept state.
   *
   * @returns A promise of the state, or `null` when none is kept.
   * @throws WindowStateUnavailableException as a rejection when the runtime cannot be reached.
   * @throws WindowStateException as a rejection when the runtime refuses.
   * @throws JsonException as a rejection when the runtime's answer is not a window state.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import type { RuntimeWindowStateStore } from "@noldova/desktop.electron";
   *
   * export function readAsync(store: RuntimeWindowStateStore): Promise<JsonObject | null> {
   *   return store.readAsync();
   * }
   * ```
   */
  public readAsync(): Promise<JsonObject | null>;

  /**
   * Keeps a new state.
   *
   * @param value The state.
   * @returns A promise that settles once the runtime kept it.
   * @throws WindowStateUnavailableException as a rejection when the runtime cannot be reached.
   * @throws WindowStateException as a rejection when the runtime refuses.
   * @example
   * ```ts
   * import type { RuntimeWindowStateStore } from "@noldova/desktop.electron";
   *
   * export function keepAsync(store: RuntimeWindowStateStore): Promise<void> {
   *   return store.writeAsync({ x: 100, y: 80, width: 1280, height: 800, maximized: false });
   * }
   * ```
   */
  public writeAsync(value: JsonObject): Promise<void>;
}

/**
 * The main process's log, `logs/main.log` in the data directory, mirrored to standard error. One main process runs per data
 * directory, so the main process alone owns the file. It stays within its size limit by becoming `logs/main.previous.log`
 * when it fills.
 */
export declare class MainProcessLog implements IMainProcessLog {
  /**
   * Creates the log; nothing is written to the file until it opens.
   *
   * @param directory The data directory whose `logs/main.log` the main process owns.
   * @param error Standard error, which receives every line, also before the file opens and when it cannot be written.
   * @param redactor Removes what a diagnostic must not show from every line.
   * @param now The clock that stamps each line; the current time by default.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { MainProcessLog } from "@noldova/desktop.electron";
   * import { DiagnosticRedactor, type DataDirectory } from "@noldova/desktop.runtime";
   *
   * export function createLog(directory: DataDirectory): MainProcessLog {
   *   return new MainProcessLog(directory, process.stderr, new DiagnosticRedactor(homedir()));
   * }
   * ```
   */
  public constructor(directory: DataDirectory, error: Writable, redactor: DiagnosticRedactor, now?: () => Date);

  /**
   * Starts the file once the data directory is usable: keeps the previous start's log as `logs/main.previous.log`
   * and starts `logs/main.log`, without blocking the main process. Only the first call does anything. Lines written
   * while the file starts go into it once it has started, after the kept ones. When the file cannot be started, the log
   * records why and goes on writing to standard error only.
   *
   * @returns Settles once the file has started or could not be started; it never rejects.
   * @example
   * ```ts
   * import type { MainProcessLog } from "@noldova/desktop.electron";
   *
   * export function startAsync(log: MainProcessLog): Promise<void> {
   *   return log.openAsync();
   * }
   * ```
   */
  public openAsync(): Promise<void>;

  /**
   * Records a line, stamped with the time and redacted, on standard error at once and, once open, in the file without
   * waiting for the disk. When the file cannot take a line, later lines go to standard error only, and the log records why there.
   *
   * @param text What happened.
   * @example
   * ```ts
   * import type { MainProcessLog } from "@noldova/desktop.electron";
   *
   * export function record(log: MainProcessLog): void {
   *   log.write("The window was shown before it was painted.");
   * }
   * ```
   */
  public write(text: string): void;

  /**
   * Records a line as {@link MainProcessLog.write} does, and when the file hasn't started yet, keeps it for the file, which
   * then takes it first, such as the folders a restarted version took before its data directory was known. A file
   * that never starts never takes it.
   *
   * @param text What happened.
   * @example
   * ```ts
   * import type { MainProcessLog } from "@noldova/desktop.electron";
   *
   * export function record(log: MainProcessLog): void {
   *   log.writeKept("The mainProcess runs on the folders of the version it updated: --data-dir=/data");
   * }
   * ```
   */
  public writeKept(text: string): void;

  /**
   * Records a line on standard error and at the end of `logs/main.log` without starting the file, for a main process
   * that quits because another one owns the data directory, so the file of the main process that owns it keeps the
   * line. When the file cannot take it, standard error also records why.
   *
   * @param text What happened.
   * @example
   * ```ts
   * import type { MainProcessLog } from "@noldova/desktop.electron";
   *
   * export function record(log: MainProcessLog): void {
   *   log.writeShared("Another main process owns this data directory, so this one quits.");
   * }
   * ```
   */
  public writeShared(text: string): void;

  /**
   * Writes the lines still waiting for the file at once, in order, as when the main process is about to quit or exit.
   *
   * @example
   * ```ts
   * import type { MainProcessLog } from "@noldova/desktop.electron";
   *
   * export function finish(log: MainProcessLog): void {
   *   log.flush();
   * }
   * ```
   */
  public flush(): void;

  /**
   * Closes the file once the lines still waiting are written and no write still holds it open, as when the main process
   * exits. A line written afterwards still reaches standard error but no longer the file.
   *
   * @returns A promise that resolves once the file is closed; it never rejects.
   * @example
   * ```ts
   * import type { MainProcessLog } from "@noldova/desktop.electron";
   *
   * export async function finishAsync(log: MainProcessLog): Promise<void> {
   *   await log.closeAsync();
   * }
   * ```
   */
  public closeAsync(): Promise<void>;
}

/**
 * Limits the errors one window's page reports within a fixed period. The period starts with the first error after
 * the previous one has passed; reloading the page does not start a new one.
 */
export declare class WindowErrorLimit {
  /**
   * Creates the limit, with no period started.
   *
   * @param burst The most errors written in one period.
   * @param period The period's length, in milliseconds.
   * @param now Returns the current time in milliseconds; `Date.now` by default.
   * @example
   * ```ts
   * import { WindowErrorLimit } from "@noldova/desktop.electron";
   *
   * export const limit: WindowErrorLimit = new WindowErrorLimit(10, 60000);
   * ```
   */
  public constructor(burst: number, period: number, now?: () => number);

  /**
   * Counts one more error and says what becomes of it.
   *
   * @returns The admission: {@link WindowErrorAdmission.Write} for the period's first `burst` errors, {@link WindowErrorAdmission.Notice} for the
   * next one, and {@link WindowErrorAdmission.Drop} for the rest of the period.
   * @example
   * ```ts
   * import { WindowErrorAdmission, type WindowErrorLimit } from "@noldova/desktop.electron";
   *
   * export function isWritten(limit: WindowErrorLimit): boolean {
   *   return limit.admit() === WindowErrorAdmission.Write;
   * }
   * ```
   */
  public admit(): WindowErrorAdmission;
}

/**
 * Restores a window's saved bounds onto the displays that show it, then keeps them after each pause in moving,
 * resizing and maximizing, and on request before the window closes.
 */
export declare class WindowBoundsKeeper {
  /**
   * Creates the keeper and listens for the window's changes, which it saves once it has a store. A move or resize the
   * person makes before then is held where the window reports only the person's own as "will-move" and "will-resize", which
   * is Windows; on macOS the system's own moves report as "will-move" too, and Linux reports neither, so nothing is held there.
   * After a read of the saved bounds fails, the same holds on Windows, and elsewhere a change is held once the window's normal
   * bounds differ from those it had when {@link WindowBoundsKeeper.show} showed it, so the system's placement before then and a
   * maximize are not.
   *
   * @param window The window.
   * @param displays The displays, for placing restored bounds.
   * @param saveDelay How long a pause in changes lasts before the bounds are saved, in milliseconds.
   * @param log Records a save that failed.
   * @param holdsPersonsMoves Whether the window's "will-move" and "will-resize" come only from the person.
   * @param keepsStoredPosition Whether saves keep the position the store held when {@link WindowBoundsKeeper.restoreAsync}
   * read it, or none when it held no bounds, rather than the window's: under Wayland the compositor places each window it
   * shows, so the window's position is the compositor's, not the person's. The size and maximized state are saved either
   * way, but such a keeper saves nothing until the store has been read, so a failed read never replaces the stored position.
   * False when left out.
   * @example
   * ```ts
   * import { type IMainProcessLog, type IMainProcessWindow, type IDisplayHost, WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function keep(window: IMainProcessWindow, displays: IDisplayHost, log: IMainProcessLog): WindowBoundsKeeper {
   *   return new WindowBoundsKeeper(window, displays, 500, log, true);
   * }
   * ```
   */
  public constructor(window: IMainProcessWindow, displays: IDisplayHost, saveDelay: number, log: IMainProcessLog, holdsPersonsMoves: boolean, keepsStoredPosition?: boolean);

  /**
   * Places the window at bounds already read, such as the copy saved on this device, while it is still hidden, and keeps
   * the bounds in the store from now on. A window saved maximized is maximized as {@link WindowBoundsKeeper.show} shows it.
   *
   * @param store Where the bounds are kept.
   * @param state The bounds to place the window at.
   * @example
   * ```ts
   * import type { IWindowStateStore, WindowBoundsKeeper, WindowState } from "@noldova/desktop.electron";
   *
   * export function begin(keeper: WindowBoundsKeeper, store: IWindowStateStore, state: WindowState): void {
   *   keeper.begin(store, state);
   * }
   * ```
   */
  public begin(store: IWindowStateStore, state: WindowState): void;

  /**
   * Keeps the bounds in a new store from now on, ending a hold, and saves the window's current bounds there without
   * moving the window.
   *
   * @param store Where the bounds are kept.
   * @returns A promise that settles once the bounds are saved.
   * @throws The store's failure as a rejection when it could not keep the bounds.
   * @example
   * ```ts
   * import type { IWindowStateStore, WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function followAsync(keeper: WindowBoundsKeeper, store: IWindowStateStore): Promise<void> {
   *   return keeper.followAsync(store);
   * }
   * ```
   */
  public followAsync(store: IWindowStateStore): Promise<void>;

  /**
   * Keeps the bounds in the store from now on, ending a hold, and applies the store's bounds: the saved position when a display
   * shows it, otherwise the saved size centered, then maximized when it was. A window not shown yet is maximized
   * only as {@link WindowBoundsKeeper.show} shows it, since maximizing shows a hidden window without focusing it,
   * and saves count it as maximized meanwhile. When the person already moved or resized the window, before any store or
   * after a read that failed, those bounds stay and are saved instead of the saved ones being applied.
   *
   * @param store Where the bounds are kept.
   * @returns A promise that settles once the saved bounds are applied, or at once when none are saved.
   * @throws JsonException as a rejection when the saved bounds are not a window state; the window keeps its bounds.
   * @throws The store's failure as a rejection when it could not keep the bounds the person set; they stay unsaved.
   * @example
   * ```ts
   * import type { IWindowStateStore, WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function restoreAsync(keeper: WindowBoundsKeeper, store: IWindowStateStore): Promise<void> {
   *   return keeper.restoreAsync(store);
   * }
   * ```
   */
  public restoreAsync(store: IWindowStateStore): Promise<void>;

  /**
   * Shows the window, maximizing it first when its restored bounds were maximized while it was hidden, so it opens
   * maximized and focused.
   *
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function reveal(keeper: WindowBoundsKeeper): void {
   *   keeper.show();
   * }
   * ```
   */
  public show(): void;

  /**
   * Saves the window's current bounds at once, cancelling a pending save; does nothing after the window is gone, or
   * before a store is set unless the person moved or resized the window. While held, it only marks the bounds unsaved.
   * A keeper that keeps the stored position saves that position with the window's current size and maximized state, and
   * does nothing before {@link WindowBoundsKeeper.restoreAsync} has read the store.
   * Bounds that could not be kept stay unsaved for {@link WindowBoundsKeeper.saveUnsavedAsync}.
   * A save after a move or resize that finds the runtime unreachable keeps the bounds unsaved without reporting it.
   *
   * @returns A promise that settles once the bounds are kept.
   * @throws The store's failure as a rejection.
   * @throws {WindowStateUnavailableException} Asynchronously when the person moved or resized the window before a store was set.
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function saveAsync(keeper: WindowBoundsKeeper): Promise<void> {
   *   return keeper.saveAsync();
   * }
   * ```
   */
  public saveAsync(): Promise<void>;

  /**
   * Saves the bounds at once when a save is pending or bounds are unsaved, then holds every later save, which only marks
   * the bounds unsaved, until {@link WindowBoundsKeeper.saveUnsavedAsync} or {@link WindowBoundsKeeper.restoreAsync}.
   * The main process holds its windows' bounds as it saves for an update, because the runtime refuses its writes afterwards.
   * It holds them even when the save fails.
   *
   * @returns A promise that settles once the bounds are kept and held.
   * @throws The store's failure as a rejection.
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function holdForUpdateAsync(keeper: WindowBoundsKeeper): Promise<void> {
   *   return keeper.holdAsync();
   * }
   * ```
   */
  public holdAsync(): Promise<void>;

  /**
   * Ends a hold and saves the window's newest bounds when an earlier save could not keep them, for example while the
   * runtime was unreachable or the bounds were held; does nothing otherwise.
   *
   * @returns A promise that settles once the bounds are kept, or at once when nothing is unsaved.
   * @throws The store's failure as a rejection.
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function catchUpAsync(keeper: WindowBoundsKeeper): Promise<void> {
   *   return keeper.saveUnsavedAsync();
   * }
   * ```
   */
  public saveUnsavedAsync(): Promise<void>;

  /**
   * Cancels a pending save.
   *
   * @example
   * ```ts
   * import type { WindowBoundsKeeper } from "@noldova/desktop.electron";
   *
   * export function forget(keeper: WindowBoundsKeeper): void {
   *   keeper.cancelSave();
   * }
   * ```
   */
  public cancelSave(): void;
}

/**
 * How a build presents itself to the Windows taskbar: the app ID its windows group under, the icon, and the command
 * the taskbar and its jump list use to start this same build again. A development build has its own app ID, so it
 * never mixes with an installed Noldova Desktop Sample.
 */
export declare class TaskbarIdentity {
  /**
   * The app user model ID.
   */
  public readonly appId: string;

  /**
   * The file whose icon the taskbar shows: a packaged build's program, or a development build's icon file.
   */
  public readonly iconPath: string;

  /**
   * The command line that starts this build again, each part quoted.
   */
  public readonly relaunchCommand: string;

  /**
   * Creates the identity.
   *
   * @param appId The app user model ID.
   * @param iconPath The file whose icon the taskbar shows.
   * @param relaunchCommand The command line that starts this build again.
   * @throws {ArgumentException} When a part is blank.
   * @example
   * ```ts
   * import { TaskbarIdentity } from "@noldova/desktop.electron";
   *
   * export const identity: TaskbarIdentity = new TaskbarIdentity("com.noldova.desktop", "/opt/noldova-desktop/noldova-desktop", "\"/opt/noldova-desktop/noldova-desktop\"");
   * ```
   */
  public constructor(appId: string, iconPath: string, relaunchCommand: string);

  /**
   * Describes the running build. A packaged build starts again by its program; a development build by Electron with
   * its checkout's `_build/development-package` folder, whose `package.json` names the main script and the product's
   * version. Both keep the given `--data-dir=`, `--user-data-dir=` and `--device-dir=` arguments, resolved to
   * absolute paths, so the relaunch reaches the running instance's single-instance lock from any working directory.
   * A packaged build takes the application ID. A development build takes the development application ID followed by
   * the first eight hexadecimal digits of the SHA-256 of its checkout's path, the folder three levels above the main
   * script's, so each checkout has its own taskbar entry and relaunches itself. A packaged build's taskbar shows its
   * program's icon, because the Windows shell cannot read a file inside the app's archive; a development build's shows
   * the icon file. The checkout's path is read without blocking, following its links when it exists.
   *
   * @param isPackaged Whether the build is packaged.
   * @param executablePath The running program.
   * @param iconFile The icon file a development build's taskbar shows.
   * @param mainScript The main process's main script, which locates a development build's checkout.
   * @param argv The process's command-line arguments.
   * @param workingDirectory The directory relative paths in the arguments resolve against.
   * @returns The identity.
   * @example
   * ```ts
   * import { TaskbarIdentity } from "@noldova/desktop.electron";
   *
   * export const identity: TaskbarIdentity = await TaskbarIdentity.createAsync(false, "/checkout/electron", "/checkout/assets/icons/icon-dark.ico", "/checkout/main.js", ["--data-dir=data"], "/checkout");
   * ```
   */
  public static createAsync(isPackaged: boolean, executablePath: string, iconFile: string, mainScript: string, argv: readonly string[], workingDirectory: string): Promise<TaskbarIdentity>;

  /**
   * The details for `BrowserWindow.setAppDetails`.
   *
   * @returns The app ID, icon, relaunch command and the product's name as the relaunch entry's name.
   * @example
   * ```ts
   * import type { AppDetailsOptions } from "electron";
   * import type { TaskbarIdentity } from "@noldova/desktop.electron";
   *
   * export function detailsOf(identity: TaskbarIdentity): AppDetailsOptions {
   *   return identity.toAppDetails();
   * }
   * ```
   */
  public toAppDetails(): AppDetailsOptions;
}

/**
 * What a utility process is asked to start: a program, its arguments, the file for its standard error and its environment.
 */
export declare class DetachedStartRequest {
  /**
   * The program to start.
   */
  public readonly executable: string;

  /**
   * The program's arguments.
   */
  public readonly launchArguments: readonly string[];

  /**
   * The file the program's standard error is appended to.
   */
  public readonly errorFile: string;

  /**
   * The program's environment. The utility process itself runs with the main process's environment, since a variable such as `ELECTRON_RUN_AS_NODE` must reach the program but not the utility process.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * Creates the request.
   *
   * @param executable The program; not whitespace only.
   * @param launchArguments The program's arguments, copied.
   * @param errorFile The file for standard error; not whitespace only.
   * @param environment The program's environment; variables without a value are left out.
   * @throws ArgumentException synchronously when the program or the file is empty or whitespace only.
   * @example
   * ```ts
   * import { DetachedStartRequest } from "@noldova/desktop.electron";
   *
   * export const request: DetachedStartRequest = new DetachedStartRequest(process.execPath, ["--version"], "start.log", process.env);
   * ```
   */
  public constructor(executable: string, launchArguments: readonly string[], errorFile: string, environment: NodeJS.ProcessEnv);

  /**
   * Reads a request from a message.
   *
   * @param value The message: `executable`, `arguments`, `errorFile` and `environment`.
   * @returns The request.
   * @throws JsonException synchronously when a field is missing or invalid, or an environment variable's value is not text.
   * @example
   * ```ts
   * import { DetachedStartRequest } from "@noldova/desktop.electron";
   *
   * export const request: DetachedStartRequest = DetachedStartRequest.fromJson({ executable: "node", arguments: [], errorFile: "start.log", environment: { PATH: "/usr/bin" } });
   * ```
   */
  public static fromJson(value: unknown): DetachedStartRequest;

  /**
   * Writes the request as a message.
   *
   * @returns The message.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { DetachedStartRequest } from "@noldova/desktop.electron";
   *
   * export const message: JsonObject = new DetachedStartRequest("node", [], "start.log", {}).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A utility process's answer to a start request: the started process's id, or why it could not start.
 */
export declare class DetachedStartReply {
  /**
   * The started process's id, or `null` when the start failed.
   */
  public readonly processId: number | null;

  /**
   * Why the start failed, or `null` when it succeeded.
   */
  public readonly failure: string | null;

  private constructor();

  /**
   * Creates the reply of a successful start.
   *
   * @param processId The started process's id.
   * @returns The reply.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/desktop.electron";
   *
   * export const reply: DetachedStartReply = DetachedStartReply.started(4120);
   * ```
   */
  public static started(processId: number): DetachedStartReply;

  /**
   * Creates the reply of a failed start.
   *
   * @param failure Why the start failed.
   * @returns The reply.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/desktop.electron";
   *
   * export const reply: DetachedStartReply = DetachedStartReply.failed("The program is missing.");
   * ```
   */
  public static failed(failure: string): DetachedStartReply;

  /**
   * Reads a reply from a message.
   *
   * @param value The message: `processId` and `failure`, exactly one of them not `null`.
   * @returns The reply.
   * @throws JsonException synchronously when a field is invalid or the message carries both outcomes or neither.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/desktop.electron";
   *
   * export const reply: DetachedStartReply = DetachedStartReply.fromJson({ processId: 4120, failure: null });
   * ```
   */
  public static fromJson(value: unknown): DetachedStartReply;

  /**
   * Returns the started process's id.
   *
   * @returns The process id.
   * @throws RuntimeStarterFailedException, a `LaunchException`, synchronously when the start failed; its message carries the failure.
   * @example
   * ```ts
   * import { DetachedStartReply } from "@noldova/desktop.electron";
   *
   * export const processId: number = DetachedStartReply.started(4120).requireProcessId();
   * ```
   */
  public requireProcessId(): number;

  /**
   * Writes the reply as a message.
   *
   * @returns The message.
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { DetachedStartReply } from "@noldova/desktop.electron";
   *
   * export const message: JsonObject = DetachedStartReply.started(4120).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Starts the runtime through a short-lived Electron utility process, so that the runtime inherits none of the main process's handles. Electron's main process keeps its standard handles inheritable, and Node.js starts every child with handle inheritance on; a utility process, which Chromium starts with only its listed handles, then starts the runtime and ends.
 */
export declare class UtilityProcessStarter implements IProcessStarter {
  /**
   * Creates the starter.
   *
   * @param host Electron's `utilityProcess`.
   * @param environment The main process's own environment, which the utility process gets with `ELECTRON_NO_ATTACH_CONSOLE`
   * set, so that it never attaches to a console the main process is attached to and the program it starts gets none of that
   * console's handles.
   * @param workingDirectory The folder the utility process, and so the program it starts, starts in, or `null` for
   * Electron's default. Defaults to `null`.
   * @param entryPath The script the utility process runs. Defaults to {@link UtilityProcessStarter.entryPath}.
   * @example
   * ```ts
   * import { type IUtilityProcessHost, UtilityProcessStarter } from "@noldova/desktop.electron";
   *
   * export function createStarter(host: IUtilityProcessHost): UtilityProcessStarter {
   *   return new UtilityProcessStarter(host, process.env);
   * }
   * ```
   */
  public constructor(host: IUtilityProcessHost, environment: NodeJS.ProcessEnv, workingDirectory?: string | null, entryPath?: string);

  /**
   * The path of the package's utility script, which answers one start request and ends.
   *
   * @example
   * ```ts
   * import { UtilityProcessStarter } from "@noldova/desktop.electron";
   *
   * export const script: string = UtilityProcessStarter.entryPath;
   * ```
   */
  public static get entryPath(): string;

  /**
   * Asks a new utility process to start a program detached and returns the program's process id. The main process acknowledges the answer, and the utility process ends only then, so its exit never arrives before its answer.
   *
   * @param executable The program to run.
   * @param launchArguments The program's arguments.
   * @param environment The program's environment, which the request carries.
   * @param errorFile The file the program's standard error is appended to.
   * @param workingFolder The folder the utility process, and so the program, starts in; by default the starter's.
   * @returns A promise of the started program's process id.
   * @throws RuntimeStarterFailedException, a `LaunchException`, as a rejection when the utility process cannot start the program, and
   * RuntimeStarterEndedException, also a `LaunchException`, when it ends without answering.
   * @throws JsonException as a rejection when the answer is not a start reply.
   * @example
   * ```ts
   * import { type IUtilityProcessHost, UtilityProcessStarter } from "@noldova/desktop.electron";
   *
   * export function startAsync(host: IUtilityProcessHost, errorFile: string): Promise<number> {
   *   return new UtilityProcessStarter(host, process.env).startAsync(process.execPath, ["--version"], process.env, errorFile);
   * }
   * ```
   */
  public startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string, workingFolder?: string): Promise<number>;
}

/**
 * The utility process's side of a detached start: it reads the request, starts the program and answers.
 */
export declare class DetachedStart {
  /**
   * Answers one start request and waits for the parent process to acknowledge the answer, so that the utility process ends only after its answer arrived; a failure is answered, never thrown.
   *
   * @param message The start request.
   * @param port The utility process's parent port.
   * @param starter Starts the program. Defaults to the runtime package's `ChildProcessStarter`.
   * @returns A promise that settles once the parent process acknowledges the answer.
   * @example
   * ```ts
   * import { DetachedStart, type IParentPort } from "@noldova/desktop.electron";
   *
   * export function answerAsync(message: unknown, port: IParentPort): Promise<void> {
   *   return DetachedStart.runAsync(message, port);
   * }
   * ```
   */
  public static runAsync(message: unknown, port: IParentPort, starter?: IProcessStarter): Promise<void>;
}
