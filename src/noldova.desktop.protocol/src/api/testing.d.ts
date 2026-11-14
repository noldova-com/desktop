/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DesktopProtocolException, FailureCode } from "@noldova/desktop.protocol";

/**
 * The exception a fake throws when the code under test calls a member that
 * returns a value, or reads a property, that the test gave no answer for, so
 * that no test passes on an answer the fake made up. It extends the
 * package's base, {@link DesktopProtocolException}, rather than its `ProtocolException`, whose
 * {@link FailureCode} names a failure the local protocol carries between
 * processes: a missing answer is a test's own mistake, which never crosses
 * the protocol, so it has no code.
 */
export declare class UnansweredCallException extends DesktopProtocolException {
  /**
   * The member that had no answer.
   */
  public readonly member: string;

  /**
   * Creates the exception.
   *
   * @param member The member that had no answer.
   *
   * @example
   * ```ts
   * import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
   *
   * export const failure: UnansweredCallException = new UnansweredCallException("readSetting");
   * ```
   */
  public constructor(member: string);
}

/**
 * One call the code under test made to a fake: the member it called and the
 * arguments it passed, as it passed them.
 *
 * @typeParam T The interface the fake stands in for.
 */
export declare class FakeCall<T extends object> {
  /**
   * The member that was called.
   */
  public readonly member: keyof T & string;

  /**
   * The arguments, in order, without the ones the caller left out.
   */
  public readonly args: readonly unknown[];

  /**
   * Creates the record of a call.
   *
   * @param member The member that was called.
   * @param args The arguments it was called with.
   *
   * @example
   * ```ts
   * import { FakeCall } from "@noldova/desktop.protocol/testing";
   *
   * interface ILog {
   *   write(message: string): void;
   * }
   *
   * export const call: FakeCall<ILog> = new FakeCall<ILog>("write", ["Started."]);
   * ```
   */
  public constructor(member: keyof T & string, args: readonly unknown[]);
}

/**
 * The base of Noldova Desktop's fakes of the interfaces it hands a module: each
 * fake records every call the code under test makes, in order, and a test
 * gives the answer of each member that returns a value with
 * {@link Fake.answer}. A member that returns a value and has no answer throws
 * {@link UnansweredCallException}; a member that returns nothing records the
 * call and calls its answer, if any; a registration or a listener records the
 * call and returns a disposer that ends it. A test that calls
 * {@link Fake.beStrict} makes an unanswered member that returns nothing, a
 * registration or a listener throw too, unless it named the member with
 * {@link Fake.allow}.
 *
 * @typeParam T The interface the fake stands in for.
 */
export declare abstract class Fake<T extends object> {
  /**
   * The answers the test gave, by member.
   */
  protected readonly answers: { -readonly [K in keyof T]?: T[K] };

  /**
   * Every call the code under test made, in order.
   */
  public get calls(): readonly FakeCall<T>[];

  /**
   * What the fake's listeners threw or rejected with while a raiser that
   * catches them called them, in order, where the real part reports such an
   * error in a place a module's test can't read.
   */
  public get errors(): readonly unknown[];

  /**
   * Lists the arguments of each call to one member.
   *
   * @param member The member.
   * @returns The arguments of each call to it, in the order of the calls; empty
   * when it wasn't called.
   *
   * @example
   * ```ts
   * import type { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ILog {
   *   write(message: string): void;
   * }
   *
   * export function written(log: Fake<ILog>): readonly string[] {
   *   return log.callsOf("write").map(t => String(t[0]));
   * }
   * ```
   */
  public callsOf(member: keyof T & string): readonly (readonly unknown[])[];

  /**
   * Lists the arguments of each registration or listener of one member that is
   * still in place, its disposer not yet called.
   *
   * @param member The member.
   * @returns The arguments of each call to it whose disposer hasn't run, in the
   * order of the calls.
   *
   * @example
   * ```ts
   * import type { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IClock {
   *   onTick(listener: () => void): () => void;
   * }
   *
   * export function isListening(clock: Fake<IClock>): boolean {
   *   return clock.activeCallsOf("onTick").length > 0;
   * }
   * ```
   */
  public activeCallsOf(member: keyof T & string): readonly (readonly unknown[])[];

