/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { SettingChange, WebViewEvent } from "@noldova/desktop.protocol";
import { Fake, type UnansweredCallException } from "@noldova/desktop.protocol/testing";
import type { ClientClosure, IAppShortcuts, IAppWindows, IModuleDatabase, IModuleLog, IModuleSecrets, IModuleSettings, IPermissionsContext, IRuntimeFiles,
  IRuntimePartContext, IRuntimeWebViews, IToolsContext, IWebViewRelay, PermissionRevocation, Registration, RegistrationException,
  WebViewFailureException, WebViewProtocolEvent } from "@noldova/desktop.runtime";

/**
 * A fake of the {@link IRuntimePartContext} that the runtime hands a module's
 * runtime part, for the module's tests: it records every call, a test answers
 * each member that returns a value with {@link Fake.answer}, its parts are
 * fakes of their own, and its raisers call the listeners the module added, as
 * the runtime would.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
 *
 * export function startNotes(): FakeRuntimePartContext {
 *   const context = new FakeRuntimePartContext();
 *   context.answer("moduleId", "notes");
 *   context.settings.answer("read", () => "dark");
 *   return context;
 * }
 *
 * export function registeredMethods(context: FakeRuntimePartContext): number {
 *   return context.callsOf("registerMethod").length;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
 *
 * export async function isUnansweredAsync(): Promise<boolean> {
 *   const fake = new FakeRuntimePartContext();
 *   try {
 *     await fake.getWorkFolderAsync();
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeRuntimePartContext extends Fake<IRuntimePartContext> implements IRuntimePartContext {
  /**
   * The fake that stands in for {@link IRuntimePartContext.database}, with
   * calls and answers of its own.
   */
  public readonly database: FakeModuleDatabase;

  /**
   * The fake that stands in for {@link IRuntimePartContext.settings}, with
   * calls and answers of its own.
   */
  public readonly settings: FakeModuleSettings;

  /**
   * The fake that stands in for {@link IRuntimePartContext.log}, with calls and
   * answers of its own.
   */
  public readonly log: FakeModuleLog;

  /**
   * The fake that stands in for {@link IRuntimePartContext.tools}, with calls
   * and answers of its own.
   */
  public readonly tools: FakeToolsContext;

  /**
   * The fake that stands in for {@link IRuntimePartContext.permissions}, with
   * calls and answers of its own.
   */
  public readonly permissions: FakePermissionsContext;

  /**
   * The fake that stands in for {@link IRuntimePartContext.webViews}, with
   * calls and answers of its own.
   */
  public readonly webViews: FakeRuntimeWebViews;

  /**
   * The fake that stands in for {@link IRuntimePartContext.files}, with calls
   * and answers of its own.
   */
  public readonly files: FakeRuntimeFiles;

  /**
   * The fake that stands in for {@link IRuntimePartContext.secrets}, with calls
   * and answers of its own.
   */
  public readonly secrets: FakeModuleSecrets;

  /**
   * The fake that stands in for {@link IRuntimePartContext.appWindows}, with
   * calls and answers of its own.
   */
  public readonly appWindows: FakeAppWindows;

  /**
   * The fake that stands in for {@link IRuntimePartContext.shortcuts}, with
   * calls and answers of its own.
   */
  public readonly shortcuts: FakeAppShortcuts;

  /**
   * Stands in for {@link IRuntimePartContext.getWorkFolderAsync}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerGetWorkFolderAsync(fake: FakeRuntimePartContext, value: Awaited<ReturnType<IRuntimePartContext["getWorkFolderAsync"]>>): void {
   *   fake.answer("getWorkFolderAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly getWorkFolderAsync: IRuntimePartContext["getWorkFolderAsync"];

  /**
   * Stands in for {@link IRuntimePartContext.beginWork}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerBeginWork(fake: FakeRuntimePartContext, value: ReturnType<IRuntimePartContext["beginWork"]>): void {
   *   fake.answer("beginWork", () => value);
   * }
   * ```
   */
  public readonly beginWork: IRuntimePartContext["beginWork"];

  /**
   * Stands in for {@link IRuntimePartContext.readEnvironmentAsync}. Records
   * each call, which {@link Fake.callsOf} reads, and returns what the answer
   * that {@link Fake.answer} gives returns; while unanswered, the promise it
   * returns rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerReadEnvironmentAsync(fake: FakeRuntimePartContext, value: Awaited<ReturnType<IRuntimePartContext["readEnvironmentAsync"]>>): void {
   *   fake.answer("readEnvironmentAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly readEnvironmentAsync: IRuntimePartContext["readEnvironmentAsync"];

  /**
   * Stands in for {@link IRuntimePartContext.startProcessAsync}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerStartProcessAsync(fake: FakeRuntimePartContext, value: Awaited<ReturnType<IRuntimePartContext["startProcessAsync"]>>): void {
   *   fake.answer("startProcessAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly startProcessAsync: IRuntimePartContext["startProcessAsync"];

  /**
   * Stands in for {@link IRuntimePartContext.startPseudoTerminalAsync}. Records
   * each call, which {@link Fake.callsOf} reads, and returns what the answer
   * that {@link Fake.answer} gives returns; while unanswered, the promise it
   * returns rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerStartPseudoTerminalAsync(fake: FakeRuntimePartContext, value: Awaited<ReturnType<IRuntimePartContext["startPseudoTerminalAsync"]>>): void {
   *   fake.answer("startPseudoTerminalAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly startPseudoTerminalAsync: IRuntimePartContext["startPseudoTerminalAsync"];

  /**
   * Stands in for {@link IRuntimePartContext.registerMethod}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function heardRegisterMethod(fake: FakeRuntimePartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerMethod", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerMethod: IRuntimePartContext["registerMethod"];

  /**
   * Stands in for {@link IRuntimePartContext.declareEvent}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerDeclareEvent(fake: FakeRuntimePartContext, value: ReturnType<IRuntimePartContext["declareEvent"]>): void {
   *   fake.answer("declareEvent", () => value);
   * }
   * ```
   */
  public readonly declareEvent: IRuntimePartContext["declareEvent"];

  /**
   * Stands in for {@link IRuntimePartContext.registerCommand}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function heardRegisterCommand(fake: FakeRuntimePartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerCommand", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerCommand: IRuntimePartContext["registerCommand"];

  /**
   * Stands in for {@link IRuntimePartContext.onClientClosed}. Records each
   * listener, which {@link FakeRuntimePartContext.raiseClientClosedAsync} calls
   * and {@link Fake.activeCallsOf} lists; like the interface, it gives no way
   * to remove it, and it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnClientClosed(fake: FakeRuntimePartContext): number {
   *   return fake.activeCallsOf("onClientClosed").length;
   * }
   * ```
   */
  public readonly onClientClosed: IRuntimePartContext["onClientClosed"];

  /**
   * Stands in for {@link IRuntimePartContext.postNotification}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerPostNotification(fake: FakeRuntimePartContext, value: ReturnType<IRuntimePartContext["postNotification"]>): void {
   *   fake.answer("postNotification", () => value);
   * }
   * ```
   */
  public readonly postNotification: IRuntimePartContext["postNotification"];

  /**
   * Stands in for {@link IRuntimePartContext.publishService}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function heardPublishService(fake: FakeRuntimePartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("publishService", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly publishService: IRuntimePartContext["publishService"];

  /**
   * Stands in for {@link IRuntimePartContext.onDependencyChanged}. Records each
   * listener, which {@link FakeRuntimePartContext.raiseDependencyChanged} calls
   * and {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnDependencyChanged(fake: FakeRuntimePartContext): number {
   *   return fake.activeCallsOf("onDependencyChanged").length;
   * }
   * ```
   */
  public readonly onDependencyChanged: IRuntimePartContext["onDependencyChanged"];

  /**
   * Stands in for {@link IRuntimePartContext.moduleId}. Reads the value that
   * {@link Fake.answer} gives.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerModuleId(fake: FakeRuntimePartContext, value: IRuntimePartContext["moduleId"]): void {
   *   fake.answer("moduleId", value);
   * }
   * ```
   */
  public get moduleId(): string;

  /**
   * Stands in for {@link IRuntimePartContext.moduleFolder}. Reads the value
   * that {@link Fake.answer} gives.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerModuleFolder(fake: FakeRuntimePartContext, value: IRuntimePartContext["moduleFolder"]): void {
   *   fake.answer("moduleFolder", value);
   * }
   * ```
   */
  public get moduleFolder(): string;

  /**
   * Stands in for {@link IRuntimePartContext.getService}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @typeParam T The service's type.
   *
   * @param name The service's name.
   *
   * @param type The class the service is an instance of.
   *
   * @returns What the answer returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerGetService(fake: FakeRuntimePartContext): void {
   *   fake.answer("getService", name => {
   *     throw new Error(`No ${name} service.`);
   *   });
   * }
   * ```
   */
  public getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;

  /**
   * Stands in for {@link IRuntimePartContext.findService}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @typeParam T The service's type.
   *
   * @param name The service's name.
   *
   * @param guard Tells whether a service is of the type.
   *
   * @returns What the answer returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerFindService(fake: FakeRuntimePartContext): void {
   *   fake.answer("findService", () => null);
   * }
   * ```
   */
  public findService<T extends object>(name: string, guard: (service: object) => service is T): T | null;

  /**
   * Tells each listener of {@link IRuntimePartContext.onClientClosed} that a
   * client closed, and waits for what each one returns, which the runtime
   * itself doesn't.
   *
   * As the runtime's own dispatch does, it skips a listener that an earlier one
   * removes during the call, and one that throws or rejects stops no other:
   * {@link Fake.errors} keeps what it threw, where the runtime's diagnostics
   * log it.
   *
   * @param closure The client that closed.
   *
   * @returns A promise that settles when every listener's work has.
   *
   * @example
   * ```ts
   * import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * import { ClientClosure } from "@noldova/desktop.runtime";
   *
   * export async function closeWindow(context: FakeRuntimePartContext): Promise<void> {
   *   await context.raiseClientClosedAsync(new ClientClosure(1, 1));
   * }
   * ```
   */
  public raiseClientClosedAsync(closure: ClientClosure): Promise<void>;

  /**
   * Tells each listener of {@link IRuntimePartContext.onDependencyChanged} that
   * an optional dependency became active or stopped.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other: the fake's
   * {@link FakeRuntimePartContext.log} records the line the module's log would
   * write.
   *
   * @param moduleId The dependency's id.
   *
   * @param isActive Whether it is active now.
   *
   * @example
   * ```ts
   * import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function stopGit(context: FakeRuntimePartContext): void {
   *   context.raiseDependencyChanged("git", false);
   * }
   * ```
   */
  public raiseDependencyChanged(moduleId: string, isActive: boolean): void;

  /**
   * The fakes it holds, its database, settings, log, tools, permissions,
   * web views, files, secrets, app windows and shortcuts, which
   * {@link Fake.beStrict} makes strict with it.
   *
   * @returns The fakes it holds.
   *
   * @example
   * ```ts
   * import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
   *
   * export function strict(): FakeRuntimePartContext {
   *   const fake = new FakeRuntimePartContext();
   *   fake.beStrict();
   *   return fake;
   * }
   * ```
   */
  protected override parts(): readonly Pick<Fake<object>, "beStrict">[];
}

