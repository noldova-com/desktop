/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IBrowserCommandContext } from "./interfaces/i-browser-command-context.ts";
import type { IBrowserPage } from "./interfaces/i-browser-page.ts";
import type { IBrowserRequest } from "./interfaces/i-browser-request.ts";
import type { IBrowserResponse } from "./interfaces/i-browser-response.ts";
import type { IVitestRun } from "./interfaces/i-vitest-run.ts";
import { MemorySummary } from "./memory-summary.ts";
import { OpenRequest } from "./open-request.ts";
import { SocketStateException } from "./socket-state.exception.ts";
import { SocketSummary } from "./socket-summary.ts";
import { WindowsSocketReader } from "./windows-socket.reader.ts";

export class FailedModuleRequests {
  private static readonly MODULE: string = "script";
  private static readonly NO_ERROR: string = "no network error given";
  private static readonly CONTENT_TYPE: string = "content-type";
  private static readonly NO_TYPE: string = "no content type";
  private static readonly PARAMETERS: RegExp = /;.*$/su;
  private static readonly FIRST_ERROR_STATUS: number = 400;
  private static readonly FIRST_REDIRECT_STATUS: number = 300;
  private static readonly FINISHED: string = "finished";
  private static readonly STALL_LIMIT: number = 10_000;
  private static readonly STALL_CHECK: number = 1_000;
  private static readonly MILLISECONDS_PER_SECOND: number = 1_000;
  private static readonly LISTED_OTHERS: number = 20;
  private static readonly PRINTED_STALLS: number = 20;
  private static readonly SOCKET_ERRORS: ReadonlySet<string> = new Set(["net::ERR_NO_BUFFER_SPACE", "net::ERR_INSUFFICIENT_RESOURCES", "net::ERR_ADDRESS_IN_USE"]);
  private static readonly JAVASCRIPT: ReadonlySet<string> = new Set(["application/ecmascript", "application/javascript", "application/x-ecmascript",
    "application/x-javascript", "text/ecmascript", "text/javascript", "text/javascript1.0", "text/javascript1.1", "text/javascript1.2",
    "text/javascript1.3", "text/javascript1.4", "text/javascript1.5", "text/jscript", "text/livescript", "text/x-ecmascript", "text/x-javascript"]);

  private readonly pages: WeakSet<IBrowserPage> = new WeakSet();
  private readonly lines: string[] = [];
  private readonly printedResponses: WeakSet<IBrowserRequest> = new WeakSet();
  private readonly openRequests: Map<IBrowserRequest, OpenRequest> = new Map();
  private readonly printedStalls: WeakSet<IBrowserRequest> = new WeakSet();
  private readonly countedStalls: WeakSet<IBrowserRequest> = new WeakSet();
  private readonly sockets: WindowsSocketReader = new WindowsSocketReader();
  private stallsPrinted: number = 0;
  private unprintedStalls: number = 0;
  private isSocketStateRead: boolean = false;
  private unreadSocketErrors: number = 0;
  private stallCheck: ReturnType<typeof setInterval> | null = null;

  public readonly watch: (context: IBrowserCommandContext) => readonly string[] = context => this.watchPage(context.page, context.project.vitest);

  private watchPage(page: IBrowserPage, run: IVitestRun): readonly string[] {
    if (!this.pages.has(page)) {
      this.pages.add(page);
      page.on("request", request => this.openRequests.set(request, new OpenRequest(request, Date.now())));
      page.on("requestfinished", request => this.endRequest(request, FailedModuleRequests.FINISHED, run));
      page.on("requestfailed", request => this.recordRequest(request, run));
      page.on("response", response => this.recordResponse(response, run));
    }
    if (Object.isNull(this.stallCheck)) {
      const check = setInterval(() => this.printStalls(run), FailedModuleRequests.STALL_CHECK).unref();
      this.stallCheck = check;
      run.onClose(() => {
        clearInterval(check);
        if (this.unprintedStalls > 0)
          this.log(`Stalled requests not printed, past the first ${FailedModuleRequests.PRINTED_STALLS}: ${this.unprintedStalls}`, run);
        if (this.unreadSocketErrors > 0)
          this.log(`Socket errors after the first, their state unread: ${this.unreadSocketErrors}`, run);
      });
    }
    return [...this.lines];
  }

