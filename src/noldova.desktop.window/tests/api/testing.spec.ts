/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, TimeFormatService } from "@noldova/desktop.window";
import * as published from "@noldova/desktop.window/testing";

import * as testing from "../../src/api/testing";

describe("the window's testing entry", () => {
  it("publishes the fakes of the context the window hands a module's window part", () => {
    expect(Object.values(published)).toEqual(Object.values(testing));
    expect(Object.keys(testing).sort()).toEqual(["FakeTimeFormats", "FakeWindowPartContext", "FakeWindowSecrets", "FakeWindowWebViews"]);
  });

  it("gives the window's time format service the fake's formats, the 12-hour defaults until a test changes them", () => {
    const formats = new published.FakeTimeFormats();
    TestBed.configureTestingModule({ providers: [formats.provider] });
    const times = TestBed.inject(TimeFormatService);
    const at = new Date(2026, 9, 22, 13, 5).getTime();
    const before = [formats.time(), formats.dateTime(), times.time(at), times.dateTime(at)];
    formats.use("HH:mm", "d MMM yyyy, HH:mm");

    expect([before, [formats.time(), formats.dateTime(), times.time(at), times.dateTime(at)]]).toEqual([
      ["h:mm a", "MMM d, yyyy, h:mm a", "1:05 PM", "Oct 22, 2026, 1:05 PM"], ["HH:mm", "d MMM yyyy, HH:mm", "13:05", "22 Oct 2026, 13:05"]]);
  });

  it("rejects a fake request with the window's request failure, its code and details", async () => {
    const context = new published.FakeWindowPartContext();
    context.answer("requestAsync", () => Promise.reject(new RuntimeRequestException(FailureCode.NotFound, "There is no such note.", { path: "/notes/a.md" })));

    const failure = await context.requestAsync("notes.open", { path: "/notes/a.md" }).catch((error: unknown) => error);

    expect(failure instanceof RuntimeRequestException && [failure.code, failure.message, failure.details]).toEqual([FailureCode.NotFound, "There is no such note.", { path: "/notes/a.md" }]);
  });
});