/**
 * A fake of {@link IRuntimePartContext.database}, the module's database, for a
 * module's tests: it records every call, and a test answers each member that
 * returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
 *
 * export function withNoRows(): FakeModuleDatabase {
 *   const database = new FakeModuleDatabase();
 *   database.answer("readAll", () => []);
 *   return database;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakeModuleDatabase();
 *   try {
 *     fake.readAll("SELECT name FROM notes");
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeModuleDatabase extends Fake<IModuleDatabase> implements IModuleDatabase {
  /**
   * Stands in for {@link IModuleDatabase.read}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/desktop.runtime";
   * import type { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
   *
   * export function answerRead(fake: FakeModuleDatabase, value: ReturnType<IModuleDatabase["read"]>): void {
   *   fake.answer("read", () => value);
   * }
   * ```
   */
  public readonly read: IModuleDatabase["read"];

  /**
   * Stands in for {@link IModuleDatabase.readAll}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/desktop.runtime";
   * import type { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
   *
   * export function answerReadAll(fake: FakeModuleDatabase, value: ReturnType<IModuleDatabase["readAll"]>): void {
   *   fake.answer("readAll", () => value);
   * }
   * ```
   */
  public readonly readAll: IModuleDatabase["readAll"];

  /**
   * Stands in for {@link IModuleDatabase.run}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/desktop.runtime";
   * import type { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
   *
   * export function answerRun(fake: FakeModuleDatabase, value: ReturnType<IModuleDatabase["run"]>): void {
   *   fake.answer("run", () => value);
   * }
   * ```
   */
  public readonly run: IModuleDatabase["run"];

  /**
   * Stands in for {@link IModuleDatabase.transaction}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @typeParam T What the action returns.
   *
   * @param action What runs in the transaction.
   *
   * @returns What the answer returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";
   *
   * export function answerTransaction(fake: FakeModuleDatabase): void {
   *   fake.answer("transaction", action => action());
   * }
   * ```
   */
  public transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T;
}

