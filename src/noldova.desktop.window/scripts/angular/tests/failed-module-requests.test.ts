/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import "@noldova/context.core";

import { FailedModuleRequests } from "../failed-module-requests.ts";
import type { IBrowserCommandContext } from "../interfaces/i-browser-command-context.ts";
import type { IBrowserPage } from "../interfaces/i-browser-page.ts";
import type { IBrowserRequest } from "../interfaces/i-browser-request.ts";
import type { IBrowserResponse } from "../interfaces/i-browser-response.ts";
import type { IFailedRequest } from "../interfaces/i-failed-request.ts";
import type { IVitestLogger } from "../interfaces/i-vitest-logger.ts";
import type { IVitestPluginContext } from "../interfaces/i-vitest-plugin-context.ts";
import type { IVitestRun } from "../interfaces/i-vitest-run.ts";
import { MemorySummary } from "../memory-summary.ts";
import { SocketSummary } from "../socket-summary.ts";

const NOW = Date.UTC(2026, 10, 16, 5, 40, 41, 619);
const AT = "2026-11-16T05:40:41.619Z";
const ADDRESS = "http://localhost:63315/@fs/a.spec.ts?import";

class FakeFailure implements IFailedRequest {
  public readonly errorText: string;

  public constructor(errorText: string) {
    this.errorText = errorText;
  }
}

class FakeEvent implements IBrowserRequest, IBrowserResponse {
  private readonly address: string;
  private readonly type: string;
  private readonly errorText: string | null;
  private readonly code: number;
  private readonly fields: Record<string, string>;

  public constructor(address: string, type: string, errorText: string | null, code: number, fields: Record<string, string>) {
    this.address = address;
    this.type = type;
    this.errorText = errorText;
    this.code = code;
    this.fields = fields;
  }

  public url(): string {
    return this.address;
  }

  public resourceType(): string {
    return this.type;
  }

  public failure(): IFailedRequest | null {
    return Object.isNull(this.errorText) ? null : new FakeFailure(this.errorText);
  }

  public status(): number {
    return this.code;
  }

  public headers(): Record<string, string> {
    return this.fields;
  }

  public request(): IBrowserRequest {
    return this;
  }
}

class FakePage implements IBrowserPage {
  public readonly listeners: Map<string, ((value: FakeEvent) => void)[]> = new Map();

  public on(event: string, listener: (value: FakeEvent) => void): this {
    this.listeners.set(event, [...this.listeners.get(event) ?? [], listener]);
    return this;
  }

  public fail(resourceType: string, errorText: string | null, url: string = ADDRESS): void {
    this.emit("requestfailed", new FakeEvent(url, resourceType, errorText, 0, {}));
  }

  public answer(resourceType: string, status: number, headers: Record<string, string>, url: string = ADDRESS): void {
    this.emit("response", new FakeEvent(url, resourceType, null, status, headers));
  }

  public open(resourceType: string, url: string, errorText: string | null = null): FakeEvent {
    const event = new FakeEvent(url, resourceType, errorText, 0, {});
    this.emit("request", event);
    return event;
  }

  public finish(event: FakeEvent): void {
    this.emit("requestfinished", event);
  }

  public failOpen(event: FakeEvent): void {
    this.emit("requestfailed", event);
  }

  public answerThenCancel(status: number, headers: Record<string, string>): void {
    const event = new FakeEvent(ADDRESS, "script", "net::ERR_ABORTED", status, headers);
    this.emit("response", event);
    this.emit("requestfailed", event);
  }

  private emit(name: string, value: FakeEvent): void {
    for (const listener of this.listeners.get(name) ?? [])
      listener(value);
  }
}

class FakeLogger implements IVitestLogger {
  private readonly logged: string[];

  public constructor(logged: string[]) {
    this.logged = logged;
  }

  public log(message: string): void {
    this.logged.push(message);
  }
}

class FakeRun implements IVitestRun {
  public readonly logger: IVitestLogger;
  private readonly closes: (() => void)[];

