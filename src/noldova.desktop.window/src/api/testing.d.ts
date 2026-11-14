/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, Type } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import type { AgentControlState, SettingScope } from "@noldova/desktop.protocol";
import { Fake, type UnansweredCallException } from "@noldova/desktop.protocol/testing";
import type { IWindowPalette, IWindowPartContext, IWindowSecrets, IWindowWebViews } from "@noldova/desktop.window";

/**
 * A fake of the {@link IWindowPartContext} that the window hands a module's
 * window part, for the module's tests: it records every call, a test answers
 * each member that returns a value with {@link Fake.answer}, and its raisers
 * call the listeners the module added, as the window would.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
 *
 * export function startNotes(): FakeWindowPartContext {
 *   const context = new FakeWindowPartContext();
 *   context.answer("readSetting", () => "dark");
 *   context.answer("requestAsync", () => Promise.resolve([]));
 *   return context;
 * }
 *
 * export function registeredViews(context: FakeWindowPartContext): number {
 *   return context.callsOf("registerView").length;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
 *
 * export function isUnanswered(): boolean {
 *   const fake = new FakeWindowPartContext();
 *   try {
 *     fake.readSetting("notes.theme");
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeWindowPartContext extends Fake<IWindowPartContext> implements IWindowPartContext {
  /**
   * The fake that stands in for {@link IWindowPartContext.webViews}, with calls
   * and answers of its own.
   */
  public readonly webViews: FakeWindowWebViews;

  /**
   * The fake that stands in for {@link IWindowPartContext.secrets}, with calls
   * and answers of its own.
   */
  public readonly secrets: FakeWindowSecrets;

  /**
   * Stands in for {@link IWindowPartContext.registerView}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardRegisterView(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerView", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerView: IWindowPartContext["registerView"];

  /**
   * Stands in for {@link IWindowPartContext.registerDocument}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardRegisterDocument(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerDocument", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerDocument: IWindowPartContext["registerDocument"];

  /**
   * Stands in for {@link IWindowPartContext.registerPlaceholder}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardRegisterPlaceholder(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerPlaceholder", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerPlaceholder: IWindowPartContext["registerPlaceholder"];

  /**
   * Stands in for {@link IWindowPartContext.registerSettingsPage}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardRegisterSettingsPage(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerSettingsPage", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerSettingsPage: IWindowPartContext["registerSettingsPage"];

  /**
   * Stands in for {@link IWindowPartContext.setSettingsRows}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardSetSettingsRows(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("setSettingsRows", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly setSettingsRows: IWindowPartContext["setSettingsRows"];

  /**
   * Stands in for {@link IWindowPartContext.registerCommand}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardRegisterCommand(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerCommand", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerCommand: IWindowPartContext["registerCommand"];

  /**
   * Stands in for {@link IWindowPartContext.registerSearchSource}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardRegisterSearchSource(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("registerSearchSource", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly registerSearchSource: IWindowPartContext["registerSearchSource"];

  /**
   * Stands in for {@link IWindowPartContext.registerStatusBarItem}. Records
   * each call, which {@link Fake.callsOf} reads, and returns what the answer
   * that {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerRegisterStatusBarItem(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["registerStatusBarItem"]>): void {
   *   fake.answer("registerStatusBarItem", () => value);
   * }
   * ```
   */
  public readonly registerStatusBarItem: IWindowPartContext["registerStatusBarItem"];

  /**
   * Stands in for {@link IWindowPartContext.registerTopBarAction}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerRegisterTopBarAction(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["registerTopBarAction"]>): void {
   *   fake.answer("registerTopBarAction", () => value);
   * }
   * ```
   */
  public readonly registerTopBarAction: IWindowPartContext["registerTopBarAction"];

  /**
   * Stands in for {@link IWindowPartContext.registerSave}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the disposer it
   * returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeRegisterSave(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("registerSave").length;
   * }
   * ```
   */
  public readonly registerSave: IWindowPartContext["registerSave"];

  /**
   * Stands in for {@link IWindowPartContext.registerSelectionSource}. Records
   * each registration, which {@link Fake.activeCallsOf} lists until the
   * disposer it returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeRegisterSelectionSource(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("registerSelectionSource").length;
   * }
   * ```
   */
  public readonly registerSelectionSource: IWindowPartContext["registerSelectionSource"];

  /**
   * Stands in for {@link IWindowPartContext.provideMenuGroup}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the disposer it
   * returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeProvideMenuGroup(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("provideMenuGroup").length;
   * }
   * ```
   */
  public readonly provideMenuGroup: IWindowPartContext["provideMenuGroup"];

  /**
   * Stands in for {@link IWindowPartContext.provideSettingOptions}. Records
   * each registration, which {@link Fake.activeCallsOf} lists until the
   * disposer it returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeProvideSettingOptions(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("provideSettingOptions").length;
   * }
   * ```
   */
  public readonly provideSettingOptions: IWindowPartContext["provideSettingOptions"];

  /**
   * Stands in for {@link IWindowPartContext.refreshSettingOptions}. Records
   * each call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardRefreshSettingOptions(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("refreshSettingOptions", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly refreshSettingOptions: IWindowPartContext["refreshSettingOptions"];

  /**
   * Stands in for {@link IWindowPartContext.provideSettingCheck}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the disposer it
   * returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeProvideSettingCheck(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("provideSettingCheck").length;
   * }
   * ```
   */
  public readonly provideSettingCheck: IWindowPartContext["provideSettingCheck"];

  /**
   * Stands in for {@link IWindowPartContext.setViewBadge}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardSetViewBadge(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("setViewBadge", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly setViewBadge: IWindowPartContext["setViewBadge"];

  /**
   * Stands in for {@link IWindowPartContext.markWorking}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the disposer it
   * returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeMarkWorking(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("markWorking").length;
   * }
   * ```
   */
  public readonly markWorking: IWindowPartContext["markWorking"];

  /**
   * Stands in for {@link IWindowPartContext.markWaiting}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the disposer it
   * returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeMarkWaiting(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("markWaiting").length;
   * }
   * ```
   */
  public readonly markWaiting: IWindowPartContext["markWaiting"];

  /**
   * Stands in for {@link IWindowPartContext.isAllowed}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerIsAllowed(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["isAllowed"]>): void {
   *   fake.answer("isAllowed", () => value);
   * }
   * ```
   */
  public readonly isAllowed: IWindowPartContext["isAllowed"];

  /**
   * Stands in for {@link IWindowPartContext.runCommandAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerRunCommandAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["runCommandAsync"]>>): void {
   *   fake.answer("runCommandAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly runCommandAsync: IWindowPartContext["runCommandAsync"];

  /**
   * Stands in for {@link IWindowPartContext.findWindowCommand}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerFindWindowCommand(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["findWindowCommand"]>): void {
   *   fake.answer("findWindowCommand", () => value);
   * }
   * ```
   */
  public readonly findWindowCommand: IWindowPartContext["findWindowCommand"];

  /**
   * Stands in for {@link IWindowPartContext.keyOf}. Records each call, which
   * {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerKeyOf(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["keyOf"]>): void {
   *   fake.answer("keyOf", () => value);
   * }
   * ```
   */
  public readonly keyOf: IWindowPartContext["keyOf"];

  /**
   * Stands in for {@link IWindowPartContext.postNotificationAsync}. Records
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerPostNotificationAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["postNotificationAsync"]>>): void {
   *   fake.answer("postNotificationAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly postNotificationAsync: IWindowPartContext["postNotificationAsync"];

  /**
   * Stands in for {@link IWindowPartContext.openDocument}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardOpenDocument(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("openDocument", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly openDocument: IWindowPartContext["openDocument"];

  /**
   * Stands in for {@link IWindowPartContext.keepDocument}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardKeepDocument(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("keepDocument", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly keepDocument: IWindowPartContext["keepDocument"];

  /**
   * Stands in for {@link IWindowPartContext.closeDocument}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardCloseDocument(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("closeDocument", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly closeDocument: IWindowPartContext["closeDocument"];

  /**
   * Stands in for {@link IWindowPartContext.forgetDocument}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardForgetDocument(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("forgetDocument", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly forgetDocument: IWindowPartContext["forgetDocument"];

  /**
   * Stands in for {@link IWindowPartContext.updateDocument}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardUpdateDocument(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("updateDocument", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly updateDocument: IWindowPartContext["updateDocument"];

  /**
   * Stands in for {@link IWindowPartContext.onDocumentClosed}. Records each
   * listener, which {@link FakeWindowPartContext.raiseDocumentClosed} calls and
   * {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeOnDocumentClosed(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("onDocumentClosed").length;
   * }
   * ```
   */
  public readonly onDocumentClosed: IWindowPartContext["onDocumentClosed"];

  /**
   * Stands in for {@link IWindowPartContext.onTabRenamed}. Records each
   * listener, which {@link FakeWindowPartContext.raiseTabRenamed} calls and
   * {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeOnTabRenamed(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("onTabRenamed").length;
   * }
   * ```
   */
  public readonly onTabRenamed: IWindowPartContext["onTabRenamed"];

  /**
   * Stands in for {@link IWindowPartContext.listOpenDocumentsAsync}. Records
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerListOpenDocumentsAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["listOpenDocumentsAsync"]>>): void {
   *   fake.answer("listOpenDocumentsAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly listOpenDocumentsAsync: IWindowPartContext["listOpenDocumentsAsync"];

  /**
   * Stands in for {@link IWindowPartContext.openView}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardOpenView(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("openView", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly openView: IWindowPartContext["openView"];

  /**
   * Stands in for {@link IWindowPartContext.updateView}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardUpdateView(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("updateView", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly updateView: IWindowPartContext["updateView"];

  /**
   * Stands in for {@link IWindowPartContext.closeView}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardCloseView(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("closeView", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly closeView: IWindowPartContext["closeView"];

  /**
   * Stands in for {@link IWindowPartContext.showView}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardShowView(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("showView", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly showView: IWindowPartContext["showView"];

  /**
   * Stands in for {@link IWindowPartContext.hideViewDock}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardHideViewDock(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("hideViewDock", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly hideViewDock: IWindowPartContext["hideViewDock"];

  /**
   * Stands in for {@link IWindowPartContext.growViewDock}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the disposer it
   * returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeGrowViewDock(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("growViewDock").length;
   * }
   * ```
   */
  public readonly growViewDock: IWindowPartContext["growViewDock"];

  /**
   * Stands in for {@link IWindowPartContext.onViewClosed}. Records each
   * listener, which {@link FakeWindowPartContext.raiseViewClosed} calls and
   * {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeOnViewClosed(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("onViewClosed").length;
   * }
   * ```
   */
  public readonly onViewClosed: IWindowPartContext["onViewClosed"];

  /**
   * Stands in for {@link IWindowPartContext.showInDialogAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerShowInDialogAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["showInDialogAsync"]>>): void {
   *   fake.answer("showInDialogAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly showInDialogAsync: IWindowPartContext["showInDialogAsync"];

  /**
   * Stands in for {@link IWindowPartContext.log}. Records each call, which
   * {@link Fake.callsOf} reads, and calls the answer that {@link Fake.answer}
   * gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardLog(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("log", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly log: IWindowPartContext["log"];

  /**
   * Stands in for {@link IWindowPartContext.openLinkAsync}. Records each call,
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerOpenLinkAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["openLinkAsync"]>>): void {
   *   fake.answer("openLinkAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly openLinkAsync: IWindowPartContext["openLinkAsync"];

  /**
   * Stands in for {@link IWindowPartContext.showLinkMenu}. Records each call,
   * which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardShowLinkMenu(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("showLinkMenu", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly showLinkMenu: IWindowPartContext["showLinkMenu"];

  /**
   * Stands in for {@link IWindowPartContext.registerInAppBrowser}. Records each
   * registration, which {@link Fake.activeCallsOf} lists until the disposer it
   * returns runs; it takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeRegisterInAppBrowser(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("registerInAppBrowser").length;
   * }
   * ```
   */
  public readonly registerInAppBrowser: IWindowPartContext["registerInAppBrowser"];

  /**
   * Stands in for {@link IWindowPartContext.showInFolderAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerShowInFolderAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["showInFolderAsync"]>>): void {
   *   fake.answer("showInFolderAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly showInFolderAsync: IWindowPartContext["showInFolderAsync"];

  /**
   * Stands in for {@link IWindowPartContext.openFileAsync}. Records each call,
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerOpenFileAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["openFileAsync"]>>): void {
   *   fake.answer("openFileAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly openFileAsync: IWindowPartContext["openFileAsync"];

  /**
   * Stands in for {@link IWindowPartContext.chooseFolderAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerChooseFolderAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["chooseFolderAsync"]>>): void {
   *   fake.answer("chooseFolderAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly chooseFolderAsync: IWindowPartContext["chooseFolderAsync"];

  /**
   * Stands in for {@link IWindowPartContext.chooseFilePathAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerChooseFilePathAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["chooseFilePathAsync"]>>): void {
   *   fake.answer("chooseFilePathAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly chooseFilePathAsync: IWindowPartContext["chooseFilePathAsync"];

  /**
   * Stands in for {@link IWindowPartContext.saveFileAsync}. Records each call,
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerSaveFileAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["saveFileAsync"]>>): void {
   *   fake.answer("saveFileAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly saveFileAsync: IWindowPartContext["saveFileAsync"];

  /**
   * Stands in for {@link IWindowPartContext.chooseFilesAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerChooseFilesAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["chooseFilesAsync"]>>): void {
   *   fake.answer("chooseFilesAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly chooseFilesAsync: IWindowPartContext["chooseFilesAsync"];

  /**
   * Stands in for {@link IWindowPartContext.grantFilesAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerGrantFilesAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["grantFilesAsync"]>>): void {
   *   fake.answer("grantFilesAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly grantFilesAsync: IWindowPartContext["grantFilesAsync"];

  /**
   * Stands in for {@link IWindowPartContext.discardFileGrants}. Records each
   * call, which {@link Fake.callsOf} reads, and calls the answer that
   * {@link Fake.answer} gives; while unanswered, it only records the call.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function heardDiscardFileGrants(fake: FakeWindowPartContext): readonly unknown[][] {
   *   const heard: unknown[][] = [];
   *   fake.answer("discardFileGrants", (...args) => {
   *     heard.push(args);
   *   });
   *   return heard;
   * }
   * ```
   */
  public readonly discardFileGrants: IWindowPartContext["discardFileGrants"];

  /**
   * Stands in for {@link IWindowPartContext.fileAddressOf}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerFileAddressOf(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["fileAddressOf"]>): void {
   *   fake.answer("fileAddressOf", () => value);
   * }
   * ```
   */
  public readonly fileAddressOf: IWindowPartContext["fileAddressOf"];

  /**
   * Stands in for {@link IWindowPartContext.requestAsync}. Records each call,
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerRequestAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["requestAsync"]>>): void {
   *   fake.answer("requestAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly requestAsync: IWindowPartContext["requestAsync"];

  /**
   * Stands in for {@link IWindowPartContext.onEvent}. Records each listener,
   * which {@link FakeWindowPartContext.raiseEvent} calls and
   * {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeOnEvent(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("onEvent").length;
   * }
   * ```
   */
  public readonly onEvent: IWindowPartContext["onEvent"];

  /**
   * Stands in for {@link IWindowPartContext.readSetting}. Records each call,
   * which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerReadSetting(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["readSetting"]>): void {
   *   fake.answer("readSetting", () => value);
   * }
   * ```
   */
  public readonly readSetting: IWindowPartContext["readSetting"];

  /**
   * Stands in for {@link IWindowPartContext.readSettingAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerReadSettingAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["readSettingAsync"]>>): void {
   *   fake.answer("readSettingAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly readSettingAsync: IWindowPartContext["readSettingAsync"];

  /**
   * Stands in for {@link IWindowPartContext.writeSettingAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerWriteSettingAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["writeSettingAsync"]>>): void {
   *   fake.answer("writeSettingAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly writeSettingAsync: IWindowPartContext["writeSettingAsync"];

  /**
   * Stands in for {@link IWindowPartContext.resetSettingAsync}. Records each
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
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerResetSettingAsync(fake: FakeWindowPartContext, value: Awaited<ReturnType<IWindowPartContext["resetSettingAsync"]>>): void {
   *   fake.answer("resetSettingAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly resetSettingAsync: IWindowPartContext["resetSettingAsync"];

  /**
   * Stands in for {@link IWindowPartContext.onSettingChanged}. Records each
   * listener, which {@link FakeWindowPartContext.raiseSettingChanged} calls and
   * {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeOnSettingChanged(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("onSettingChanged").length;
   * }
   * ```
   */
  public readonly onSettingChanged: IWindowPartContext["onSettingChanged"];

  /**
   * Stands in for {@link IWindowPartContext.isDependencyActive}. Records each
   * call, which {@link Fake.callsOf} reads, and returns what the answer that
   * {@link Fake.answer} gives returns.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerIsDependencyActive(fake: FakeWindowPartContext, value: ReturnType<IWindowPartContext["isDependencyActive"]>): void {
   *   fake.answer("isDependencyActive", () => value);
   * }
   * ```
   */
  public readonly isDependencyActive: IWindowPartContext["isDependencyActive"];

  /**
   * Stands in for {@link IWindowPartContext.onDependencyChanged}. Records each
   * listener, which {@link FakeWindowPartContext.raiseDependencyChanged} calls
   * and {@link Fake.activeCallsOf} lists until the disposer it returns runs; it
   * takes no answer.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function activeOnDependencyChanged(fake: FakeWindowPartContext): number {
   *   return fake.activeCallsOf("onDependencyChanged").length;
   * }
   * ```
   */
  public readonly onDependencyChanged: IWindowPartContext["onDependencyChanged"];

  /**
   * Stands in for {@link IWindowPartContext.agentControl}. Reads the value that
   * {@link Fake.answer} gives.
   *
   * @throws {UnansweredCallException} Synchronously, naming the member, while
   * the test has given it no answer.
   *
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerAgentControl(fake: FakeWindowPartContext, value: IWindowPartContext["agentControl"]): void {
   *   fake.answer("agentControl", value);
   * }
   * ```
   */
  public get agentControl(): Signal<AgentControlState | null>;

  /**
   * Stands in for {@link IWindowPartContext.openBelowWindowRowAsync}. Records
   * each call, which {@link Fake.callsOf} reads, and returns what the answer
   * that {@link Fake.answer} gives returns; while unanswered, the promise it
   * returns rejects rather than the call throwing.
   *
   * @typeParam T The palette component's type.
   *
   * @param load Loads the palette component's type.
   *
   * @returns What the answer returns.
   *
   * @throws {UnansweredCallException} As the rejection of the promise it
   * returns, naming the member, while the test has given it no answer, as the
   * real member fails.
   *
   * @example
   * ```ts
   * import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function answerOpenBelowWindowRowAsync(fake: FakeWindowPartContext): void {
   *   fake.answer("openBelowWindowRowAsync", () => Promise.resolve(null));
   * }
   * ```
   */
  public openBelowWindowRowAsync<T>(load: () => Promise<Type<T>>): Promise<IWindowPalette<T> | null>;

  /**
   * Tells each listener of {@link IWindowPartContext.onDocumentClosed} for the
   * document that one of its instances closed.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops no other: {@link Fake.errors} keeps what
   * it threw, where Noldova Desktop reports it in a place a test can't read.
   *
   * @param name The document's name.
   *
   * @param instance The instance that closed.
   *
   * @example
   * ```ts
   * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function closeNote(context: FakeWindowPartContext): void {
   *   context.raiseDocumentClosed("notes.note", "note-1");
   * }
   * ```
   */
  public raiseDocumentClosed(name: string, instance: string): void;

  /**
   * Tells each listener of {@link IWindowPartContext.onTabRenamed} for the
   * document or view that the person renamed the tab of one of its instances.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops no other: {@link Fake.errors} keeps what
   * it threw, where Noldova Desktop reports it in a place a test can't read.
   *
   * @param name The document's or view's name.
   *
   * @param instance The instance whose tab was renamed.
   *
   * @param title The new title.
   *
   * @example
   * ```ts
   * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function renameSession(context: FakeWindowPartContext): void {
   *   context.raiseTabRenamed("terminal.session", "session-1", "Build");
   * }
   * ```
   */
  public raiseTabRenamed(name: string, instance: string, title: string): void;

  /**
   * Tells each listener of {@link IWindowPartContext.onViewClosed} for the view
   * that one of its instances closed.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops no other: {@link Fake.errors} keeps what
   * it threw, where Noldova Desktop reports it in a place a test can't read.
   *
   * @param name The view's name.
   *
   * @param instance The instance that closed.
   *
   * @example
   * ```ts
   * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function closeSession(context: FakeWindowPartContext): void {
   *   context.raiseViewClosed("terminal.session", "session-1");
   * }
   * ```
   */
  public raiseViewClosed(name: string, instance: string): void;

  /**
   * Tells each listener of {@link IWindowPartContext.onEvent} for the event
   * that the module's runtime part posted it.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops the rest, and its error comes out of this
   * call.
   *
   * @param name The event's name.
   *
   * @param payload What the event carries.
   *
   * @example
   * ```ts
   * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function postChanged(context: FakeWindowPartContext): void {
   *   context.raiseEvent("git.changed", { folder: "/work" });
   * }
   * ```
   */
  public raiseEvent(name: string, payload: JsonValue): void;

  /**
   * Tells each listener of {@link IWindowPartContext.onSettingChanged} for the
   * setting that its value changed.
   *
   * As Noldova Desktop's own dispatch does, it calls each listener in place when
   * the call starts: one that an earlier one removes during the call is still
   * called, and one that throws stops the rest, and its error comes out of this
   * call.
   *
   * @param name The setting's name.
   *
   * @param value The setting's value now.
   *
   * @param scope The scope whose value changed, or null for the person's own.
   *
   * @param isSet Whether the scope sets the value itself, rather than taking
   * its parent's.
   *
   * @example
   * ```ts
   * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function chooseDark(context: FakeWindowPartContext): void {
   *   context.raiseSettingChanged("terminal.theme", "dark", null, true);
   * }
   * ```
   */
  public raiseSettingChanged(name: string, value: JsonValue, scope: SettingScope | null, isSet: boolean): void;

  /**
   * Tells each listener of {@link IWindowPartContext.onDependencyChanged} that
   * an optional dependency became active or stopped.
   *
   * As Noldova Desktop's own dispatch does, it skips a listener that an earlier
   * one removes during the call, and one that throws stops no other:
   * {@link Fake.errors} keeps what it threw, where Noldova Desktop reports it in a
   * place a test can't read.
   *
   * @param moduleId The dependency's id.
   *
   * @param isActive Whether it is active now.
   *
   * @example
   * ```ts
   * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function stopGit(context: FakeWindowPartContext): void {
   *   context.raiseDependencyChanged("git", false);
   * }
   * ```
   */
  public raiseDependencyChanged(moduleId: string, isActive: boolean): void;

  /**
   * The fakes it holds, its web views and secrets, which {@link Fake.beStrict} makes strict
   * with it.
   *
   * @returns The fakes it holds.
   *
   * @example
   * ```ts
   * import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
   *
   * export function strict(): FakeWindowPartContext {
   *   const fake = new FakeWindowPartContext();
   *   fake.beStrict();
   *   return fake;
   * }
   * ```
   */
  protected override parts(): readonly Pick<Fake<object>, "beStrict">[];
}

