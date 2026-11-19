/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Condition } from "./fixtures/condition.fixture.js";
import { FakeKeyboardEvent, FakePointerEvent, FakePressPage, FakeTouchEvent } from "./fixtures/fake-press-page.fixture.js";

@TestClass
export class PressWatchTests {
  @TestMethod
  public listensOnThePagesWindowAheadOfItsListenersWithoutBlockingScrollAndExposesNothing(): void {
    const page = FakePressPage.load();

    Assert.areEqual("pointerdown,pointermove,keydown,touchstart,mousedown,pointerup,mouseup,click,auxclick,dblclick,contextmenu,keypress,keyup,touchend", [...page.options.keys()].join(","));
    Assert.isTrue([...page.options.values()].every(t => JSON.stringify(t) === "{\"capture\":true,\"passive\":true}"));
    Assert.areEqual(0, page.electron.sent.length);
    Assert.areEqual(0, page.electron.exposedNames.length);
  }

  @TestMethod
  public startsAPressAtATrustedPointerDownWithItsTimeOnItsChannelAndEndsItOnceTheTaskEnds(): void {
    const page = FakePressPage.load();

    page.dispatch(new FakePointerEvent("pointerdown", true, 1, 4, 12.5), FakePressPage.event("mousedown"));
    const during = page.reports();
    page.endTask();

    Assert.areEqual("start 12.5", during);
    Assert.areEqual("start 12.5|end", page.reports());
    Assert.areEqual("desktop:web-view-press", page.electron.sent[0]?.[0]);
  }

  @TestMethod
  public startsAPressAtAKeyThatIsNotARepeatAndAtAFurtherButtonPressedWhileOneIsHeld(): void {
    const page = FakePressPage.load();

    page.dispatch(new FakeKeyboardEvent("keydown", true, false, 3));
    page.dispatch(new FakePointerEvent("pointermove", true, 2, 3, 4));
    page.endTask();

    Assert.areEqual("start 3|start 4|end", page.reports());
  }

  @TestMethod
  public startsATouchsPressAtItsTouchStartWithItsTouchesIdsNotAtItsPointerDownAndGoesOnWithItAtItsTouchEnd(): void {
    const page = FakePressPage.load();

    page.dispatch(new FakePointerEvent("pointerdown", true, 0, 1, 7, "touch"));
    const atPointerDown = page.reports();
    page.dispatch(new FakeTouchEvent("touchstart", true, 7, [1000000000, 4]), new FakePointerEvent("pointerup", true, 0, 0, 8, "touch"));
    page.endTask();
    page.dispatch(new FakeTouchEvent("touchend", true, 9, [4]), FakePressPage.event("click"));
    page.endTask();
    page.dispatch(new FakeTouchEvent("touchstart", false, 10, [5]));

    Assert.areEqual(String.empty, atPointerDown);
    Assert.areEqual("start 7 1000000000,4|end|resume|end", page.reports());
  }

  @TestMethod
  public goesOnWithThePressThroughTheEventsThatFollowItOncePerTask(): void {
    const page = FakePressPage.load();

    page.dispatch(new FakePointerEvent("pointerdown", true, 1, 4, 5));
    page.endTask();
    page.dispatch(FakePressPage.event("mouseup"), FakePressPage.event("auxclick"));
    page.endTask();
    page.dispatch(new FakeKeyboardEvent("keydown", true, true, 6), FakePressPage.event("keyup"));
    page.endTask();
    page.dispatch(FakePressPage.event("keydown"));
    page.endTask();

    Assert.areEqual("start 5|end|resume|end|resume|end|resume|end", page.reports());
  }

  @TestMethod
  public reportsNothingForAnEventThePageDispatchesOrAPointerMoveThatPressesNoButton(): void {
    const page = FakePressPage.load();

    page.dispatch(
      new FakePointerEvent("pointerdown", false, 0, 1, 1),
      new FakeKeyboardEvent("keydown", false, false, 1),
      FakePressPage.event("auxclick", false),
      new FakePointerEvent("pointermove", true, -1, 1, 1),
      new FakePointerEvent("pointermove", true, 1, 1, 1),
      new FakePointerEvent("pointermove", true, 5, 32, 1),
      FakePressPage.event("pointermove"));
    page.endTask();

    Assert.areEqual(String.empty, page.reports());
  }

  @TestMethod
  public async endsThePressOnItsTimerToo(): Promise<void> {
    const page = FakePressPage.load();

    page.dispatch(new FakePointerEvent("pointerdown", true, 0, 1, 7));
    await Condition.waitAsync(() => page.reports().endsWith("|end"));
    page.endTask();

    Assert.areEqual("start 7|end", page.reports());
  }
}
