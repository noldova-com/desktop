/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import "@noldova/context.core";

import { FailedModuleRequests } from "../failed-module-requests.ts";
import type { IBrowserCommandContext } from "../interfaces/i-browser-command-context.ts";
import type { IBrowserPage } from "../interfaces/i-browser-page.ts";
import type { IBrowserRequest } from "../interfaces/i-browser-request.ts";
import type { IBrowserResponse } from "../interfaces/i-browser-response.ts";

const NOW = Date.UTC(2026, 10, 16, 5, 40, 41, 619);
const AT = "2026-11-16T05:40:41.619Z";
const ADDRESS = "http://localhost:63315/@fs/a.spec.ts?import";

type BrowserEvent = IBrowserRequest & IBrowserResponse;

class FakePage implements IBrowserPage {
  public readonly listeners: Map<string, ((value: BrowserEvent) => void)[]> = new Map();

  public on(event: string, listener: (value: BrowserEvent) => void): this {
    this.listeners.set(event, [...this.listeners.get(event) ?? [], listener]);
    return this;
  }

  public fail(resourceType: string, errorText: string | null, url: string = ADDRESS): void {
    this.emit("requestfailed", FakePage.event(url, resourceType, errorText, 0, {}));
  }

  public answer(resourceType: string, status: number, headers: Record<string, string>, url: string = ADDRESS): void {
    this.emit("response", FakePage.event(url, resourceType, null, status, headers));
  }

  public open(resourceType: string, url: string, errorText: string | null = null): BrowserEvent {
    const event = FakePage.event(url, resourceType, errorText, 0, {});
    this.emit("request", event);
    return event;
  }

  public finish(event: BrowserEvent): void {
    this.emit("requestfinished", event);
  }

  public failOpen(event: BrowserEvent): void {
    this.emit("requestfailed", event);
  }

  public answerThenCancel(status: number, headers: Record<string, string>): void {
    const event = FakePage.event(ADDRESS, "script", "net::ERR_ABORTED", status, headers);
    this.emit("response", event);
    this.emit("requestfailed", event);
  }

  private emit(name: string, value: BrowserEvent): void {
    for (const listener of this.listeners.get(name) ?? [])
      listener(value);
  }

  private static event(url: string, resourceType: string, errorText: string | null, status: number, headers: Record<string, string>): BrowserEvent {
    const event: BrowserEvent = {
      url: () => url,
      resourceType: () => resourceType,
      failure: () => Object.isNull(errorText) ? null : { errorText },
      status: () => status,
      headers: () => headers,
      request: () => event
    };
    return event;
  }
}

const contextOf = (page: FakePage, logged: string[], closes: (() => void)[] = []): IBrowserCommandContext => ({ page, project: { vitest: { logger: { log: message => logged.push(message) }, onClose: listener => closes.push(listener) } } });

const watch = (): { recorder: FailedModuleRequests; page: FakePage; logged: string[]; closes: (() => void)[] } => {
  const recorder = new FailedModuleRequests();
  const page = new FakePage();
  const logged: string[] = [];
  const closes: (() => void)[] = [];
  recorder.watch(contextOf(page, logged, closes));
  return { recorder, page, logged, closes };
};

const STYLES = "http://localhost:63315/styles.css";
const CHUNK = "http://localhost:63315/chunk-GKUIELHC.js";
const SPEC = "http://localhost:63315/@fs/b.spec.ts?import";
const at = (milliseconds: number): string => new Date(NOW + milliseconds).toISOString();