  public constructor(logged: string[], closes: (() => void)[]) {
    this.logger = new FakeLogger(logged);
    this.closes = closes;
  }

  public onClose(listener: () => void): void {
    this.closes.push(listener);
  }
}

class FakeProject implements IVitestPluginContext {
  public readonly vitest: IVitestRun;

  public constructor(vitest: IVitestRun) {
    this.vitest = vitest;
  }
}

class FakeContext implements IBrowserCommandContext {
  public readonly page: IBrowserPage;
  public readonly project: IVitestPluginContext;

  public constructor(page: FakePage, logged: string[], closes: (() => void)[]) {
    this.page = page;
    this.project = new FakeProject(new FakeRun(logged, closes));
  }
}

class WatchedPage {
  public readonly recorder: FailedModuleRequests = new FailedModuleRequests();
  public readonly page: FakePage = new FakePage();
  public readonly logged: string[] = [];
  public readonly closes: (() => void)[] = [];

  public constructor() {
    this.recorder.watch(new FakeContext(this.page, this.logged, this.closes));
  }
}

const contextOf = (page: FakePage, logged: string[], closes: (() => void)[] = []): FakeContext => new FakeContext(page, logged, closes);

const watch = (): WatchedPage => new WatchedPage();

const CONNECTIONS = [
  "",
  "Active Connections",
  "",
  "  Proto  Local Address          Foreign Address        State           PID",
  "  TCP    127.0.0.1:63315        0.0.0.0:0              LISTENING       5120",
  "  TCP    127.0.0.1:63315        127.0.0.1:50123        ESTABLISHED     5120",
  "  TCP    127.0.0.1:50123        127.0.0.1:63315        ESTABLISHED     7300",
  "  TCP    10.1.0.4:52000         20.60.1.2:443          ESTABLISHED     7300",
  "  TCP    127.0.0.1:63315        127.0.0.1:50124        TIME_WAIT       0",
  "  TCP    127.0.0.1:51000        127.0.0.1:443          TIME_WAIT       0",
  ""
].join("\r\n");

const PORT_RANGE = "\r\nProtocol tcp Dynamic Port Range\r\n---------------------------------\r\nStart Port      : 49152\r\nNumber of Ports : 16384\r\n";

const MEMORY = [
  "",
  "\"(PDH-CSV 4.0)\",\"\\\\HOST\\Memory\\Pool Nonpaged Bytes\",\"\\\\HOST\\Process(node)\\Handle Count\",\"\\\\HOST\\Process(node)\\Working Set\"",
  "\"11/16/2026 05:40:44.119\",\"157286400.000000\",\"640.000000\",\"209715200.000000\"",
  "Exiting, please wait...",
  "The command completed successfully.",
  ""
].join("\r\n");

const LISTINGS: ReadonlyMap<string, string> = new Map([["netstat", CONNECTIONS], ["netsh", PORT_RANGE], ["typeperf", MEMORY]]);

const SOCKET_STATE = "6 TCP sockets, ESTABLISHED 3, TIME_WAIT 2, LISTENING 1; to or from port 63315: ESTABLISHED 2, LISTENING 1, TIME_WAIT 1; "
  + "most held outside TIME_WAIT by process 5120 (2), 7300 (2); dynamic ports from 49152, 16384 of them";

const MEMORY_STATE = "non-paged pool 150.0 MB; node 1 process, 640 handles, 200.0 MB working set";