/**
 * A fake of {@link IRuntimePartContext.settings}, the module's settings, for a
 * module's tests: it records every call, and a test answers each member that
 * returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
 *
 * export function withDark(): FakeModuleSettings {
 *   const settings = new FakeModuleSettings();
 *   settings.answer("read", () => "dark");
 *   return settings;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakeModuleSettings();
 *   try {
 *     fake.read("notes.theme");
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeModuleSettings extends Fake<IModuleSettings> implements IModuleSettings {
  /**
   * Stands in for {@link IModuleSettings.read}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IModuleSettings } from "@noldova/desktop.runtime";
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function answerRead(fake: FakeModuleSettings, value: ReturnType<IModuleSettings["read"]>): void {
   *   fake.answer("read", () => value);
   * }
   * ```
   */
  public readonly read: IModuleSettings["read"];

  /**
   * Stands in for {@link IModuleSettings.write}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function heardWrite(fake: FakeModuleSettings): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("write", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly write: IModuleSettings["write"];

  /**
   * Stands in for {@link IModuleSettings.reset}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function heardReset(fake: FakeModuleSettings): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("reset", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly reset: IModuleSettings["reset"];

  /**
   * Stands in for {@link IModuleSettings.onChanged}. Records each listener,
   * which {@link FakeModuleSettings.raiseChanged} calls and
   * {@link Fake.activeCallsOf} lists; like the interface, it gives no way to
   * remove it, and it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnChanged(fake: FakeModuleSettings): number {
   *   return fake.activeCallsOf("onChanged").length;
   * }
   * ```
   */
  public readonly onChanged: IModuleSettings["onChanged"];

  /**
   * Stands in for {@link IModuleSettings.onDeviceKnown}. Records each
   * listener, which {@link FakeModuleSettings.raiseDeviceKnown} calls and
   * {@link Fake.activeCallsOf} lists; like the interface, it gives no way to
   * remove it, and it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnDeviceKnown(fake: FakeModuleSettings): number {
   *   return fake.activeCallsOf("onDeviceKnown").length;
   * }
   * ```
   */
  public readonly onDeviceKnown: IModuleSettings["onDeviceKnown"];

  /**
   * Stands in for {@link IModuleSettings.setScopeParent}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function heardSetScopeParent(fake: FakeModuleSettings): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("setScopeParent", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly setScopeParent: IModuleSettings["setScopeParent"];

  /**
   * Stands in for {@link IModuleSettings.removeScope}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function heardRemoveScope(fake: FakeModuleSettings): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("removeScope", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly removeScope: IModuleSettings["removeScope"];

  /**
   * Stands in for {@link IModuleSettings.isDeviceKnown}. Reads the value that
   * {@link Fake.answer} gives.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IModuleSettings } from "@noldova/desktop.runtime";
   * import type { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function answerIsDeviceKnown(fake: FakeModuleSettings, value: IModuleSettings["isDeviceKnown"]): void {
   *   fake.answer("isDeviceKnown", value);
   * }
   * ```
   */
  public get isDeviceKnown(): boolean;

  /**
   * Tells each listener of {@link IModuleSettings.onDeviceKnown} that the
   * runtime learned its device. It changes no answer: give
   * `isDeviceKnown` its new value with {@link Fake.answer} first.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops the rest, and its error comes out of this
   * call.
   *
   * @example
   * ```ts
   * import { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * export function learnDevice(settings: FakeModuleSettings): void {
   *   settings.answer("isDeviceKnown", true);
   *   settings.raiseDeviceKnown();
   * }
   * ```
   */
  public raiseDeviceKnown(): void;

  /**
   * Tells each listener of {@link IModuleSettings.onChanged} for the setting
   * that its value changed.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops the rest, and its error comes out of this
   * call.
   *
   * @param name The setting's name.
   *
   * @param change The change.
   *
   * @example
   * ```ts
   * import { FakeModuleSettings } from "@noldova/desktop.runtime/testing";
   *
   * import type { SettingChange } from "@noldova/desktop.protocol";
   *
   * export function change(settings: FakeModuleSettings, value: SettingChange): void {
   *   settings.raiseChanged("terminal.theme", value);
   * }
   * ```
   */
  public raiseChanged(name: string, change: SettingChange): void;
}

