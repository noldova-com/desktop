/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IWindowStateStore, WindowBoundsKeeper, WindowStateNotConnectedException, WindowStateRefusedException } from "@noldova/desktop.electron";
import { Failure, FailureCode, QualifiedName } from "@noldova/desktop.protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeMainProcessLog } from "../fixtures/fake-main-process-log.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

class MemoryStore implements IWindowStateStore {
  public value: JsonObject | null;
  public readonly writes: JsonObject[] = [];
  public failure: Error | null = null;
  public readFailure: Error | null = null;
  public attempts: number = 0;

  public constructor(value: JsonObject | null) {
    this.value = value;
  }

  public readAsync(): Promise<JsonObject | null> {
    if (!Object.isNull(this.readFailure))
      return Promise.reject(this.readFailure);
    return Promise.resolve(this.value);
  }

  public writeAsync(value: JsonObject): Promise<void> {
    this.attempts++;
    if (!Object.isNull(this.failure))
      return Promise.reject(this.failure);
    this.writes.push(value);
    return Promise.resolve();
  }
}

@TestClass
export class WindowBoundsKeeperTests {
  @TestMethod
  public async keepsBoundsItCouldNotSaveWhileTheRuntimeWasUnreachableAndSavesTheNewestOnce(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const log = new FakeMainProcessLog();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 1, log, true);
    await keeper.restoreAsync(store);
    store.failure = new WindowStateNotConnectedException();

    window.bounds = { x: 10, y: 20, width: 800, height: 600 };
    window.change("move");
    await Condition.waitAsync(() => store.attempts === 1);
    window.bounds = { x: 30, y: 40, width: 900, height: 640 };
    window.change("resize");
    await Condition.waitAsync(() => store.attempts === 2);
    const writesWhileUnreachable = store.writes.length;
    store.failure = null;
    await keeper.saveUnsavedAsync();
    await keeper.saveUnsavedAsync();

    Assert.areEqual(0, writesWhileUnreachable);
    Assert.areEqual(0, log.lines.length);
    Assert.areEqual(JSON.stringify([{ x: 30, y: 40, width: 900, height: 640, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesNothingWhenNoBoundsAreUnsavedAndStillReportsARefusal(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const log = new FakeMainProcessLog();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 1, log, true);
    await keeper.restoreAsync(store);

    await keeper.saveUnsavedAsync();
    store.failure = new WindowStateRefusedException(new QualifiedName("desktop", "writeWindowBounds"), new Failure(FailureCode.Internal, "The database is busy."));
    window.change("move");
    await Condition.waitAsync(() => log.lines.length === 1);
    store.failure = null;
    await keeper.saveUnsavedAsync();

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: WindowStateRefusedException: The runtime refused desktop.writeWindowBounds: The database is busy."]), JSON.stringify(log.lines));
    Assert.areEqual(1, store.writes.length);
  }

  @TestMethod
  public async keepsWhereThePersonPlacedTheWindowBeforeTheStoreAndSavesItInsteadOfRestoring(): Promise<void> {
    for (const event of ["will-move", "will-resize"]) {
      const window = new FakeMainProcessWindow({}, 1);
      const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: false });
      const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

      window.bounds = { x: 40, y: 60, width: 900, height: 640 };
      window.change(event);
      await keeper.restoreAsync(store);

      Assert.areEqual("[]", JSON.stringify(window.calls));
      Assert.areEqual(JSON.stringify([{ x: 40, y: 60, width: 900, height: 640, maximized: false }]), JSON.stringify(store.writes));
    }
  }

  @TestMethod
  public async keepsBoundsMovedBeforeTheStoreUnsavedWhenTheFirstSaveFails(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    store.failure = new WindowStateNotConnectedException();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    window.change("will-move");
    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateNotConnectedException);
    store.failure = null;
    await keeper.saveUnsavedAsync();

    Assert.areEqual(1, store.writes.length);
  }

  @TestMethod
  public async restoresTheSavedBoundsWhenOnlyTheWindowManagerChangedTheWindowBeforeTheStore(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    window.bounds = { x: 0, y: 0, width: 1280, height: 752 };
    window.change("resize");
    window.change("move");
    await keeper.restoreAsync(store);

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
    Assert.areEqual(0, store.writes.length);
  }

