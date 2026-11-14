/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Fake, UnansweredCallException } from "@noldova/desktop.protocol/testing";

interface IClock {
  readonly id: string;
  read(name: string): string;
  find<T>(name: string): T | null;
  loadAsync(name: string): Promise<string>;
  findAsync<T>(name: string): Promise<T | null>;
  write(message: string): void;
  mark(name: string): () => void;
  onTick(listener: (count: number) => void): () => void;
  onStop(listener: () => Promise<void>): () => void;
}

class FakeClock extends Fake<IClock> implements IClock {
  public readonly reported: unknown[] = [];
  private readonly ticks: Set<(count: number) => void> = new Set<(count: number) => void>();
  private readonly stops: Set<() => Promise<void>> = new Set<() => Promise<void>>();

  public readonly read: IClock["read"] = (...args) => this.ask("read", args, this.answers.read);
  public readonly loadAsync: IClock["loadAsync"] = (...args) => this.respondAsync("loadAsync", args, this.answers.loadAsync);
  public readonly write: IClock["write"] = (...args) => this.tell("write", args, this.answers.write);
  public readonly mark: IClock["mark"] = (...args) => this.track("mark", args);
  public readonly onTick: IClock["onTick"] = listener => this.listen("onTick", [listener], this.ticks, listener);
  public readonly onStop: IClock["onStop"] = listener => this.listen("onStop", [listener], this.stops, listener);

  public get id(): string {
    return this.propertyOf("id", this.answers.id);
  }

  public find<T>(name: string): T | null {
    return this.answerOf("find", [name], this.answers.find)<T>(name);
  }

  public findAsync<T>(name: string): Promise<T | null> {
    return this.answerOfAsync("findAsync", [name], this.answers.findAsync, t => t<T>(name));
  }

  public raiseTick(count: number): void {
    this.raise(this.ticks, t => t(count));
  }

  public raiseTickIsolated(count: number): void {
    this.raiseIsolated(this.ticks, t => t(count));
  }

  public raiseTickIsolatedReported(count: number): void {
    this.raiseIsolated(this.ticks, t => t(count), t => this.reported.push(t));
  }

  public raiseTickLive(count: number): void {
    this.raiseLive(this.ticks, t => t(count));
  }

  public raiseTickLiveReported(count: number): void {
    this.raiseLive(this.ticks, t => t(count), t => this.reported.push(t));
  }

  public raiseStopAsync(): Promise<void> {
    return this.raiseLiveAsync(this.stops, t => t());
  }

  public raiseStopReportedAsync(): Promise<void> {
    return this.raiseLiveAsync(this.stops, t => t(), t => this.reported.push(t));
  }
}

interface IDesk {
  readonly clock: IClock;
  close(): void;
}

class FakeDesk extends Fake<IDesk> implements IDesk {
  public readonly clock: FakeClock = new FakeClock();
  public readonly close: IDesk["close"] = (...args) => this.tell("close", args, this.answers.close);

  protected override parts(): readonly Pick<Fake<object>, "beStrict">[] {
    return [this.clock];
  }
}

@TestClass
export class FakeTests {
  private static readonly FAILURE: Error = new Error("The listener failed.");

  @TestMethod
  public recordsEachCallInOrderWithTheArgumentsPassed(): void {
    const clock = new FakeClock();
    clock.answer("read", t => `${t} read`);

    clock.write("Started.");
    clock.read("zone");
    clock.write("Stopped.");

    Assert.areEqual("write Started.|read zone|write Stopped.", clock.calls.map(t => [t.member, ...t.args].join(" ")).join("|"));
    Assert.areEqual("Started.|Stopped.", clock.callsOf("write").map(t => t.join(" ")).join("|"));
    Assert.areEqual(0, clock.callsOf("mark").length);
  }

  @TestMethod
  public throwsNamingAMemberThatReturnsAValueUntilTheTestAnswersIt(): void {
    const clock = new FakeClock();

    const unanswered = [
      Assert.throws(() => clock.read("zone"), UnansweredCallException).member,
      Assert.throws(() => clock.find("zone"), UnansweredCallException).member,
      Assert.throws(() => clock.id, UnansweredCallException).member
    ];
    clock.answer("read", t => `${t} read`);
    clock.answer("find", () => null);
    clock.answer("id", "clock");

    Assert.areEqual("read|find|id", unanswered.join("|"));
    Assert.areEqual("zone read", clock.read("zone"));
    Assert.isNull(clock.find<string>("zone"));
    Assert.areEqual("clock", clock.id);
    Assert.areEqual("read|find|read|find", clock.calls.map(t => t.member).join("|"));
  }