/**
 * A fake of {@link IRuntimePartContext.log}, the module's log, for a module's
 * tests: it records every call, and a test answers each member that returns a
 * value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
 *
 * export function written(log: FakeModuleLog): readonly string[] {
 *   return log.callsOf("write").map(t => String(t[0]));
 * }
 * ```
 */
export declare class FakeModuleLog extends Fake<IModuleLog> implements IModuleLog {
  /**
   * Stands in for {@link IModuleLog.write}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeModuleLog } from "@noldova/desktop.runtime/testing";
   *
   * export function heardWrite(fake: FakeModuleLog): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("write", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly write: IModuleLog["write"];
}

/**
 * A fake of {@link IRuntimePartContext.secrets}, the module's secrets, for a
 * module's tests: it records every call, and a test answers each member that
 * returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
 *
 * export function withNone(): FakeModuleSecrets {
 *   const secrets = new FakeModuleSecrets();
 *   secrets.answer("readAsync", () => Promise.resolve(null));
 *   return secrets;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
 *
 * export async function isUnansweredAsync(): Promise<boolean> {
 *   const fake = new FakeModuleSecrets();
 *   try {
 *     await fake.readAsync("notes.token");
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeModuleSecrets extends Fake<IModuleSecrets> implements IModuleSecrets {
  /**
   * Stands in for {@link IModuleSecrets.saveAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IModuleSecrets } from "@noldova/desktop.runtime";
   * import type { FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
   *
   * export function answerSaveAsync(fake: FakeModuleSecrets, value: Awaited<ReturnType<IModuleSecrets["saveAsync"]>>): void {
   *   fake.answer("saveAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly saveAsync: IModuleSecrets["saveAsync"];

  /**
   * Stands in for {@link IModuleSecrets.readAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IModuleSecrets } from "@noldova/desktop.runtime";
   * import type { FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
   *
   * export function answerReadAsync(fake: FakeModuleSecrets, value: Awaited<ReturnType<IModuleSecrets["readAsync"]>>): void {
   *   fake.answer("readAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly readAsync: IModuleSecrets["readAsync"];

  /**
   * Stands in for {@link IModuleSecrets.removeAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IModuleSecrets } from "@noldova/desktop.runtime";
   * import type { FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
   *
   * export function answerRemoveAsync(fake: FakeModuleSecrets, value: Awaited<ReturnType<IModuleSecrets["removeAsync"]>>): void {
   *   fake.answer("removeAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly removeAsync: IModuleSecrets["removeAsync"];

  /**
   * Stands in for {@link IModuleSecrets.isSetAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IModuleSecrets } from "@noldova/desktop.runtime";
   * import type { FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
   *
   * export function answerIsSetAsync(fake: FakeModuleSecrets, value: Awaited<ReturnType<IModuleSecrets["isSetAsync"]>>): void {
   *   fake.answer("isSetAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly isSetAsync: IModuleSecrets["isSetAsync"];
}

/**
 * A fake of {@link IRuntimePartContext.tools}, the module's agent tools, for a
 * module's tests: it records every call, and a test answers each member that
 * returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeToolsContext } from "@noldova/desktop.runtime/testing";
 *
 * export function running(): FakeToolsContext {
 *   const tools = new FakeToolsContext();
 *   tools.answer("isStopped", false);
 *   return tools;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeToolsContext } from "@noldova/desktop.runtime/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakeToolsContext();
 *   try {
 *     void fake.isStopped;
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeToolsContext extends Fake<IToolsContext> implements IToolsContext {
  /**
   * Makes the fake.
   *
   * @param log The log that takes a listener's failure, as the module's log
   * does in the runtime; by default, a {@link FakeModuleLog} of the fake's own.
   * {@link FakeRuntimePartContext} passes its
   * {@link FakeRuntimePartContext.log}.
   *
   * @example
   * ```ts
   * import { FakeModuleLog, FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function logged(log: FakeModuleLog): FakeToolsContext {
   *   return new FakeToolsContext(log);
   * }
   * ```
   */
  public constructor(log?: IModuleLog);

  /**
   * Stands in for {@link IToolsContext.register}. Records each registration,
   * which {@link Fake.activeCallsOf} lists until the {@link Registration} it
   * returns is disposed. With the answer that {@link Fake.answer} gives, it
   * also passes the registration to that answer, such as a
   * `ToolRegistry`'s own, and disposing the {@link Registration} it
   * returns also disposes the answer's; an answer that throws keeps no
   * registration, and its error comes out of the call.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeRegister(fake: FakeToolsContext): number {
   *   return fake.activeCallsOf("register").length;
   * }
   * ```
   *
   * @example
   * ```ts
   * import { ToolDescriptor, type ToolRegistry } from "@noldova/desktop.runtime";
   * import type { FakeModuleLog, FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function serveThrough(fake: FakeToolsContext, registry: ToolRegistry, log: FakeModuleLog, tools: readonly string[]): void {
   *   fake.answer("register", (descriptor, handler) => registry.register("notes", new ToolDescriptor(descriptor, tools), handler, tools, log));
   * }
   * ```
   */
  public readonly register: IToolsContext["register"];

  /**
   * Stands in for {@link IToolsContext.openSession}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IToolsContext } from "@noldova/desktop.runtime";
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerOpenSession(fake: FakeToolsContext, value: ReturnType<IToolsContext["openSession"]>): void {
   *   fake.answer("openSession", () => value);
   * }
   * ```
   */
  public readonly openSession: IToolsContext["openSession"];