  @TestMethod
  public async restoresTheSavedBoundsWhereTheWindowDoesNotHoldThePersonsMoves(): Promise<void> {
    for (const event of ["will-move", "will-resize"]) {
      const window = new FakeMainProcessWindow({}, 1);
      const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: false });
      const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), false);

      window.bounds = { x: 0, y: 0, width: 1280, height: 752 };
      window.change(event);
      await keeper.restoreAsync(store);

      Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
      Assert.areEqual(0, store.writes.length);
    }
  }

  @TestMethod
  public async refusesToSaveAtCloseBoundsMovedBeforeAnyStoreSoTheyAreReportedLost(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    window.change("will-resize");

    await Assert.throwsAsync(() => keeper.saveAsync(), WindowStateNotConnectedException);
  }

  @TestMethod
  public async restoresSavedBoundsThatADisplayShowsAndMaximizesAShownWindowAtOnce(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    window.isShown = true;
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    await keeper.restoreAsync(new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: true }));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async maximizesAHiddenWindowOnlyAsItShowsItAndSavesItAsMaximizedMeanwhile(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: true });
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    await keeper.restoreAsync(store);
    const whileHidden = [...window.calls];
    await keeper.saveAsync();
    keeper.show();
    keeper.show();

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(whileHidden));
    Assert.areEqual(JSON.stringify([{ x: 200, y: 100, width: 1000, height: 700, maximized: true }]), JSON.stringify(store.writes));
    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize", "show", "show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async shrinksSavedBoundsLargerThanTheirDisplayAndKeepsThemMaximized(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const displays = new FakeDisplayHost();
    displays.workAreas = [{ x: 0, y: 25, width: 1024, height: 743 }];
    displays.primaryWorkArea = { x: 0, y: 25, width: 1024, height: 743 };
    const keeper = new WindowBoundsKeeper(window, displays, 5, new FakeMainProcessLog(), false);
    window.isShown = true;

    await keeper.restoreAsync(new MemoryStore({ x: 0, y: 25, width: 1280, height: 800, maximized: true }));
    await keeper.restoreAsync(new MemoryStore({ x: null, y: null, width: 1280, height: 800, maximized: false }));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":51,\"y\":62,\"width\":921,\"height\":668}", "maximize", "setBounds {\"x\":51,\"y\":62,\"width\":921,\"height\":668}"]),
      JSON.stringify(window.calls));
  }

  @TestMethod
  public async centersSavedBoundsThatNoDisplayShows(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    await keeper.restoreAsync(new MemoryStore({ x: 5000, y: 100, width: 1000, height: 700, maximized: false }));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":460,\"y\":170,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async keepsTheStoredPositionWhenItKeepsItAndSavesTheWindowsSizeAndMaximizedState(): Promise<void> {
    const cases: [JsonObject | null, boolean, JsonObject][] = [
      [{ x: 40, y: 60, width: 900, height: 640, maximized: false }, true, { x: 40, y: 60, width: 1000, height: 700, maximized: true }],
      [null, true, { x: null, y: null, width: 1000, height: 700, maximized: true }],
      [{ x: 40, y: 60, width: 900, height: 640, maximized: false }, false, { x: 16, y: 10, width: 1000, height: 700, maximized: true }]
    ];
    for (const [saved, keepsStoredPosition, expected] of cases) {
      const window = new FakeMainProcessWindow({}, 1);
      const store = new MemoryStore(saved);
      const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), false, keepsStoredPosition);
      await keeper.restoreAsync(store);

      window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
      window.change("move");
      window.maximize();
      window.change("maximize");
      await Condition.waitAsync(() => store.writes.length === 1);

      Assert.areEqual(JSON.stringify([expected]), JSON.stringify(store.writes));
    }
  }

  @TestMethod
  public async savesNothingWhenItKeepsTheStoredPositionAndTheStoreRefusedToReadIt(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 40, y: 60, width: 900, height: 640, maximized: false });
    store.readFailure = new WindowStateRefusedException(new QualifiedName("desktop", "readWindowBounds"), new Failure(FailureCode.Internal, "The database is busy."));
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), false, true);

    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateRefusedException);
    store.readFailure = null;
    window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
    window.change("move");
    await Assert.throwsAsync(() => keeper.saveAsync(), WindowStateNotConnectedException);
    await Assert.throwsAsync(() => keeper.holdAsync(), WindowStateNotConnectedException);
    await Assert.throwsAsync(() => keeper.saveUnsavedAsync(), WindowStateNotConnectedException);

    Assert.areEqual(0, store.attempts);
  }

  @TestMethod
  public async readsTheStoredPositionBeforeItsFirstSaveWhenItKeepsItAndTheRuntimeWasUnreachable(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 40, y: 60, width: 900, height: 640, maximized: false });
    store.readFailure = new WindowStateNotConnectedException();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), false, true);

    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateNotConnectedException);
    window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
    await keeper.saveAsync();
    const attemptsWhileUnread = store.attempts;
    store.readFailure = null;
    await keeper.restoreAsync(store);
    window.bounds = { x: 16, y: 10, width: 900, height: 640 };
    window.change("move");
    await keeper.saveAsync();

    Assert.areEqual(0, attemptsWhileUnread);
    Assert.areEqual(JSON.stringify(["setBounds {\"x\":40,\"y\":60,\"width\":900,\"height\":640}"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify([{ x: 40, y: 60, width: 900, height: 640, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async readsTheStoredPositionBeforeSavingBoundsHeldWhileItsReadFailedWhenItKeepsIt(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 40, y: 60, width: 900, height: 640, maximized: false });
    store.readFailure = new WindowStateNotConnectedException();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), false, true);

    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateNotConnectedException);
    await keeper.holdAsync();
    window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
    window.change("resize");
    await keeper.saveAsync();
    store.readFailure = null;
    await keeper.restoreAsync(store);

    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify([{ x: 40, y: 60, width: 1000, height: 700, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesNothingAfterTheStoreRefusedToReadTheSavedBoundsUntilARestoreReadsThem(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 40, y: 60, width: 900, height: 640, maximized: false });
    store.readFailure = new WindowStateRefusedException(new QualifiedName("desktop", "readWindowBounds"), new Failure(FailureCode.Internal, "The database is busy."));
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), true);

    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateRefusedException);
    await keeper.saveAsync();
    await keeper.holdAsync();
    await keeper.saveUnsavedAsync();
    const attemptsWhileUnread = store.attempts;
    store.readFailure = null;
    await keeper.restoreAsync(store);
    await keeper.saveAsync();

    Assert.areEqual(0, attemptsWhileUnread);
    Assert.areEqual(JSON.stringify(["setBounds {\"x\":40,\"y\":60,\"width\":900,\"height\":640}"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify([{ x: 40, y: 60, width: 900, height: 640, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async keepsWhereThePersonPlacedTheWindowAfterARefusedReadAndSavesItOnTheNextRestore(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 40, y: 60, width: 900, height: 640, maximized: false });
    store.readFailure = new WindowStateRefusedException(new QualifiedName("desktop", "readWindowBounds"), new Failure(FailureCode.Internal, "The database is busy."));
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), false);

    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateRefusedException);
    window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
    window.change("move");
    const attemptsWhileUnread = store.attempts;
    store.readFailure = null;
    await keeper.restoreAsync(store);

    Assert.areEqual(0, attemptsWhileUnread);
    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify([{ x: 16, y: 10, width: 1000, height: 700, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesNothingWhenItKeepsTheStoredPositionAndTheStoreRefusesTheReadBeforeAHeldSave(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ x: 40, y: 60, width: 900, height: 640, maximized: false });
    store.readFailure = new WindowStateRefusedException(new QualifiedName("desktop", "readWindowBounds"), new Failure(FailureCode.Internal, "The database is busy."));
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), false, true);
    await keeper.holdAsync();
    window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
    await keeper.saveAsync();

    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateRefusedException);
    await Assert.throwsAsync(() => keeper.saveAsync(), WindowStateNotConnectedException);

    Assert.areEqual(0, store.attempts);
  }

  @TestMethod
  public async savesHeldBoundsWithoutAPositionWhenItKeepsTheStoredPositionAndTheStoredValueIsNotValid(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore({ width: 10 });
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), false, true);
    await keeper.holdAsync();
    window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
    await keeper.saveAsync();

    await Assert.throwsAsync(() => keeper.restoreAsync(store), JsonException);
    await keeper.saveAsync();

    Assert.areEqual(JSON.stringify([{ x: null, y: null, width: 1000, height: 700, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesAWindowSmallerThanTheMinimumAtTheMinimumSize(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), true);
    await keeper.restoreAsync(store);

    window.bounds = { x: 10, y: 20, width: 600, height: 400 };
    await keeper.saveAsync();
    window.bounds = { x: 10, y: 20, width: 700, height: 300 };
    await keeper.saveAsync();

    Assert.areEqual(JSON.stringify([{ x: 10, y: 20, width: 640, height: 480, maximized: false }, { x: 10, y: 20, width: 700, height: 480, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async placesNothingWhenTheWindowIsGoneBeforeTheSavedBoundsAreRead(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const read = Promise.withResolvers<JsonObject | null>();
    const store = new MemoryStore(null);
    store.readAsync = (): Promise<JsonObject | null> => read.promise;
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), true);

    const restoring = keeper.restoreAsync(store);
    window.isGone = true;
    read.resolve({ x: 40, y: 60, width: 900, height: 640, maximized: true });
    await restoring;

    Assert.areEqual("[]", JSON.stringify(window.calls));
  }

  @TestMethod
  public async keepsTheDefaultBoundsWhenNoneWereSavedOrTheyAreNotValid(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);

    await new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true).restoreAsync(new MemoryStore(null));
    await Assert.throwsAsync(() => new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true).restoreAsync(new MemoryStore({ width: 10 })), JsonException);

    Assert.areEqual("[]", JSON.stringify(window.calls));
  }

  @TestMethod
  public async savesOnceAfterAPauseInChanges(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    window.change("move");
    await keeper.restoreAsync(store);
    window.change("resize");
    window.change("maximize");
    window.isMaximizedNow = true;
    window.change("unmaximize");
    await Condition.waitAsync(() => store.writes.length === 1);

    Assert.areEqual(JSON.stringify([{ x: 100, y: 80, width: 1280, height: 800, maximized: true }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesAtOnceWhenAskedAndNotAfterTheWindowIsGone(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeMainProcessLog(), true);

    await keeper.saveAsync();
    await keeper.restoreAsync(store);
    window.change("move");
    await keeper.saveAsync();
    window.bounds = { x: 1, y: 2, width: 700, height: 500 };
    window.change("move");
    await Condition.waitAsync(() => store.writes.at(-1)?.["x"] === 1);
    window.isGone = true;
    await keeper.saveAsync();

    Assert.areEqual(2, store.writes.length);
  }

  @TestMethod
  public async savesAPendingSaveAsItHoldsAndWritesNothingMoreUntilItResumes(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const log = new FakeMainProcessLog();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, log, true);
    await keeper.restoreAsync(store);

    window.bounds = { x: 10, y: 20, width: 800, height: 600 };
    window.change("move");
    await keeper.holdAsync();
    const writesAtHold = store.writes.length;
    window.bounds = { x: 30, y: 40, width: 900, height: 640 };
    window.change("resize");
    await keeper.saveAsync();
    const writesWhileHeld = store.writes.length;
    await keeper.saveUnsavedAsync();
    await keeper.saveUnsavedAsync();

    Assert.areEqual(1, writesAtHold);
    Assert.areEqual(1, writesWhileHeld);
    Assert.areEqual(0, log.lines.length);
    Assert.areEqual(
      JSON.stringify([{ x: 10, y: 20, width: 800, height: 600, maximized: false }, { x: 30, y: 40, width: 900, height: 640, maximized: false }]),
      JSON.stringify(store.writes));
  }

  @TestMethod
  public async holdsWithoutAWriteWhenNothingIsPendingAndSavesTheBoundsChangedMeanwhileOnTheNextRestore(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const next = new MemoryStore({ x: 0, y: 0, width: 640, height: 480, maximized: false });
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), true);
    await keeper.restoreAsync(store);

    await keeper.holdAsync();
    window.bounds = { x: 30, y: 40, width: 900, height: 640 };
    window.change("move");
    await keeper.saveAsync();
    await keeper.restoreAsync(next);

    Assert.areEqual(0, store.writes.length);
    Assert.areEqual(JSON.stringify([{ x: 30, y: 40, width: 900, height: 640, maximized: false }]), JSON.stringify(next.writes));
    Assert.areEqual(JSON.stringify({ x: 30, y: 40, width: 900, height: 640 }), JSON.stringify(window.bounds));
  }

  @TestMethod
  public async holdsEvenWhenItsSaveFails(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 60_000, new FakeMainProcessLog(), true);
    await keeper.restoreAsync(store);
    store.failure = new WindowStateRefusedException(new QualifiedName("desktop", "writeWindowBounds"), new Failure(FailureCode.Unavailable, "Noldova Desktop Sample is preparing to install an update."));

    window.change("move");
    await Assert.throwsAsync(() => keeper.holdAsync(), WindowStateRefusedException);
    window.change("resize");
    await keeper.saveAsync();

    Assert.areEqual(1, store.attempts);
  }

  @TestMethod
  public async reportsAScheduledSaveThatFails(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const store = new MemoryStore(null);
    store.failure = new Error("The runtime is gone.");
    const log = new FakeMainProcessLog();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 1, log, true);

    await keeper.restoreAsync(store);
    window.change("resize");
    await Condition.waitAsync(() => log.lines.length === 1);

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: Error: The runtime is gone."]), JSON.stringify(log.lines));
  }
}
