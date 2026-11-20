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
import { NetLogTrace } from "./net-log-trace.ts";

export class FailedModuleRequests {
  private static readonly MODULE: string = "script";
  private static readonly NO_ERROR: string = "no network error given";
  private static readonly CONTENT_TYPE: string = "content-type";
  private static readonly NO_TYPE: string = "no content type";
  private static readonly PARAMETERS: RegExp = /;.*$/su;
  private static readonly FIRST_ERROR_STATUS: number = 400;
  private static readonly FIRST_REDIRECT_STATUS: number = 300;
  private static readonly JAVASCRIPT: ReadonlySet<string> = new Set(["application/ecmascript", "application/javascript", "application/x-ecmascript",
    "application/x-javascript", "text/ecmascript", "text/javascript", "text/javascript1.0", "text/javascript1.1", "text/javascript1.2",
    "text/javascript1.3", "text/javascript1.4", "text/javascript1.5", "text/jscript", "text/livescript", "text/x-ecmascript", "text/x-javascript"]);

  private readonly pages: WeakSet<IBrowserPage> = new WeakSet();
  private readonly lines: string[] = [];
  private readonly printedResponses: WeakSet<IBrowserRequest> = new WeakSet();
  private readonly trace: NetLogTrace = new NetLogTrace();
  private isWaitedForOnClose: boolean = false;

  public readonly watch: (context: IBrowserCommandContext) => readonly string[] = context => this.watchPage(context.page, context.project.vitest);

  private watchPage(page: IBrowserPage, run: IVitestRun): readonly string[] {
    this.trace.start(page);
    if (!this.isWaitedForOnClose) {
      this.isWaitedForOnClose = true;
      run.onClose(() => this.trace.flushedAsync());
    }
    if (!this.pages.has(page)) {
      this.pages.add(page);
      page.on("requestfailed", request => this.recordRequest(request, run));
      page.on("response", response => this.recordResponse(response, run));
    }
    return [...this.lines];
  }

  private recordRequest(request: IBrowserRequest, run: IVitestRun): void {
    if (request.resourceType() !== FailedModuleRequests.MODULE || this.printedResponses.has(request))
      return;
    const failure = request.failure();
    const error = Object.isNull(failure) ? FailedModuleRequests.NO_ERROR : failure.errorText;
    this.print(`Failed module request at ${new Date().toISOString()}: ${error} ${request.url()}`, run);
    if (error.startsWith("net::ERR_CONNECTION_") || error === "net::ERR_UNSAFE_PORT")
      void this.trace.save(new URL(request.url()).port, line => this.print(line, run));
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

  private print(line: string, run: IVitestRun): void {
    this.lines.push(line);
    run.logger.log(line);
  }
}