  /**
   * Stands in for {@link IToolsContext.onSessionEnded}. Records each listener,
   * which {@link Fake.activeCallsOf} lists until the {@link Registration} it
   * returns is disposed, and which {@link FakeToolsContext.raiseSessionEnded}
   * calls. With the answer that {@link Fake.answer} gives, such as a
   * `ToolRegistry`'s own, the listener goes to that answer instead, and
   * the raiser doesn't call it; disposing the {@link Registration} it returns
   * also disposes the answer's.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnSessionEnded(fake: FakeToolsContext): number {
   *   return fake.activeCallsOf("onSessionEnded").length;
   * }
   * ```
   */
  public readonly onSessionEnded: IToolsContext["onSessionEnded"];

  /**
   * Stands in for {@link IToolsContext.openEndpointAsync}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IToolsContext } from "@noldova/desktop.runtime";
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerOpenEndpointAsync(fake: FakeToolsContext, value: Awaited<ReturnType<IToolsContext["openEndpointAsync"]>>): void {
   *   fake.answer("openEndpointAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly openEndpointAsync: IToolsContext["openEndpointAsync"];

  /**
   * Stands in for {@link IToolsContext.stopAll}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function heardStopAll(fake: FakeToolsContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("stopAll", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly stopAll: IToolsContext["stopAll"];

  /**
   * Stands in for {@link IToolsContext.stopSession}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function heardStopSession(fake: FakeToolsContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("stopSession", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly stopSession: IToolsContext["stopSession"];

  /**
   * Stands in for {@link IToolsContext.onSessionStopped}. Records each
   * listener, which {@link Fake.activeCallsOf} lists until the
   * {@link Registration} it returns is disposed, and which
   * {@link FakeToolsContext.raiseSessionStopped} calls. With the answer that
   * {@link Fake.answer} gives, such as a `ToolRegistry`'s own, the
   * listener goes to that answer instead, and the raiser doesn't call it;
   * disposing the {@link Registration} it returns also disposes the answer's.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnSessionStopped(fake: FakeToolsContext): number {
   *   return fake.activeCallsOf("onSessionStopped").length;
   * }
   * ```
   */
  public readonly onSessionStopped: IToolsContext["onSessionStopped"];

  /**
   * Stands in for {@link IToolsContext.resumeAll}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function heardResumeAll(fake: FakeToolsContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("resumeAll", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly resumeAll: IToolsContext["resumeAll"];

  /**
   * Stands in for {@link IToolsContext.onStopped}. Records each listener, which
   * {@link Fake.activeCallsOf} lists until the {@link Registration} it returns
   * is disposed, and which {@link FakeToolsContext.raiseStopped} calls. With
   * the answer that {@link Fake.answer} gives, such as a
   * `ToolRegistry`'s own, the listener goes to that answer instead, and
   * the raiser doesn't call it; disposing the {@link Registration} it returns
   * also disposes the answer's.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnStopped(fake: FakeToolsContext): number {
   *   return fake.activeCallsOf("onStopped").length;
   * }
   * ```
   */
  public readonly onStopped: IToolsContext["onStopped"];

  /**
   * Stands in for {@link IToolsContext.onResumed}. Records each listener, which
   * {@link Fake.activeCallsOf} lists until the {@link Registration} it returns
   * is disposed, and which {@link FakeToolsContext.raiseResumed} calls. With
   * the answer that {@link Fake.answer} gives, such as a
   * `ToolRegistry`'s own, the listener goes to that answer instead, and
   * the raiser doesn't call it; disposing the {@link Registration} it returns
   * also disposes the answer's.
   *
   * @example
   * ```ts
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnResumed(fake: FakeToolsContext): number {
   *   return fake.activeCallsOf("onResumed").length;
   * }
   * ```
   */
  public readonly onResumed: IToolsContext["onResumed"];

  /**
   * Stands in for {@link IToolsContext.isStopped}. Reads the value that
   * {@link Fake.answer} gives.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IToolsContext } from "@noldova/desktop.runtime";
   * import type { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerIsStopped(fake: FakeToolsContext, value: IToolsContext["isStopped"]): void {
   *   fake.answer("isStopped", value);
   * }
   * ```
   */
  public get isStopped(): boolean;

  /**
   * Tells each listener of {@link IToolsContext.onSessionEnded} that a tool
   * session ended.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other: the log
   * the fake was made with records the line the module's log would write.
   *
   * @param session The session's id.
   *
   * @example
   * ```ts
   * import { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function end(tools: FakeToolsContext): void {
   *   tools.raiseSessionEnded("session-1");
   * }
   * ```
   */
  public raiseSessionEnded(session: string): void;

  /**
   * Tells each listener of {@link IToolsContext.onSessionStopped} that the
   * person stopped a tool session.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other: the log
   * the fake was made with records the line the module's log would write.
   *
   * @param session The session's id.
   *
   * @param reason Why it stopped.
   *
   * @example
   * ```ts
   * import { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function stop(tools: FakeToolsContext): void {
   *   tools.raiseSessionStopped("session-1", "Stopped by the person.");
   * }
   * ```
   */
  public raiseSessionStopped(session: string, reason: string): void;

  /**
   * Tells each listener of {@link IToolsContext.onStopped} that every tool
   * stopped.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other: the log
   * the fake was made with records the line the module's log would write.
   *
   * @param reason Why they stopped.
   *
   * @example
   * ```ts
   * import { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function stopAll(tools: FakeToolsContext): void {
   *   tools.raiseStopped("Stopped by the person.");
   * }
   * ```
   */
  public raiseStopped(reason: string): void;

  /**
   * Tells each listener of {@link IToolsContext.onResumed} that the tools
   * resumed.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other: the log
   * the fake was made with records the line the module's log would write.
   *
   * @example
   * ```ts
   * import { FakeToolsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function resume(tools: FakeToolsContext): void {
   *   tools.raiseResumed();
   * }
   * ```
   */
  public raiseResumed(): void;
}

