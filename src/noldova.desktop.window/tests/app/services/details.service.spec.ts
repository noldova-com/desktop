/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";

import { DetailsService } from "../../../src/app/services/details.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("DetailsService", () => {
  let bridge: PreloadBridgeFixture;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install("linux");
    bridge.processor = "arm64";
  });

  afterEach(() => PreloadBridgeFixture.remove());

  it("copies the platform and each module's version and state, with the cause of a module that has one, a line for each", async () => {
    const modules = [
      new ModuleStatus("clock", "1.4.2", "Clock", "Tells the time.", [], new Map(), ModuleState.Active, null),
      new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map(), ModuleState.Failed, "Its runtime part failed to activate.")
    ];

    const isCopied = await TestBed.inject(DetailsService).copyAsync(modules);

    expect(isCopied).toBe(true);
    expect(bridge.copiedDetails).toEqual(["Platform: linux arm64\nclock 1.4.2: Active\nnotes 0.0.1: Failed: Its runtime part failed to activate."]);
  });

  it("copies the platform alone when no module is installed", async () => {
    await TestBed.inject(DetailsService).copyAsync([]);

    expect(bridge.copiedDetails).toEqual(["Platform: linux arm64"]);
  });

  it("answers whether the clipboard took the details", async () => {
    bridge.isCopyAccepted = false;

    const isCopied = await TestBed.inject(DetailsService).copyAsync([]);

    expect([isCopied, bridge.copiedDetails]).toEqual([false, []]);
  });
});
