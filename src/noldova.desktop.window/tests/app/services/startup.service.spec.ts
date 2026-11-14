/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { TestBed } from "@angular/core/testing";

import { StartupService } from "../../../src/app/services/startup.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("StartupService", () => {
  afterEach(() => PreloadBridgeFixture.remove());

  it("starts connecting, then shows the main process's state and follows it", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.startup = { kind: "Failed", details: ["The runtime did not start in time."] };
    const service = TestBed.inject(StartupService);

    expect(service.state().kind).toBe("Connecting");
    await vi.waitFor(() => expect(service.state().kind).toBe("Failed"));
    bridge.publishStartup({ kind: "Ready", details: [] });
    expect(service.state().isReady).toBe(true);
  });

  it("has started once the runtime was first ready, and reconnects, announcing it once, whenever it is not ready after that", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.startup = { kind: "Connecting", details: [] };
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce").mockResolvedValue();
    const service = TestBed.inject(StartupService);
    const read = (): readonly boolean[] => [service.hasStarted(), service.isReconnecting()];
    const seen = [read()];

    for (const kind of ["Failed", "Ready", "Connecting", "Failed", "Ready"]) {
      bridge.publishStartup({ kind, details: [] });
      seen.push(read());
    }

    expect(seen).toEqual([[false, false], [false, false], [true, false], [true, true], [true, true], [true, false]]);
    expect(announce.mock.calls).toEqual([["Starting Noldova Desktop Sample…", "polite"]]);
  });

  it("is acting while the main process carries out the person's choice", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(StartupService);

    const acting = service.actAsync("retry");
    expect(service.isActing()).toBe(true);
    await acting;

    expect(service.isActing()).toBe(false);
    expect(bridge.actions).toEqual(["retry"]);
  });

  it("stops following the main process's state when destroyed", () => {
    const bridge = PreloadBridgeFixture.install();
    TestBed.inject(StartupService);

    TestBed.resetTestingModule();

    expect(bridge.listenerCount).toBe(0);
  });

  it("announces an update once, covers the window for it and announces starting again after it", async () => {
    const bridge = PreloadBridgeFixture.install();
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce").mockResolvedValue();
    const service = TestBed.inject(StartupService);
    await vi.waitFor(() => expect(service.hasStarted()).toBe(true));

    bridge.publishStartup({ kind: "Updating", details: ["0.3.0"] });
    const isCovered = service.isReconnecting();
    bridge.publishStartup({ kind: "Updating", details: ["0.3.0"] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Updating", details: [] });

    expect(isCovered).toBe(true);
    expect(announce.mock.calls).toEqual([
      ["Installing Noldova Desktop Sample 0.3.0", "polite"],
      ["Starting Noldova Desktop Sample…", "polite"],
      ["Installing Noldova Desktop Sample ", "polite"]
    ]);
  });
});