const listed = (command: string): string => LISTINGS.get(command) ?? String.empty;

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

  it("prints the socket and memory state after a module request that fails for want of buffer space or ports, with how long after the request started, summed up from what Windows lists", t => {
    t.mock.property(process, "platform", "win32");
    t.mock.method(childProcess, "execFileSync", listed);
    const { recorder, page, logged } = watch();
    const failed = page.open("script", CHUNK, "net::ERR_NO_BUFFER_SPACE");
    mock.timers.tick(2_500);

    page.failOpen(failed);

    const line = `Failed module request at ${at(2_500)}: net::ERR_NO_BUFFER_SPACE ${CHUNK}`;
    assert.deepEqual(logged, [line, `Socket state at ${at(2_500)}, 2.5 s after it started at ${AT}: ${SOCKET_STATE}`, `Memory state at ${at(2_500)}: ${MEMORY_STATE}`]);
    assert.deepEqual(recorder.watch(contextOf(page, [])), [line]);
  });

  it("prints a socket state whose listing ran out of time as unread, with why, and still the memory state", t => {
    t.mock.property(process, "platform", "win32");
    t.mock.method(childProcess, "execFileSync", (command: string) => {
      if (command === "netsh")
        throw new Error("spawnSync netsh ETIMEDOUT");
      return listed(command);
    });
    const { page, logged } = watch();

    page.fail("script", "net::ERR_NO_BUFFER_SPACE", CHUNK);

    assert.deepEqual(logged.slice(1), [`Socket state at ${AT}, its start unseen: unread, Reading netsh failed: spawnSync netsh ETIMEDOUT`, `Memory state at ${AT}: ${MEMORY_STATE}`]);
  });

  it("prints the socket and memory state as unread off Windows, with why", t => {
    t.mock.property(process, "platform", "linux");
    const { page, logged } = watch();

    page.fail("script", "net::ERR_NO_BUFFER_SPACE", CHUNK);

    assert.deepEqual(logged.slice(1), [`Socket state at ${AT}, its start unseen: unread, Socket state is read on Windows only.`, `Memory state at ${AT}: unread, Socket state is read on Windows only.`]);
  });

  it("reads the socket and memory state for the first such failure alone, saying when its request's start went unseen, and counts the later ones when the run closes", t => {
    t.mock.property(process, "platform", "win32");
    const read = t.mock.method(childProcess, "execFileSync", listed);
    const { page, logged, closes } = watch();

    page.fail("script", "net::ERR_INSUFFICIENT_RESOURCES", CHUNK);
    page.fail("script", "net::ERR_ADDRESS_IN_USE", CHUNK);
    page.fail("script", "net::ERR_NO_BUFFER_SPACE", CHUNK);
    for (const close of closes)
      close();

    const prefix = `Socket state at ${AT}, its start unseen: `;
    assert.deepEqual(logged.filter(u => u.startsWith("Socket")), [`${prefix}${SOCKET_STATE}`, "Socket errors after the first, their state unread: 2"]);
    assert.equal(logged.filter(u => u.startsWith("Memory state at")).length, 1);
    assert.deepEqual(read.mock.calls.map(u => u.arguments[0]), ["netstat", "netsh", "typeperf"]);
  });

  it("lets a failure other than an unread socket state out of the listener rather than print it as unread", t => {
    t.mock.property(process, "platform", "win32");
    t.mock.method(childProcess, "execFileSync", () => String.empty);
    t.mock.method(SocketSummary, "format", () => {
      throw new RangeError("summary broke");
    });
    const { page, logged } = watch();

    assert.throws(() => page.fail("script", "net::ERR_NO_BUFFER_SPACE", CHUNK), RangeError);
    assert.deepEqual(logged.filter(u => u.startsWith("Socket")), []);
  });

  it("lets a failure other than an unread memory state out of the listener rather than print it as unread", t => {
    t.mock.property(process, "platform", "win32");
    t.mock.method(childProcess, "execFileSync", () => String.empty);
    t.mock.method(MemorySummary, "format", () => {
      throw new RangeError("summary broke");
    });
    const { page, logged } = watch();

    assert.throws(() => page.fail("script", "net::ERR_NO_BUFFER_SPACE", CHUNK), RangeError);
    assert.deepEqual(logged.filter(u => u.startsWith("Memory")), []);
  });

  it("reads no socket state for a module request that fails otherwise, such as refused or cancelled, and counts none when the run closes", () => {
    const { page, logged, closes } = watch();

    page.fail("script", "net::ERR_CONNECTION_REFUSED", CHUNK);
    page.fail("script", "net::ERR_ABORTED", CHUNK);
    for (const close of closes)
      close();

    assert.deepEqual(logged.filter(t => t.startsWith("Socket")), []);
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
