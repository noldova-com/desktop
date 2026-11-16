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
import type { IBrowserPage } from "../interfaces/i-browser-page.ts";
import type { IBrowserRequest } from "../interfaces/i-browser-request.ts";

const NOW = Date.UTC(2026, 10, 16, 5, 40, 41, 619);

class FakePage implements IBrowserPage {
  public readonly listeners: ((request: IBrowserRequest) => void)[] = [];

  public on(_: "requestfailed", listener: (request: IBrowserRequest) => void): this {
    this.listeners.push(listener);
    return this;
  }

  public fail(url: string, resourceType: string, errorText: string | null): void {
    const request: IBrowserRequest = { url: () => url, resourceType: () => resourceType, failure: () => Object.isNull(errorText) ? null : { errorText } };
    for (const listener of this.listeners)
      listener(request);
  }
}

const watch = (): { recorder: FailedModuleRequests; page: FakePage; logged: string[] } => {
  const recorder = new FailedModuleRequests();
  const page = new FakePage();
  const logged: string[] = [];
  recorder.watch({ page, project: { vitest: { logger: { log: message => logged.push(message) }, onClose: () => undefined } } });
  return { recorder, page, logged };
};

describe("FailedModuleRequests", () => {
  beforeEach(() => mock.timers.enable({ apis: ["Date"], now: NOW }));

  afterEach(() => mock.timers.reset());

  it("prints a failed module request with when it failed, its network error and its URL, and gives it back", () => {
    const { recorder, page, logged } = watch();

    page.fail("http://localhost:63315/@fs/a.spec.ts?import", "script", "net::ERR_CONNECTION_RESET");

    const line = "Failed module request at 2026-11-16T05:40:41.619Z: net::ERR_CONNECTION_RESET http://localhost:63315/@fs/a.spec.ts?import";
    assert.deepEqual(logged, [line]);
    assert.deepEqual(recorder.watch({ page, project: { vitest: { logger: { log: () => undefined }, onClose: () => undefined } } }), [line]);
  });

  it("prints nothing for a failed request that is not a module's, such as a fetch or a font", () => {
    const { page, logged } = watch();

    page.fail("http://localhost:63315/a.json", "fetch", "net::ERR_ABORTED");
    page.fail("http://localhost:63315/a.woff2", "font", "net::ERR_ABORTED");

    assert.deepEqual(logged, []);
  });

  it("says no network error was given when the browser gives none", () => {
    const { page, logged } = watch();

    page.fail("http://localhost:63315/a.ts", "script", null);

    assert.deepEqual(logged, ["Failed module request at 2026-11-16T05:40:41.619Z: no network error given http://localhost:63315/a.ts"]);
  });

  it("listens on a page once, however often the page calls it", () => {
    const { recorder, page, logged } = watch();

    recorder.watch({ page, project: { vitest: { logger: { log: message => logged.push(message) }, onClose: () => undefined } } });
    page.fail("http://localhost:63315/a.ts", "script", "net::ERR_ABORTED");

    assert.equal(page.listeners.length, 1);
    assert.equal(logged.length, 1);
  });
});