  private recordRequest(request: IBrowserRequest, run: IVitestRun): void {
    const start = this.openRequests.get(request)?.started;
    this.endRequest(request, `failed, ${request.failure()?.errorText ?? FailedModuleRequests.NO_ERROR}`, run);
    if (request.resourceType() !== FailedModuleRequests.MODULE || this.printedResponses.has(request))
      return;
    const failure = request.failure();
    const error = Object.isNull(failure) ? FailedModuleRequests.NO_ERROR : failure.errorText;
    this.print(`Failed module request at ${new Date().toISOString()}: ${error} ${request.url()}`, run);
    if (!FailedModuleRequests.SOCKET_ERRORS.has(error))
      return;
    if (this.isSocketStateRead) {
      this.unreadSocketErrors++;
      return;
    }
    this.isSocketStateRead = true;
    this.log(this.socketState(request.url(), start), run);
    this.log(this.memoryState(), run);
  }

  private memoryState(): string {
    let state: string;
    try {
      state = MemorySummary.format(this.sockets.readMemory());
    }
    catch (error) {
      if (!(error instanceof SocketStateException))
        throw error;
      state = `unread, ${error.message}`;
    }
    return `Memory state at ${new Date().toISOString()}: ${state}`;
  }

  private socketState(url: string, start: number | undefined): string {
    const now = Date.now();
    const opened = Object.isUndefined(start) ? "its start unseen" : `${FailedModuleRequests.seconds(now - start)} s after it started at ${new Date(start).toISOString()}`;
    let state: string;
    try {
      state = SocketSummary.format(this.sockets.readConnections(), this.sockets.readPortRange(), Number(new URL(url).port));
    }
    catch (error) {
      if (!(error instanceof SocketStateException))
        throw error;
      state = `unread, ${error.message}`;
    }
    return `Socket state at ${new Date(now).toISOString()}, ${opened}: ${state}`;
  }

  private recordResponse(response: IBrowserResponse, run: IVitestRun): void {
    if (response.request().resourceType() !== FailedModuleRequests.MODULE)
      return;
    const status = response.status();
    const type = response.headers()[FailedModuleRequests.CONTENT_TYPE] ?? FailedModuleRequests.NO_TYPE;
    const isJavaScript = FailedModuleRequests.JAVASCRIPT.has(type.replace(FailedModuleRequests.PARAMETERS, String.empty).trim().toLowerCase());
    if (status < FailedModuleRequests.FIRST_ERROR_STATUS && (status >= FailedModuleRequests.FIRST_REDIRECT_STATUS || isJavaScript))
      return;
    this.printedResponses.add(response.request());
    this.print(`Failed module response at ${new Date().toISOString()}: ${status} ${type} ${response.url()}`, run);
  }

  private printStalls(run: IVitestRun): void {
    const now = Date.now();
    const open = [...this.openRequests.values()].sort((a, b) => a.started - b.started);
    for (const { request, started: start } of open) {
      if (now - start < FailedModuleRequests.STALL_LIMIT || this.countedStalls.has(request))
        continue;
      this.countedStalls.add(request);
      if (this.stallsPrinted === FailedModuleRequests.PRINTED_STALLS) {
        this.unprintedStalls++;
        continue;
      }
      this.stallsPrinted++;
      this.printedStalls.add(request);
      const others = open.filter(t => t.request !== request);
      const listed = others.slice(0, FailedModuleRequests.LISTED_OTHERS).map(t => `${t.request.resourceType()} ${t.request.url()} open ${FailedModuleRequests.seconds(now - t.started)} s`);
      const unlisted = others.length - listed.length;
      const list = listed.length === 0 ? String.empty : `, oldest first: ${listed.join(", ")}${unlisted === 0 ? String.empty : `, and ${unlisted} more`}`;
      this.log(`Stalled request at ${new Date(now).toISOString()}: ${request.resourceType()} ${request.url()} open ${FailedModuleRequests.seconds(now - start)} s since ${new Date(start).toISOString()}; ${others.length} other requests open${list}`, run);
    }
  }

  private endRequest(request: IBrowserRequest, end: string, run: IVitestRun): void {
    const start = this.openRequests.get(request)?.started;
    this.openRequests.delete(request);
    if (!Object.isUndefined(start) && this.printedStalls.has(request))
      this.log(`Stalled request ended at ${new Date().toISOString()}: ${end} after ${FailedModuleRequests.seconds(Date.now() - start)} s, ${request.resourceType()} ${request.url()}`, run);
  }

  private static seconds(milliseconds: number): string {
    return (milliseconds / FailedModuleRequests.MILLISECONDS_PER_SECOND).toFixed(1);
  }

  private print(line: string, run: IVitestRun): void {
    this.lines.push(line);
    this.log(line, run);
  }

  private log(line: string, run: IVitestRun): void {
    run.logger.log(line);
  }
}
