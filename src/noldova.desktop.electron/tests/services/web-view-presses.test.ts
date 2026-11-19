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
  @TestMethod
  public keepsThePressesOfItsLatest64FramesSoAnOlderFramesLaterEventStartsNoPress(): void {
    const presses = new WebViewPresses();
    for (let index = 0; index < 65; index++) {
      presses.note(`1:${index}`, "start", index, false);
      presses.note(`1:${index}`, "end", undefined, false);
    }

    presses.note("1:0", "resume", undefined, false);
    const oldest = presses.read();
    presses.note("1:1", "resume", undefined, false);

    Assert.areEqual("null,2", [oldest, presses.read()].map(t => String(t)).join(","));
  }

  @TestMethod
  public givesTheRelaysPressesNullAndKeepsNumberingThePersonsAcrossAForget(): void {
    const presses = new WebViewPresses();

    presses.addRelayed(1);
    presses.note("1:1", "start", 1, false);
    const relayed = presses.read();
    presses.note("1:1", "start", 2, true);
    const running = presses.read();
    presses.note("1:1", "start", 3, false);
    const first = presses.read();
    presses.addRelayed(2);
    presses.forget();
    presses.note("1:1", "start", 4, false);

    Assert.areEqual("null,null,1,2", [relayed, running, first, presses.read()].map(t => String(t)).join(","));
  }
}