  @TestMethod
  public async rejectsNamingAMemberThatReturnsAPromiseUntilTheTestAnswersIt(): Promise<void> {
    const clock = new FakeClock();

    const loading = clock.loadAsync("zone");
    const finding = clock.findAsync<string>("zone");
    const unanswered = [
      (await Assert.throwsAsync(() => loading, UnansweredCallException)).member,
      (await Assert.throwsAsync(() => finding, UnansweredCallException)).member
    ];
    clock.answer("loadAsync", t => Promise.resolve(`${t} loaded`));
    clock.answer("findAsync", () => Promise.resolve(null));

    Assert.areEqual("loadAsync|findAsync", unanswered.join("|"));
    Assert.areEqual("zone loaded", await clock.loadAsync("zone"));
    Assert.isNull(await clock.findAsync<string>("zone"));
    Assert.areEqual("loadAsync|findAsync|loadAsync|findAsync", clock.calls.map(t => t.member).join("|"));
  }

  @TestMethod
  public recordsAMemberThatReturnsNothingAndCallsItsAnswerOnceGiven(): void {
    const clock = new FakeClock();
    const written: string[] = [];

    clock.write("before");
    clock.answer("write", t => written.push(t));
    clock.write("after");

    Assert.areEqual("after", written.join("|"));
    Assert.areEqual(2, clock.callsOf("write").length);
  }

  @TestMethod
  public refusesWhenStrictAnUnansweredMemberThatReturnsNothingARegistrationAndAListenerAfterRecordingEach(): void {
    const clock = new FakeClock();
    clock.beStrict();

    const refused = [
      Assert.throws(() => clock.write("hello"), UnansweredCallException).member,
      Assert.throws(() => clock.mark("lap"), UnansweredCallException).member,
      Assert.throws(() => clock.onTick(() => undefined), UnansweredCallException).member
    ];

    Assert.areEqual("write|mark|onTick", refused.join("|"));
    Assert.areEqual("write|mark|onTick", clock.calls.map(t => t.member).join("|"));
    Assert.areEqual(0, clock.activeCallsOf("mark").length + clock.activeCallsOf("onTick").length);
  }

  @TestMethod
  public takesWhenStrictAMemberTheTestAnsweredOrAllowed(): void {
    const clock = new FakeClock();
    const heard: string[] = [];
    clock.beStrict();
    clock.answer("write", message => heard.push(message));
    clock.allow("mark", "onTick");

    clock.write("hello");
    clock.mark("lap");
    clock.onTick(t => heard.push(`tick ${String(t)}`));
    clock.raiseTick(1);

    Assert.areEqual("hello|tick 1", heard.join("|"));
    Assert.areEqual(1, clock.activeCallsOf("mark").length);
    Assert.areEqual(1, clock.activeCallsOf("onTick").length);
  }

  @TestMethod
  public stillRefusesWhenStrictAnUnansweredMemberThatReturnsAValueThoughTheTestAllowedIt(): void {
    const clock = new FakeClock();
    clock.beStrict();
    clock.allow("read", "id");

    const refused = [
      Assert.throws(() => clock.read("zone"), UnansweredCallException).member,
      Assert.throws(() => clock.id, UnansweredCallException).member
    ];

    Assert.areEqual("read|id", refused.join("|"));
  }

  @TestMethod
  public makesEachFakeItHoldsStrictToo(): void {
    const desk = new FakeDesk();
    const lenient = new FakeDesk();
    desk.beStrict();

    lenient.close();
    lenient.clock.write("hello");

    Assert.areEqual("close", Assert.throws(() => desk.close(), UnansweredCallException).member);
    Assert.areEqual("write", Assert.throws(() => desk.clock.write("hello"), UnansweredCallException).member);
    Assert.areEqual(1, lenient.clock.callsOf("write").length);
  }

  @TestMethod
  public keepsARegistrationActiveUntilItsDisposerRuns(): void {
    const clock = new FakeClock();

    const first = clock.mark("first");
    clock.mark("second");
    const both = clock.activeCallsOf("mark").map(t => t.join(" ")).join("|");
    first();
    first();

    Assert.areEqual("first|second", both);
    Assert.areEqual("second", clock.activeCallsOf("mark").map(t => t.join(" ")).join("|"));
    Assert.areEqual(2, clock.callsOf("mark").length);
  }

