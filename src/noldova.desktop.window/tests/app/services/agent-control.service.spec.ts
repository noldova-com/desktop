/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";

import { AgentControlService } from "../../../src/app/services/agent-control.service";
import { PreloadBridgeService } from "../../../src/app/services/preload-bridge.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("AgentControlService", () => {
  let errors: unknown[];
  let bridge: PreloadBridgeFixture;

  function start(prepare: () => void = () => undefined): AgentControlService {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    prepare();
    const service = TestBed.inject(AgentControlService);
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

  it("reads the state once the runtime is ready, and again after a reconnection", async () => {
    bridge.responses.set("desktop.agentControl", { payload: { isStopped: true, isActing: true } });
    const service = start();

    await settleAsync(() => !Object.isNull(service.state()));
    const first = service.state()?.toJson();
    bridge.responses.set("desktop.agentControl", { payload: { isStopped: false, isActing: false } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(() => service.state()?.isStopped === false);

    expect(first).toEqual({ isStopped: true, isActing: true });
    expect(bridge.requests.filter(t => t[0] === "desktop.agentControl")).toEqual([["desktop.agentControl", null], ["desktop.agentControl", null]]);
    expect(errors).toEqual([]);
  });

  it("gives window parts the same state through the part host, null until the runtime first answers", async () => {
    bridge.responses.set("desktop.agentControl", { payload: { isStopped: true, isActing: false } });
    const service = start();
    const host = TestBed.inject(WindowPartHostService);
    const before = host.agentControl();

    await settleAsync(() => !Object.isNull(service.state()));

    expect(before).toBeNull();
    expect(host.agentControl()?.toJson()).toEqual({ isStopped: true, isActing: false });
  });

  it("follows each change, and keeps it over an older read that arrives later", async () => {
    let answer: (value: JsonValue) => void = () => undefined;
    const read = new Promise<JsonValue>(resolve => answer = resolve);
    let isAsked = false;
    const service = start(() => {
      const mainProcess = TestBed.inject(PreloadBridgeService);
      const request = mainProcess.requestAsync.bind(mainProcess);
      vi.spyOn(mainProcess, "requestAsync").mockImplementation((method, payload) => {
        isAsked ||= method === "desktop.agentControl";
        return method === "desktop.agentControl" ? read : request(method, payload);
      });
    });
    await settleAsync(() => isAsked);

    bridge.publishEvent("desktop.agentControlChanged", { isStopped: true, isActing: false });
    bridge.publishEvent("notes.changed", { isStopped: false, isActing: false });
    answer({ isStopped: false, isActing: true });
    await read;
    TestBed.tick();

    expect(service.state()?.toJson()).toEqual({ isStopped: true, isActing: false });
    expect(errors).toEqual([]);
  });

  it("reports a state it cannot read and a change it cannot understand, keeping the last it understood", async () => {
    bridge.responses.set("desktop.agentControl", { failure: { code: "Unavailable", message: "The runtime did not answer desktop.agentControl in time." } });
    const service = start();
    await settleAsync(() => errors.length === 1);

    bridge.publishEvent("desktop.agentControlChanged", { isStopped: true, isActing: true });
    bridge.publishEvent("desktop.agentControlChanged", { isStopped: "yes" });

    expect(service.state()?.toJson()).toEqual({ isStopped: true, isActing: true });
    expect(errors.length).toBe(2);
  });
});