/**
 * A fake of {@link IWindowPartContext.webViews}, the window part's web views.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import type { IWebViewHandle } from "@noldova/desktop.window";
 * import { FakeWindowWebViews } from "@noldova/desktop.window/testing";
 *
 * export function openOne(webViews: FakeWindowWebViews, handle: IWebViewHandle): void {
 *   webViews.answer("openAsync", () => Promise.resolve(handle));
 * }
 * ```
 *
 * @example
 * ```ts
 * import type { WebViewPane } from "@noldova/desktop.protocol";
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeWindowWebViews } from "@noldova/desktop.window/testing";
 *
 * export async function isUnansweredAsync(pane: WebViewPane): Promise<boolean> {
 *   const fake = new FakeWindowWebViews();
 *   try {
 *     await fake.openAsync(pane, "notes");
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeWindowWebViews extends Fake<IWindowWebViews> implements IWindowWebViews {
  /**
   * Stands in for {@link IWindowWebViews.openAsync}. Records each call, which
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
   * import type { IWindowWebViews } from "@noldova/desktop.window";
   * import type { FakeWindowWebViews } from "@noldova/desktop.window/testing";
   *
   * export function answerOpenAsync(fake: FakeWindowWebViews, value: Awaited<ReturnType<IWindowWebViews["openAsync"]>>): void {
   *   fake.answer("openAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly openAsync: IWindowWebViews["openAsync"];
}

/**
 * A fake of {@link IWindowPartContext.secrets}, the module's secrets as its
 * window part sees them.
 *
 * A member that returns a value, or a property, throws
 * {@link UnansweredCallException}, naming it, until the test answers it, so
 * that no test passes on a value the fake made up.
 *
 * @example
 * ```ts
 * import { FakeWindowSecrets } from "@noldova/desktop.window/testing";
 *
 * export function withNone(): FakeWindowSecrets {
 *   const secrets = new FakeWindowSecrets();
 *   secrets.answer("isSetAsync", () => Promise.resolve(false));
 *   return secrets;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
 * import { FakeWindowSecrets } from "@noldova/desktop.window/testing";
 *
 * export async function isUnansweredAsync(): Promise<boolean> {
 *   const fake = new FakeWindowSecrets();
 *   try {
 *     await fake.isSetAsync("notes.token");
 *   } catch (error) {
 *     return error instanceof UnansweredCallException;
 *   }
 *   return false;
 * }
 * ```
 */