/**
 * A fake of {@link IRuntimePartContext.permissions}, the module's permission
 * answers, for a module's tests: it records every call, and a test answers each
 * member that returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakePermissionsContext } from "@noldova/desktop.runtime/testing";
 *
 * export function withNone(): FakePermissionsContext {
 *   const permissions = new FakePermissionsContext();
 *   permissions.answer("listRemembered", () => []);
 *   return permissions;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakePermissionsContext } from "@noldova/desktop.runtime/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakePermissionsContext();
 *   try {
 *     fake.listRemembered();
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakePermissionsContext extends Fake<IPermissionsContext> implements IPermissionsContext {
  /**
   * Makes the fake.
   *
   * @param log The log that takes a listener's failure, as the module's log
   * does in the runtime; by default, a {@link FakeModuleLog} of the fake's own.
   * {@link FakeRuntimePartContext} passes its
   * {@link FakeRuntimePartContext.log}.
   *
   * @example
   * ```ts
   * import { FakeModuleLog, FakePermissionsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function logged(log: FakeModuleLog): FakePermissionsContext {
   *   return new FakePermissionsContext(log);
   * }
   * ```
   */
  public constructor(log?: IModuleLog);

  /**
   * Stands in for {@link IPermissionsContext.registerAnswerer}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the
   * {@link Registration} it returns is disposed; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakePermissionsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeRegisterAnswerer(fake: FakePermissionsContext): number {
   *   return fake.activeCallsOf("registerAnswerer").length;
   * }
   * ```
   */
  public readonly registerAnswerer: IPermissionsContext["registerAnswerer"];

  /**
   * Stands in for {@link IPermissionsContext.listRemembered}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IPermissionsContext } from "@noldova/desktop.runtime";
   * import type { FakePermissionsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerListRemembered(fake: FakePermissionsContext, value: ReturnType<IPermissionsContext["listRemembered"]>): void {
   *   fake.answer("listRemembered", () => value);
   * }
   * ```
   */
  public readonly listRemembered: IPermissionsContext["listRemembered"];

  /**
   * Stands in for {@link IPermissionsContext.revoke}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IPermissionsContext } from "@noldova/desktop.runtime";
   * import type { FakePermissionsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function answerRevoke(fake: FakePermissionsContext, value: ReturnType<IPermissionsContext["revoke"]>): void {
   *   fake.answer("revoke", () => value);
   * }
   * ```
   */
  public readonly revoke: IPermissionsContext["revoke"];

  /**
   * Stands in for {@link IPermissionsContext.onRevoked}. Records each listener,
   * which {@link FakePermissionsContext.raiseRevoked} calls and
   * {@link Fake.activeCallsOf} lists until the {@link Registration} it returns
   * is disposed; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakePermissionsContext } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnRevoked(fake: FakePermissionsContext): number {
   *   return fake.activeCallsOf("onRevoked").length;
   * }
   * ```
   */
  public readonly onRevoked: IPermissionsContext["onRevoked"];

  /**
   * Tells each listener of {@link IPermissionsContext.onRevoked} that the
   * person revoked a remembered answer.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops no other: the log the fake was made with
   * records the line the module's log would write.
   *
   * @param revocation The answer revoked.
   *
   * @example
   * ```ts
   * import { FakePermissionsContext } from "@noldova/desktop.runtime/testing";
   *
   * import { PermissionRevocation } from "@noldova/desktop.runtime";
   *
   * export function revoke(permissions: FakePermissionsContext): void {
   *   permissions.raiseRevoked(new PermissionRevocation("git.push", null, "folder"));
   * }
   * ```
   */
  public raiseRevoked(revocation: PermissionRevocation): void;
}

/**
 * A fake of {@link IRuntimePartContext.webViews}, the module's web views as its
 * runtime part drives them, for a module's tests: it records every call, and a
 * test answers each member that returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
 *
 * export function withNone(): FakeRuntimeWebViews {
 *   const webViews = new FakeRuntimeWebViews();
 *   webViews.answer("list", () => []);
 *   return webViews;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakeRuntimeWebViews();
 *   try {
 *     fake.list();
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeRuntimeWebViews extends Fake<IRuntimeWebViews> implements IRuntimeWebViews {
  /**
   * The fake that stands in for {@link IRuntimeWebViews.relay}, with calls and
   * answers of its own.
   */
  public readonly relay: FakeWebViewRelay;

  /**
   * Stands in for {@link IRuntimeWebViews.list}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function answerList(fake: FakeRuntimeWebViews, value: ReturnType<IRuntimeWebViews["list"]>): void {
   *   fake.answer("list", () => value);
   * }
   * ```
   */
  public readonly list: IRuntimeWebViews["list"];

  /**
   * Stands in for {@link IRuntimeWebViews.navigateAsync}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function answerNavigateAsync(fake: FakeRuntimeWebViews, value: Awaited<ReturnType<IRuntimeWebViews["navigateAsync"]>>): void {
   *   fake.answer("navigateAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly navigateAsync: IRuntimeWebViews["navigateAsync"];

  /**
   * Stands in for {@link IRuntimeWebViews.actAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function answerActAsync(fake: FakeRuntimeWebViews, value: Awaited<ReturnType<IRuntimeWebViews["actAsync"]>>): void {
   *   fake.answer("actAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly actAsync: IRuntimeWebViews["actAsync"];

  /**
   * Stands in for {@link IRuntimeWebViews.setAllowedOriginsAsync}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function answerSetAllowedOriginsAsync(fake: FakeRuntimeWebViews, value: Awaited<ReturnType<IRuntimeWebViews["setAllowedOriginsAsync"]>>): void {
   *   fake.answer("setAllowedOriginsAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly setAllowedOriginsAsync: IRuntimeWebViews["setAllowedOriginsAsync"];

  /**
   * Stands in for {@link IRuntimeWebViews.setControlledAsync}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function answerSetControlledAsync(fake: FakeRuntimeWebViews, value: Awaited<ReturnType<IRuntimeWebViews["setControlledAsync"]>>): void {
   *   fake.answer("setControlledAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly setControlledAsync: IRuntimeWebViews["setControlledAsync"];

  /**
   * Stands in for {@link IRuntimeWebViews.clearProfileAsync}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function answerClearProfileAsync(fake: FakeRuntimeWebViews, value: Awaited<ReturnType<IRuntimeWebViews["clearProfileAsync"]>>): void {
   *   fake.answer("clearProfileAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly clearProfileAsync: IRuntimeWebViews["clearProfileAsync"];

  /**
   * Stands in for {@link IRuntimeWebViews.onViewEvent}. Records each listener,
   * which {@link FakeRuntimeWebViews.raiseViewEvent} calls and
   * {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnViewEvent(fake: FakeRuntimeWebViews): number {
   *   return fake.activeCallsOf("onViewEvent").length;
   * }
   * ```
   */
  public readonly onViewEvent: IRuntimeWebViews["onViewEvent"];

  /**
   * Tells each listener of {@link IRuntimeWebViews.onViewEvent} what happened
   * in one of the module's web views.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops no other: {@link Fake.errors} keeps what
   * it threw, where Noldova Desktop reports it in a place a test can't read.
   *
   * @param event What happened.
   *
   * @example
   * ```ts
   * import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
   *
   * export function close(webViews: FakeRuntimeWebViews): void {
   *   webViews.raiseViewEvent(new WebViewEvent("notes", "view-1", WebViewEventKind.Closed));
   * }
   * ```
   */
  public raiseViewEvent(event: WebViewEvent): void;

  /**
   * The fakes it holds, its relay, which {@link Fake.beStrict} makes strict
   * with it.
   *
   * @returns The fakes it holds.
   *
   * @example
   * ```ts
   * import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
   *
   * export function strict(): FakeRuntimeWebViews {
   *   const fake = new FakeRuntimeWebViews();
   *   fake.beStrict();
   *   return fake;
   * }
   * ```
   */
  protected override parts(): readonly Pick<Fake<object>, "beStrict">[];
}

