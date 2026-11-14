/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";

import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { PreloadBridgeService } from "../../../src/app/services/preload-bridge.service";
import { RecentCommandsService } from "../../../src/app/services/recent-commands.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("RecentCommandsService", () => {
  let errors: unknown[];
  let bridge: PreloadBridgeFixture;

  function start(prepare: () => void = () => undefined): RecentCommandsService {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    prepare();
    const service = TestBed.inject(RecentCommandsService);
    TestBed.tick();
    return service;
  }

  async function settleAsync(isDone: () => boolean): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(isDone()).toBe(true);
    });
  }

  beforeEach(() => {
    errors = [];
    bridge = PreloadBridgeFixture.install();
  });

  afterEach(() => PreloadBridgeFixture.remove());

  it("reads the list once the runtime is ready, and again after a reconnection", async () => {
    bridge.responses.set("desktop.recentCommands", { payload: { ids: ["notes.newNote", "desktop.openSettings"] } });
    const service = start();

    await settleAsync(() => service.ids().length === 2);
    const first = service.ids();
    bridge.responses.set("desktop.recentCommands", { payload: { ids: ["clock.show"] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(() => service.ids().length === 1);

    expect(first).toEqual(["notes.newNote", "desktop.openSettings"]);
    expect(service.ids()).toEqual(["clock.show"]);
    expect(bridge.requests.filter(t => t[0] === "desktop.recentCommands")).toEqual([["desktop.recentCommands", {}], ["desktop.recentCommands", {}]]);
    expect(errors).toEqual([]);
  });

  it("follows the list another window changes, and keeps it over an older read that arrives later", async () => {
    let answer: (value: JsonValue) => void = () => undefined;
    const read = new Promise<JsonValue>(resolve => answer = resolve);
    let isAsked = false;
    const service = start(() => {
      const mainProcess = TestBed.inject(PreloadBridgeService);
      const request = mainProcess.requestAsync.bind(mainProcess);
      vi.spyOn(mainProcess, "requestAsync").mockImplementation((method, payload) => {
        isAsked ||= method === "desktop.recentCommands";
        return method === "desktop.recentCommands" ? read : request(method, payload);
      });
    });
    await settleAsync(() => isAsked);

    bridge.publishEvent("desktop.recentCommandsChanged", { ids: ["clock.show", "notes.newNote"] });
    bridge.publishEvent("notes.changed", { ids: [] });
    answer({ ids: ["notes.newNote"] });
    await read;

    expect(service.ids()).toEqual(["clock.show", "notes.newNote"]);
  });

  it("puts a command it records first at once and asks the runtime to keep it", () => {
    const service = start();
    bridge.publishEvent("desktop.recentCommandsChanged", { ids: ["clock.show", "notes.newNote"] });

    service.record("notes.newNote");

    expect(service.ids()).toEqual(["notes.newNote", "clock.show"]);
    expect(bridge.requests.filter(t => t[0] === "desktop.recordCommand")).toEqual([["desktop.recordCommand", { id: "notes.newNote" }]]);
  });

  it("leaves a read that fails because the connection to the runtime ended to be dropped, and reads again once ready", async () => {
    bridge.responses.set("desktop.recentCommands", { failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });
    const service = start();
    await settleAsync(() => bridge.requests.some(t => t[0] === "desktop.recentCommands"));

    bridge.responses.set("desktop.recentCommands", { payload: { ids: ["clock.show"] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(() => service.ids().length === 1);

    expect(bridge.requests.filter(t => t[0] === "desktop.recentCommands").length).toBe(2);
    expect(errors.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([true]);
  });

  it("reports a list it cannot read, an event it cannot understand and a use it cannot record, leaving one not recorded because the connection ended to be dropped", async () => {
    bridge.responses.set("desktop.recentCommands", { failure: { code: "Unavailable", message: "The runtime did not answer desktop.recentCommands in time." } });
    bridge.responses.set("desktop.recordCommand", { failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });
    const service = start();
    await settleAsync(() => errors.length === 1);

    bridge.publishEvent("desktop.recentCommandsChanged", { ids: ["a", "a"] });
    service.record("notes.newNote");
    await settleAsync(() => errors.length === 3);

    expect(service.ids()).toEqual(["notes.newNote"]);
    expect(errors.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([false, false, true]);
  });
});