  /**
   * Gives a member's answer: the implementation the fake calls, after it
   * records the call, from then on, or a property's value.
   *
   * @param member The member.
   * @param implementation What the member does or holds, typed as the
   * interface declares it.
   *
   * @example
   * ```ts
   * import type { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ISettings {
   *   read(name: string): string;
   * }
   *
   * export function answerDark(settings: Fake<ISettings>): void {
   *   settings.answer("read", () => "dark");
   * }
   * ```
   */
  public answer<K extends keyof T>(member: K, implementation: T[K]): void;

  /**
   * Makes the fake strict, and each fake it holds, such as a context's
   * settings: from then on, a call to a member that returns nothing, a
   * registration or a listener that the test neither answered nor named with
   * {@link Fake.allow} records the call and then throws
   * {@link UnansweredCallException}, naming the member, as an unanswered
   * member that returns a value does. A fake is lenient until a test calls
   * this.
   *
   * @example
   * ```ts
   * import type { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ILog {
   *   write(message: string): void;
   * }
   *
   * export function strict(log: Fake<ILog>): void {
   *   log.beStrict();
   * }
   * ```
   */
  public beStrict(): void;

  /**
   * Lets a strict fake take calls to members that return nothing,
   * registrations and listeners that the test gives no answer, as a lenient
   * fake does: it records them and, for a listener, keeps it for the fake's
   * raisers. It changes nothing for a member that returns a value, or a
   * property, which throws {@link UnansweredCallException} until the test
   * answers it, strict or not.
   *
   * @param members The members the test lets the code under test call.
   *
   * @example
   * ```ts
   * import type { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IClock {
   *   onTick(listener: (count: number) => void): () => void;
   * }
   *
   * export function strictWithTicks(clock: Fake<IClock>): void {
   *   clock.beStrict();
   *   clock.allow("onTick");
   * }
   * ```
   */
  public allow(...members: (keyof T & string)[]): void;

  /**
   * Records a call to a member that returns a value and returns what its
   * answer returns.
   *
   * @param member The member.
   * @param args The arguments it was called with.
   * @param answer The member's answer, if the test gave one.
   * @returns What the answer returns.
   * @throws {UnansweredCallException} Synchronously, when the member has no
   * answer.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ISettings {
   *   read(name: string): string;
   * }
   *
   * export class FakeSettings extends Fake<ISettings> implements ISettings {
   *   public readonly read: ISettings["read"] = (...args) => this.ask("read", args, this.answers.read);
   * }
   * ```
   */
  protected ask<A extends unknown[], R>(member: keyof T & string, args: A, answer: ((...args: A) => R) | undefined): R;

  /**
   * Records a call to a member that returns a promise and returns what its
   * answer returns.
   *
   * @param member The member.
   * @param args The arguments it was called with.
   * @param answer The member's answer, if the test gave one.
   * @returns What the answer returns.
   * @throws {UnansweredCallException} By rejecting the promise it returns,
   * when the member has no answer, as the real member fails.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ISecrets {
   *   readAsync(name: string): Promise<string | null>;
   * }
   *
   * export class FakeSecrets extends Fake<ISecrets> implements ISecrets {
   *   public readonly readAsync: ISecrets["readAsync"] = (...args) => this.respondAsync("readAsync", args, this.answers.readAsync);
   * }
   * ```
   */
  protected respondAsync<A extends unknown[], R>(member: keyof T & string, args: A, answer: ((...args: A) => Promise<R>) | undefined): Promise<R>;

  /**
   * Records a call to a generic member that returns a value and returns its
   * answer, for the caller to call with its own type arguments.
   *
   * @param member The member.
   * @param args The arguments it was called with.
   * @param answer The member's answer, if the test gave one.
   * @returns The answer.
   * @throws {UnansweredCallException} Synchronously, when the member has no
   * answer.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IServices {
   *   find<T>(name: string): T | null;
   * }
   *
   * export class FakeServices extends Fake<IServices> implements IServices {
   *   public find<T>(name: string): T | null {
   *     return this.answerOf("find", [name], this.answers.find)<T>(name);
   *   }
   * }
   * ```
   */
  protected answerOf<F>(member: keyof T & string, args: readonly unknown[], answer: F | undefined): F;