/**
 * A fake of {@link IRuntimeWebViews.relay}, the protocol relay to the module's
 * web views, for a module's tests: it records every call, and a test answers
 * each member that returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeWebViewRelay } from "@noldova/desktop.runtime/testing";
 *
 * export function answering(): FakeWebViewRelay {
 *   const relay = new FakeWebViewRelay();
 *   relay.answer("sendAsync", () => Promise.resolve({}));
 *   return relay;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeWebViewRelay } from "@noldova/desktop.runtime/testing";
 *
 * export async function isUnansweredAsync(): Promise<boolean> {
 *   const fake = new FakeWebViewRelay();
 *   try {
 *     await fake.sendAsync("view-1", "Page.reload", {}, 1000);
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeWebViewRelay extends Fake<IWebViewRelay> implements IWebViewRelay {
  /**
   * Stands in for {@link IWebViewRelay.sendAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing. It refuses
   * `Emulation.setFocusEmulationEnabled` whatever the answer, as the host does,
   * since the host owns focus emulation.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   * @throws {WebViewFailureException} As the rejection of the promise it
   * returns, of kind `NotAllowed`, for `Emulation.setFocusEmulationEnabled`.
   *
   * @example
   * ```ts
   * import type { IWebViewRelay } from "@noldova/desktop.runtime";
   * import type { FakeWebViewRelay } from "@noldova/desktop.runtime/testing";
   *
   * export function answerSendAsync(fake: FakeWebViewRelay, value: Awaited<ReturnType<IWebViewRelay["sendAsync"]>>): void {
   *   fake.answer("sendAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly sendAsync: IWebViewRelay["sendAsync"];

  /**
   * Stands in for {@link IWebViewRelay.onProtocolEvent}. Records each listener,
   * which {@link FakeWebViewRelay.raiseProtocolEvent} calls and
   * {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWebViewRelay } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnProtocolEvent(fake: FakeWebViewRelay): number {
   *   return fake.activeCallsOf("onProtocolEvent").length;
   * }
   * ```
   */
  public readonly onProtocolEvent: IWebViewRelay["onProtocolEvent"];

  /**
   * Tells each listener of {@link IWebViewRelay.onProtocolEvent} for the web
   * view that its page sent a protocol event.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops no other: {@link Fake.errors} keeps what
   * it threw, where Noldova Desktop reports it in a place a test can't read.
   *
   * @param id The web view's id.
   *
   * @param event The event.
   *
   * @example
   * ```ts
   * import { FakeWebViewRelay } from "@noldova/desktop.runtime/testing";
   *
   * import { WebViewProtocolEvent } from "@noldova/desktop.runtime";
   *
   * export function load(relay: FakeWebViewRelay): void {
   *   relay.raiseProtocolEvent("view-1", new WebViewProtocolEvent("view-1", "Page.loadEventFired", {}, false));
   * }
   * ```
   */
  public raiseProtocolEvent(id: string, event: WebViewProtocolEvent): void;
}

