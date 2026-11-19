/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { WebViewPresses } from "../../src/services/web-view-presses.js";

@TestClass
export class WebViewPressesTests {
  private static readonly ORIGIN: string = "https://example.com";

  @TestMethod
  public keepsThePressesOfItsLatest64FramesSoAnOlderFramesLaterEventStartsNoPress(): void {
    const presses = new WebViewPresses();
    for (let index = 0; index < 65; index++) {
      presses.note(`1:${index}`, WebViewPressesTests.ORIGIN, "start", index, false);
      presses.note(`1:${index}`, WebViewPressesTests.ORIGIN, "end", undefined, false);
    }

    presses.note("1:0", WebViewPressesTests.ORIGIN, "resume", undefined, false);
    const oldest = presses.read(WebViewPressesTests.ORIGIN);
    presses.note("1:1", WebViewPressesTests.ORIGIN, "resume", undefined, false);

    Assert.areEqual("null,2", [oldest, presses.read(WebViewPressesTests.ORIGIN)].map(t => String(t)).join(","));
  }

  @TestMethod
  public givesTheRelaysPressesNullAndKeepsNumberingThePersonsAcrossAForget(): void {
    const presses = new WebViewPresses();

    presses.addRelayed(1);
    presses.note("1:1", WebViewPressesTests.ORIGIN, "start", 1, false);
    const relayed = presses.read(WebViewPressesTests.ORIGIN);
    presses.note("1:1", WebViewPressesTests.ORIGIN, "start", 2, true);
    const running = presses.read(WebViewPressesTests.ORIGIN);
    presses.note("1:1", WebViewPressesTests.ORIGIN, "start", 3, false);
    const first = presses.read(WebViewPressesTests.ORIGIN);
    presses.addRelayed(2);
    presses.forget();
    presses.note("1:1", WebViewPressesTests.ORIGIN, "start", 4, false);

    Assert.areEqual("null,null,1,2", [relayed, running, first, presses.read(WebViewPressesTests.ORIGIN)].map(t => String(t)).join(","));
  }

  @TestMethod
  public readsThePressOfTheLatestOpenFrameOfTheRequestsOriginAndKeepsAFramesNewOriginFromItsResume(): void {
    const presses = new WebViewPresses();

    presses.note("1:1", WebViewPressesTests.ORIGIN, "start", 1, false);
    presses.note("2:1", "https://other.example", "start", 2, false);
    const reads = [presses.read(WebViewPressesTests.ORIGIN), presses.read("https://other.example"), presses.read("https://third.example"), presses.read(null)];
    presses.note("2:1", "https://other.example", "end", undefined, false);
    presses.note("2:1", "https://moved.example", "resume", undefined, false);

    Assert.areEqual("1,2,null,null,null,2", [...reads, presses.read("https://other.example"), presses.read("https://moved.example")].map(t => String(t)).join(","));
  }
}