  @TestMethod
  public raisesToEachListenerInPlaceInOrderAndNotToOneDisposed(): void {
    const clock = new FakeClock();
    const heard: string[] = [];
    const stop = clock.onTick(t => heard.push(`first ${t}`));
    clock.onTick(t => {
      heard.push(`second ${t}`);
      stop();
    });

    clock.raiseTick(1);
    clock.raiseTick(2);

    Assert.areEqual("first 1|second 1|second 2", heard.join("|"));
    Assert.areEqual(1, clock.activeCallsOf("onTick").length);
    Assert.areEqual(2, clock.callsOf("onTick").length);
  }

  @TestMethod
  public raiseStillCallsAListenerAnEarlierOneRemovesAndStopsAtAThrow(): void {
    const clock = new FakeClock();
    const heard = FakeTests.listenRemovingAndThrowing(clock);

    const thrown = Assert.throws(() => clock.raiseTick(1), Error);

    Assert.areEqual("first|removed", heard.join("|"));
    Assert.isTrue(thrown === FakeTests.FAILURE && clock.errors.length === 0);
  }

  @TestMethod
  public raiseIsolatedStillCallsAListenerAnEarlierOneRemovesAndKeepsAThrow(): void {
    const clock = new FakeClock();
    const reporting = new FakeClock();
    const heard = FakeTests.listenRemovingAndThrowing(clock);
    const heardReported = FakeTests.listenRemovingAndThrowing(reporting);

    clock.raiseTickIsolated(1);
    reporting.raiseTickIsolatedReported(1);

    Assert.areEqual("first|removed|last", heard.join("|"));
    Assert.areEqual("first|removed|last", heardReported.join("|"));
    Assert.isTrue(FakeTests.keptOnce(clock.errors) && FakeTests.keptOnce(reporting.reported) && reporting.errors.length === 0);
  }

  @TestMethod
  public raiseLiveSkipsAListenerAnEarlierOneRemovesAndKeepsAThrow(): void {
    const clock = new FakeClock();
    const reporting = new FakeClock();
    const heard = FakeTests.listenRemovingAndThrowing(clock);
    const heardReported = FakeTests.listenRemovingAndThrowing(reporting);

    clock.raiseTickLive(1);
    reporting.raiseTickLiveReported(1);

    Assert.areEqual("first|last", heard.join("|"));
    Assert.areEqual("first|last", heardReported.join("|"));
    Assert.isTrue(FakeTests.keptOnce(clock.errors) && FakeTests.keptOnce(reporting.reported) && reporting.errors.length === 0);
  }

  @TestMethod
  public async rejectsWhenAnAsyncAnswerThrows(): Promise<void> {
    const clock = new FakeClock();
    const failure = new Error("The answer failed.");
    clock.answer("loadAsync", () => {
      throw failure;
    });
    clock.answer("findAsync", () => {
      throw failure;
    });

    const loading = clock.loadAsync("zone");
    const finding = clock.findAsync<string>("zone");

    Assert.isTrue(await Assert.throwsAsync(() => loading, Error) === failure);
    Assert.isTrue(await Assert.throwsAsync(() => finding, Error) === failure);
  }

  @TestMethod
  public async waitsForEachAsyncListenerAndKeepsWhatOneRejectsWith(): Promise<void> {
    const clock = new FakeClock();
    const heard: string[] = [];
    const failure = new Error("The listener failed.");
    let stopLast = (): void => undefined;
    clock.onStop(() => Promise.reject(failure));
    clock.onStop(() => {
      stopLast();
      throw failure;
    });
    clock.onStop(async () => {
      await Promise.resolve();
      heard.push("third");
    });
    stopLast = clock.onStop(() => {
      heard.push("removed");
      return Promise.resolve();
    });

    await clock.raiseStopAsync();
    await clock.raiseStopReportedAsync();

    Assert.areEqual("third|third", heard.join("|"));
    Assert.areEqual(2, clock.errors.length);
    Assert.areEqual(2, clock.reported.length);
    Assert.isTrue([...clock.errors, ...clock.reported].every(t => t === failure));
  }

  private static listenRemovingAndThrowing(clock: FakeClock): string[] {
    const heard: string[] = [];
    let stopRemoved = (): void => undefined;
    clock.onTick(() => {
      heard.push("first");
      stopRemoved();
    });
    stopRemoved = clock.onTick(() => heard.push("removed"));
    clock.onTick(() => {
      throw FakeTests.FAILURE;
    });
    clock.onTick(() => heard.push("last"));
    return heard;
  }

  private static keptOnce(errors: readonly unknown[]): boolean {
    return errors.length === 1 && errors[0] === FakeTests.FAILURE;
  }
}