  /**
   * Records a call to a generic member that returns a promise and returns what
   * the caller's call of its answer returns; an answer that throws rejects the
   * promise, as the real member would fail.
   *
   * @param member The member.
   * @param args The arguments it was called with.
   * @param answer The member's answer, if the test gave one.
   * @param call Calls the answer with the member's own type arguments.
   * @returns What the call returns.
   * @throws {UnansweredCallException} By rejecting the promise it returns,
   * when the member has no answer.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IServices {
   *   findAsync<T>(name: string): Promise<T | null>;
   * }
   *
   * export class FakeServices extends Fake<IServices> implements IServices {
   *   public findAsync<T>(name: string): Promise<T | null> {
   *     return this.answerOfAsync("findAsync", [name], this.answers.findAsync, t => t<T>(name));
   *   }
   * }
   * ```
   */
  protected answerOfAsync<F, R>(member: keyof T & string, args: readonly unknown[], answer: F | undefined, call: (answer: F) => Promise<R>): Promise<R>;

  /**
   * Records a call to a member that returns nothing and calls its answer, if
   * the test gave one.
   *
   * @param member The member.
   * @param args The arguments it was called with.
   * @param answer The member's answer, if the test gave one.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ILog {
   *   write(message: string): void;
   * }
   *
   * export class FakeLog extends Fake<ILog> implements ILog {
   *   public readonly write: ILog["write"] = (...args) => this.tell("write", args, this.answers.write);
   * }
   * ```
   */
  protected tell<A extends unknown[]>(member: keyof T & string, args: A, answer: ((...args: A) => void) | undefined): void;

  /**
   * Records a registration, which stays among {@link Fake.activeCallsOf} until
   * its disposer runs.
   *
   * @param member The member.
   * @param args The arguments it was called with.
   * @returns The disposer that ends the registration.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IMarks {
   *   mark(name: string): () => void;
   * }
   *
   * export class FakeMarks extends Fake<IMarks> implements IMarks {
   *   public readonly mark: IMarks["mark"] = (...args) => this.track("mark", args);
   * }
   * ```
   */
  protected track(member: keyof T & string, args: readonly unknown[]): () => void;

  /**
   * Records a listener's registration and keeps the listener in a set, for the
   * fake's raisers to call, until its disposer runs.
   *
   * @param member The member.
   * @param args The arguments it was called with.
   * @param listeners The set that holds the member's listeners.
   * @param listener What the set keeps.
   * @returns The disposer that ends the registration and drops the listener.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IClock {
   *   onTick(listener: () => void): () => void;
   * }
   *
   * export class FakeClock extends Fake<IClock> implements IClock {
   *   private readonly ticks: Set<() => void> = new Set<() => void>();
   *
   *   public readonly onTick: IClock["onTick"] = listener => this.listen("onTick", [listener], this.ticks, listener);
   * }
   * ```
   */
  protected listen<L>(member: keyof T & string, args: readonly unknown[], listeners: Set<L>, listener: L): () => void;

  /**
   * Reads a property's answer.
   *
   * @param member The property.
   * @param answer The property's answer, if the test gave one.
   * @returns The answer.
   * @throws {UnansweredCallException} When the property has no answer.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IModule {
   *   readonly id: string;
   * }
   *
   * export class FakeModule extends Fake<IModule> implements IModule {
   *   public get id(): string {
   *     return this.propertyOf("id", this.answers.id);
   *   }
   * }
   * ```
   */
  protected propertyOf<V>(member: keyof T & string, answer: V | undefined): V;

  /**
   * Calls each listener a set holds when the call starts, in the order they
   * were added, for a real dispatch that loops over a copy of its listeners:
   * a listener added during the call waits for the next, one an earlier one
   * removes is still called, and one that throws stops the rest and throws to
   * the raiser's caller.
   *
   * @param listeners The set that {@link Fake.listen} added the listeners to;
   * it is read when the call starts.
   * @param call Gets each listener in turn and calls it with the raised
   * values.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IClock {
   *   onTick(listener: () => void): () => void;
   * }
   *
   * export class FakeClock extends Fake<IClock> implements IClock {
   *   private readonly ticks: Set<() => void> = new Set<() => void>();
   *
   *   public readonly onTick: IClock["onTick"] = listener => this.listen("onTick", [listener], this.ticks, listener);
   *
   *   public raiseTick(): void {
   *     this.raise(this.ticks, t => t());
   *   }
   * }
   * ```
   */
  protected raise<L>(listeners: ReadonlySet<L>, call: (listener: L) => void): void;