/**
 * A fake of {@link IRuntimePartContext.files}, the files the window granted the
 * module, for a module's tests: it records every call, and a test answers each
 * member that returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeRuntimeFiles } from "@noldova/desktop.runtime/testing";
 *
 * export function sharing(): FakeRuntimeFiles {
 *   const files = new FakeRuntimeFiles();
 *   files.answer("shareAsync", () => Promise.resolve("grant-1"));
 *   return files;
 * }
 * ```
 *
 * @example
 * ```ts
 * import type { RequestContext } from "@noldova/desktop.runtime";
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeRuntimeFiles } from "@noldova/desktop.runtime/testing";
 *
 * export async function isUnansweredAsync(request: RequestContext): Promise<boolean> {
 *   const fake = new FakeRuntimeFiles();
 *   try {
 *     await fake.redeemAsync("grant-1", request);
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeRuntimeFiles extends Fake<IRuntimeFiles> implements IRuntimeFiles {
  /**
   * Stands in for {@link IRuntimeFiles.redeemAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimeFiles } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeFiles } from "@noldova/desktop.runtime/testing";
   *
   * export function answerRedeemAsync(fake: FakeRuntimeFiles, value: Awaited<ReturnType<IRuntimeFiles["redeemAsync"]>>): void {
   *   fake.answer("redeemAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly redeemAsync: IRuntimeFiles["redeemAsync"];

  /**
   * Stands in for {@link IRuntimeFiles.shareAsync}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns; while unanswered, the promise it returns
   * rejects rather than the call throwing.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { IRuntimeFiles } from "@noldova/desktop.runtime";
   * import type { FakeRuntimeFiles } from "@noldova/desktop.runtime/testing";
   *
   * export function answerShareAsync(fake: FakeRuntimeFiles, value: Awaited<ReturnType<IRuntimeFiles["shareAsync"]>>): void {
   *   fake.answer("shareAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly shareAsync: IRuntimeFiles["shareAsync"];
}

/**
 * A fake of {@link IRuntimePartContext.appWindows}, the app's open windows, for
 * a module's tests: it records every call, and a test answers each member that
 * returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeAppWindows } from "@noldova/desktop.runtime/testing";
 *
 * export function withNone(): FakeAppWindows {
 *   const windows = new FakeAppWindows();
 *   windows.answer("list", () => []);
 *   return windows;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeAppWindows } from "@noldova/desktop.runtime/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakeAppWindows();
 *   try {
 *     fake.list();
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeAppWindows extends Fake<IAppWindows> implements IAppWindows {
  /**
   * Stands in for {@link IAppWindows.list}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IAppWindows } from "@noldova/desktop.runtime";
   * import type { FakeAppWindows } from "@noldova/desktop.runtime/testing";
   *
   * export function answerList(fake: FakeAppWindows, value: ReturnType<IAppWindows["list"]>): void {
   *   fake.answer("list", () => value);
   * }
   * ```
   */
  public readonly list: IAppWindows["list"];

  /**
   * Stands in for {@link IAppWindows.onChanged}. Records each listener, which
   * {@link FakeAppWindows.raiseChanged} calls and {@link Fake.activeCallsOf}
   * lists until the disposer it returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeAppWindows } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnChanged(fake: FakeAppWindows): number {
   *   return fake.activeCallsOf("onChanged").length;
   * }
   * ```
   */
  public readonly onChanged: IAppWindows["onChanged"];

  /**
   * Tells each listener of {@link IAppWindows.onChanged} that a window opened,
   * closed or changed.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other:
   * {@link Fake.errors} keeps what it threw, where Noldova Desktop reports it in a
   * place a test can't read.
   *
   * @example
   * ```ts
   * import { FakeAppWindows } from "@noldova/desktop.runtime/testing";
   *
   * export function change(windows: FakeAppWindows): void {
   *   windows.raiseChanged();
   * }
   * ```
   */
  public raiseChanged(): void;
}

/**
 * A fake of {@link IRuntimePartContext.shortcuts}, the app's own shortcuts, for
 * a module's tests: it records every call, and a test answers each member that
 * returns a value with {@link Fake.answer}.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeAppShortcuts } from "@noldova/desktop.runtime/testing";
 *
 * export function withNone(): FakeAppShortcuts {
 *   const shortcuts = new FakeAppShortcuts();
 *   shortcuts.answer("list", () => []);
 *   return shortcuts;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeAppShortcuts } from "@noldova/desktop.runtime/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakeAppShortcuts();
 *   try {
 *     fake.list();
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeAppShortcuts extends Fake<IAppShortcuts> implements IAppShortcuts {
  /**
   * Stands in for {@link IAppShortcuts.list}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IAppShortcuts } from "@noldova/desktop.runtime";
   * import type { FakeAppShortcuts } from "@noldova/desktop.runtime/testing";
   *
   * export function answerList(fake: FakeAppShortcuts, value: ReturnType<IAppShortcuts["list"]>): void {
   *   fake.answer("list", () => value);
   * }
   * ```
   */
  public readonly list: IAppShortcuts["list"];

  /**
   * Stands in for {@link IAppShortcuts.has}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IAppShortcuts } from "@noldova/desktop.runtime";
   * import type { FakeAppShortcuts } from "@noldova/desktop.runtime/testing";
   *
   * export function answerHas(fake: FakeAppShortcuts, value: ReturnType<IAppShortcuts["has"]>): void {
   *   fake.answer("has", () => value);
   * }
   * ```
   */
  public readonly has: IAppShortcuts["has"];

  /**
   * Stands in for {@link IAppShortcuts.onChanged}. Records each listener, which
   * {@link FakeAppShortcuts.raiseChanged} calls and {@link Fake.activeCallsOf}
   * lists until the disposer it returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeAppShortcuts } from "@noldova/desktop.runtime/testing";
   *
   * export function activeOnChanged(fake: FakeAppShortcuts): number {
   *   return fake.activeCallsOf("onChanged").length;
   * }
   * ```
   */
  public readonly onChanged: IAppShortcuts["onChanged"];

  /**
   * Tells each listener of {@link IAppShortcuts.onChanged} that the app's
   * shortcuts changed.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other:
   * {@link Fake.errors} keeps what it threw, where Noldova Desktop reports it in a
   * place a test can't read.
   *
   * @example
   * ```ts
   * import { FakeAppShortcuts } from "@noldova/desktop.runtime/testing";
   *
   * export function change(shortcuts: FakeAppShortcuts): void {
   *   shortcuts.raiseChanged();
   * }
   * ```
   */
  public raiseChanged(): void;
}