describe("FailedModuleRequests", () => {
  beforeEach(() => mock.timers.enable({ apis: ["Date", "setInterval"], now: NOW }));

  afterEach(() => mock.timers.reset());

  it("prints a module request that ends in a network error with when it failed, the error and its URL, and gives it back", () => {
    const { recorder, page, logged } = watch();

    page.fail("script", "net::ERR_CONNECTION_RESET");

    const line = `Failed module request at ${AT}: net::ERR_CONNECTION_RESET ${ADDRESS}`;
    assert.deepEqual(logged, [line]);
    assert.deepEqual(recorder.watch(contextOf(page, [])), [line]);
  });

  it("says no network error was given when the browser gives none", () => {
    const { page, logged } = watch();

    page.fail("script", null);

    assert.deepEqual(logged, [`Failed module request at ${AT}: no network error given ${ADDRESS}`]);
  });

  it("prints a module answered with an error status, with its status, its type and its URL", () => {
    const { page, logged } = watch();

    page.answer("script", 404, { "content-type": "text/plain" });
    page.answer("script", 504, {});

    assert.deepEqual(logged, [`Failed module response at ${AT}: 404 text/plain ${ADDRESS}`, `Failed module response at ${AT}: 504 no content type ${ADDRESS}`]);
  });

  it("prints a module answered with an error status once, though the browser then cancels its request, and still prints a cancel after a response it didn't print", () => {
    const { page, logged } = watch();

    page.answerThenCancel(404, {});
    page.answerThenCancel(200, { "content-type": "text/javascript" });

    assert.deepEqual(logged, [`Failed module response at ${AT}: 404 no content type ${ADDRESS}`, `Failed module request at ${AT}: net::ERR_ABORTED ${ADDRESS}`]);
  });

  it("prints a module answered with a success whose type the browser won't run as JavaScript", () => {
    const { page, logged } = watch();

    page.answer("script", 200, { "content-type": "text/html; charset=utf-8" });

    assert.deepEqual(logged, [`Failed module response at ${AT}: 200 text/html; charset=utf-8 ${ADDRESS}`]);
  });

  it("prints nothing for a module answered with JavaScript in any listed form, with a redirect, or with a cached copy", () => {
    const { page, logged } = watch();

    page.answer("script", 200, { "content-type": "text/javascript" });
    page.answer("script", 200, { "content-type": " Application/JavaScript ; charset=utf-8" });
    page.answer("script", 200, { "content-type": "text/x-ecmascript" });
    page.answer("script", 302, { "content-type": "text/html" });
    page.answer("script", 304, {});

    assert.deepEqual(logged, []);
  });

  it("prints nothing for a request that is not a module's, such as a fetch or a font, whether it fails or is answered with an error", () => {
    const { page, logged } = watch();

    page.fail("fetch", "net::ERR_ABORTED");
    page.fail("font", "net::ERR_ABORTED");
    page.answer("fetch", 404, { "content-type": "text/html" });
    page.answer("font", 200, { "content-type": "font/woff2" });

    assert.deepEqual(logged, []);
  });

  it("listens on a page once, however often the page calls it", () => {
    const { recorder, page, logged } = watch();

    recorder.watch(contextOf(page, logged));
    page.fail("script", "net::ERR_ABORTED");
    page.answer("script", 404, {});

    assert.deepEqual([...page.listeners.values()].map(t => t.length), [1, 1, 1, 1]);
    assert.equal(logged.length, 2);
  });
  it("prints a request of any type still open 10 s after it started once, with its start and every other open request, oldest first, and how long each has been open", () => {
    const { page, logged } = watch();

    page.open("stylesheet", STYLES);
    mock.timers.tick(2_000);
    page.open("script", CHUNK);
    mock.timers.tick(1_000);
    page.open("fetch", SPEC);
    mock.timers.tick(6_000);

    assert.deepEqual(logged, []);

    for (let second = 0; second < 4; second++)
      mock.timers.tick(1_000);

    assert.deepEqual(logged, [
      `Stalled request at ${at(10_000)}: stylesheet ${STYLES} open 10.0 s since ${AT}; 2 other requests open, oldest first: script ${CHUNK} open 8.0 s, fetch ${SPEC} open 7.0 s`,
      `Stalled request at ${at(12_000)}: script ${CHUNK} open 10.0 s since ${at(2_000)}; 2 other requests open, oldest first: stylesheet ${STYLES} open 12.0 s, fetch ${SPEC} open 9.0 s`,
      `Stalled request at ${at(13_000)}: fetch ${SPEC} open 10.0 s since ${at(3_000)}; 2 other requests open, oldest first: stylesheet ${STYLES} open 13.0 s, script ${CHUNK} open 11.0 s`
    ]);
  });

  it("lists the 20 oldest other open requests and counts the rest", () => {
    const { page, logged } = watch();

    page.open("stylesheet", STYLES);
    mock.timers.tick(1_000);
    for (let i = 0; i < 22; i++)
      page.open("script", `${CHUNK}?v=${i}`);
    mock.timers.tick(9_000);

    const listed = Array.from({ length: 20 }, (_, i) => `script ${CHUNK}?v=${i} open 9.0 s`).join(", ");
    assert.deepEqual(logged, [`Stalled request at ${at(10_000)}: stylesheet ${STYLES} open 10.0 s since ${AT}; 22 other requests open, oldest first: ${listed}, and 2 more`]);
  });

  it("gives back only its failure lines, not the stall lines it printed", () => {
    const { recorder, page, logged } = watch();

    page.open("stylesheet", STYLES);
    mock.timers.tick(10_000);
    page.fail("script", "net::ERR_CONNECTION_REFUSED", CHUNK);

    const failed = `Failed module request at ${at(10_000)}: net::ERR_CONNECTION_REFUSED ${CHUNK}`;
    assert.equal(logged.length, 2);
    assert.deepEqual(recorder.watch(contextOf(page, [])), [failed]);
  });

  it("prints the run's first 20 stalls, their ends alone, and once the run closes how many more it didn't print", () => {
    const { page, logged, closes } = watch();

    const requests = Array.from({ length: 23 }, (_, i) => page.open("script", `${CHUNK}?v=${i}`));
    mock.timers.tick(10_000);
    mock.timers.tick(1_000);
    for (const request of requests)
      page.finish(request);
    for (const close of closes)
      close();

    const stalls = logged.filter(t => t.startsWith("Stalled request at "));
    assert.deepEqual(stalls.map(t => t.split(" ")[5]), Array.from({ length: 20 }, (_, i) => `${CHUNK}?v=${i}`));
    assert.equal(logged.filter(t => t.startsWith("Stalled request ended at ")).length, 20);
    assert.equal(logged.at(-1), "Stalled requests not printed, past the first 20: 3");
  });

  it("says nothing of unprinted stalls when the run closes after 20 or fewer", () => {
    const { page, logged, closes } = watch();

    page.open("stylesheet", STYLES);
    mock.timers.tick(10_000);
    for (const close of closes)
      close();

    assert.equal(logged.length, 1);
  });

  it("says no other request is open when the stalled one is alone", () => {
    const { page, logged } = watch();

    page.open("stylesheet", STYLES);
    mock.timers.tick(10_000);

    assert.deepEqual(logged, [`Stalled request at ${at(10_000)}: stylesheet ${STYLES} open 10.0 s since ${AT}; 0 other requests open`]);
  });

  it("prints nothing for a request that finishes or fails within 10 s, and leaves it out of a later stall's open requests", () => {
    const { page, logged } = watch();

    const finished = page.open("stylesheet", STYLES);
    const failed = page.open("fetch", SPEC, "net::ERR_ABORTED");
    page.open("script", CHUNK);
    mock.timers.tick(9_000);
    page.finish(finished);
    page.failOpen(failed);
    mock.timers.tick(1_000);

    assert.deepEqual(logged, [`Stalled request at ${at(10_000)}: script ${CHUNK} open 10.0 s since ${AT}; 0 other requests open`]);
  });

  it("prints when a stalled request finishes or fails, with how and after how long", () => {
    const { page, logged } = watch();

    const finished = page.open("stylesheet", STYLES);
    const failed = page.open("script", CHUNK, "net::ERR_CONNECTION_REFUSED");
    mock.timers.tick(10_000);
    logged.length = 0;
    mock.timers.tick(20_500);
    page.finish(finished);
    page.failOpen(failed);

    assert.deepEqual(logged, [
      `Stalled request ended at ${at(30_500)}: finished after 30.5 s, stylesheet ${STYLES}`,
      `Stalled request ended at ${at(30_500)}: failed, net::ERR_CONNECTION_REFUSED after 30.5 s, script ${CHUNK}`,
      `Failed module request at ${at(30_500)}: net::ERR_CONNECTION_REFUSED ${CHUNK}`
    ]);
  });

  it("checks for stalls with one timer for every page, and stops checking when the run closes", () => {
    const { recorder, page, logged, closes } = watch();
    const second = new FakePage();
    recorder.watch(contextOf(second, logged, closes));

    assert.equal(closes.length, 1);

    second.open("stylesheet", STYLES);
    page.open("script", CHUNK);
    closes[0]?.();
    mock.timers.tick(20_000);

    assert.deepEqual(logged, []);
  });
});
