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

const contextOf = (page: FakePage, logged: string[]): IBrowserCommandContext => ({ page, project: { vitest: { logger: { log: message => logged.push(message) }, onClose: () => undefined } } });

const watch = (): { recorder: FailedModuleRequests; page: FakePage; logged: string[] } => {
  const recorder = new FailedModuleRequests();
  const page = new FakePage();
  const logged: string[] = [];
  recorder.watch(contextOf(page, logged));
  return { recorder, page, logged };
};

describe("FailedModuleRequests", () => {
  beforeEach(() => mock.timers.enable({ apis: ["Date"], now: NOW }));

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

    assert.deepEqual([...page.listeners.values()].map(t => t.length), [1, 1]);
    assert.equal(logged.length, 2);
  });
});
