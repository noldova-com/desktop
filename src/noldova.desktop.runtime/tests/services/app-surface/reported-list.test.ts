/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppWindow, AppWindowList } from "@noldova/desktop.protocol";

import { ReportedList } from "../../../src/services/app-surface/reported-list.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ReportedListTests {
  private static readonly EMPTY: AppWindowList = new AppWindowList([]);
  private static readonly WINDOWS: AppWindowList = new AppWindowList([new AppWindow(132_406, 4210)]);

  @TestMethod
  public startsEmptyAndTellsItsListenersOnlyWhenTheValueChanges(): void {
    const list = new ReportedList(ReportedListTests.EMPTY, "windows", new TextOutputFixture());
    const heard: number[] = [];
    list.listen(() => heard.push(list.current.windows.length));
    const empty = list.current;

    list.receive(1, ReportedListTests.WINDOWS);
    list.receive(1, AppWindowList.fromJson(ReportedListTests.WINDOWS.toJson()));
    list.receive(1, ReportedListTests.EMPTY);

    Assert.areEqual(ReportedListTests.EMPTY, empty);
    Assert.areEqual("1|0", heard.join("|"));
  }

  @TestMethod
  public tellsItsListenersWhenANewConnectionReportsTheSameValue(): void {
    const list = new ReportedList(ReportedListTests.EMPTY, "windows", new TextOutputFixture());
    let heard = 0;
    list.listen(() => heard++);

    list.receive(1, ReportedListTests.WINDOWS);
    list.receive(2, ReportedListTests.WINDOWS);

    Assert.areEqual(2, heard);
  }

  @TestMethod
  public emptiesOnlyWhenTheReportingConnectionCloses(): void {
    const list = new ReportedList(ReportedListTests.EMPTY, "windows", new TextOutputFixture());
    let heard = 0;
    list.listen(() => heard++);
    list.receive(1, ReportedListTests.WINDOWS);

    list.close(2);
    const kept = list.current.windows.length;
    list.close(1);
    list.close(1);

    Assert.areEqual(1, kept);
    Assert.areEqual(ReportedListTests.EMPTY, list.current);
    Assert.areEqual(2, heard);
  }

  @TestMethod
  public stopsTellingAListenerOnceItsRegistrationIsDisposedEvenDuringAChange(): void {
    const list = new ReportedList(ReportedListTests.EMPTY, "windows", new TextOutputFixture());
    const heard: string[] = [];
    let second: Disposable | null = null;
    list.listen(() => {
      heard.push("first");
      second?.[Symbol.dispose]();
    });
    second = list.listen(() => heard.push("second"));

    list.receive(1, ReportedListTests.WINDOWS);

    Assert.areEqual("first", heard.join("|"));
  }

  @TestMethod
  public writesAListenersFailureAndStillTellsTheOthers(): void {
    const diagnostics = new TextOutputFixture();
    const list = new ReportedList(ReportedListTests.EMPTY, "windows", diagnostics);
    let heard = 0;
    list.listen(() => {
      throw new Error("The part is gone.");
    });
    list.listen(() => heard++);

    list.receive(1, ReportedListTests.WINDOWS);

    Assert.areEqual(1, heard);
    Assert.areEqual("A part failed to hear that the app's windows changed: Error: The part is gone.\n", diagnostics.text);
  }
}