export declare class FakeWindowSecrets extends Fake<IWindowSecrets> implements IWindowSecrets {
  /**
   * Stands in for {@link IWindowSecrets.saveAsync}. Records each call, which
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
   * import type { IWindowSecrets } from "@noldova/desktop.window";
   * import type { FakeWindowSecrets } from "@noldova/desktop.window/testing";
   *
   * export function answerSaveAsync(fake: FakeWindowSecrets, value: Awaited<ReturnType<IWindowSecrets["saveAsync"]>>): void {
   *   fake.answer("saveAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly saveAsync: IWindowSecrets["saveAsync"];

  /**
   * Stands in for {@link IWindowSecrets.removeAsync}. Records each call, which
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
   * import type { IWindowSecrets } from "@noldova/desktop.window";
   * import type { FakeWindowSecrets } from "@noldova/desktop.window/testing";
   *
   * export function answerRemoveAsync(fake: FakeWindowSecrets, value: Awaited<ReturnType<IWindowSecrets["removeAsync"]>>): void {
   *   fake.answer("removeAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly removeAsync: IWindowSecrets["removeAsync"];

  /**
   * Stands in for {@link IWindowSecrets.isSetAsync}. Records each call, which
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
   * import type { IWindowSecrets } from "@noldova/desktop.window";
   * import type { FakeWindowSecrets } from "@noldova/desktop.window/testing";
   *
   * export function answerIsSetAsync(fake: FakeWindowSecrets, value: Awaited<ReturnType<IWindowSecrets["isSetAsync"]>>): void {
   *   fake.answer("isSetAsync", () => Promise.resolve(value));
   * }
   * ```
   */
  public readonly isSetAsync: IWindowSecrets["isSetAsync"];
}