  /**
   * The fakes this fake holds, which {@link Fake.beStrict} makes strict with
   * it; none, unless a fake that holds others overrides it.
   *
   * @returns The fakes it holds.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ILog {
   *   write(message: string): void;
   * }
   *
   * interface IHost {
   *   readonly log: ILog;
   * }
   *
   * class FakeLog extends Fake<ILog> implements ILog {
   *   public readonly write: ILog["write"] = (...args) => this.tell("write", args, this.answers.write);
   * }
   *
   * export class FakeHost extends Fake<IHost> implements IHost {
   *   public readonly log: FakeLog = new FakeLog();
   *
   *   protected override parts(): readonly Pick<Fake<object>, "beStrict">[] {
   *     return [this.log];
   *   }
   * }
   * ```
   */
  protected parts(): readonly Pick<Fake<object>, "beStrict">[];

  /**
   * Calls each listener a set holds when the call starts, as
   * {@link Fake.raise} does, but reports a throw and goes on to the next
   * listener, for a real dispatch that catches each listener's error.
   *
   * @param listeners The set that {@link Fake.listen} added the listeners to;
   * it is read when the call starts.
   * @param call Gets each listener in turn and calls it with the raised
   * values.
   * @param report What to do with an error a listener throws; by default, keep
   * it in {@link Fake.errors}.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface ITabs {
   *   onClosed(listener: () => void): () => void;
   * }
   *
   * export class FakeTabs extends Fake<ITabs> implements ITabs {
   *   private readonly closed: Set<() => void> = new Set<() => void>();
   *
   *   public readonly onClosed: ITabs["onClosed"] = listener => this.listen("onClosed", [listener], this.closed, listener);
   *
   *   public raiseClosed(): void {
   *     this.raiseIsolated(this.closed, t => t());
   *   }
   * }
   * ```
   */
  protected raiseIsolated<L>(listeners: ReadonlySet<L>, call: (listener: L) => void, report?: (error: unknown) => void): void;

  /**
   * Calls each listener a set holds as {@link Fake.raiseIsolated} does, but
   * skips one that an earlier one removes during the call, for a real dispatch
   * that checks each listener is still in place.
   *
   * @param listeners The set that {@link Fake.listen} added the listeners to;
   * it is read when the call starts, and checked again before each listener.
   * @param call Gets each listener in turn and calls it with the raised
   * values.
   * @param report What to do with an error a listener throws; by default, keep
   * it in {@link Fake.errors}.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IModules {
   *   onChanged(listener: () => void): () => void;
   * }
   *
   * export class FakeModules extends Fake<IModules> implements IModules {
   *   private readonly changed: Set<() => void> = new Set<() => void>();
   *
   *   public readonly onChanged: IModules["onChanged"] = listener => this.listen("onChanged", [listener], this.changed, listener);
   *
   *   public raiseChanged(): void {
   *     this.raiseLive(this.changed, t => t());
   *   }
   * }
   * ```
   */
  protected raiseLive<L>(listeners: ReadonlySet<L>, call: (listener: L) => void, report?: (error: unknown) => void): void;

  /**
   * Calls each listener a set holds as {@link Fake.raiseLive} does, and waits
   * for what each returns; a listener that throws or rejects is reported and
   * stops no other.
   *
   * @param listeners The set that {@link Fake.listen} added the listeners to;
   * it is read when the call starts, and checked again before each listener.
   * @param call Gets each listener in turn and calls it with the raised
   * values.
   * @param report What to do with an error a listener throws or rejects with;
   * by default, keep it in {@link Fake.errors}.
   * @returns A promise that settles once every listener's work has.
   *
   * @example
   * ```ts
   * import { Fake } from "@noldova/desktop.protocol/testing";
   *
   * interface IClients {
   *   onClosed(listener: () => Promise<void>): () => void;
   * }
   *
   * export class FakeClients extends Fake<IClients> implements IClients {
   *   private readonly closed: Set<() => Promise<void>> = new Set<() => Promise<void>>();
   *
   *   public readonly onClosed: IClients["onClosed"] = listener => this.listen("onClosed", [listener], this.closed, listener);
   *
   *   public raiseClosedAsync(): Promise<void> {
   *     return this.raiseLiveAsync(this.closed, t => t());
   *   }
   * }
   * ```
   */
  protected raiseLiveAsync<L>(listeners: ReadonlySet<L>, call: (listener: L) => void | Promise<void>, report?: (error: unknown) => void): Promise<void>;
}
