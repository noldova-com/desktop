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
import type { IVitestRun } from "./interfaces/i-vitest-run.ts";

export class FailedModuleRequests {
  private static readonly MODULE: string = "script";
  private static readonly NO_ERROR: string = "no network error given";

  private readonly pages: WeakSet<IBrowserPage> = new WeakSet();
  private readonly lines: string[] = [];

  public readonly watch: (context: IBrowserCommandContext) => readonly string[] = context => this.watchPage(context.page, context.project.vitest);

  private watchPage(page: IBrowserPage, run: IVitestRun): readonly string[] {
    if (!this.pages.has(page)) {
      this.pages.add(page);
      page.on("requestfailed", request => this.record(request, run));
    }
    return [...this.lines];
  }

  private record(request: IBrowserRequest, run: IVitestRun): void {
    if (request.resourceType() !== FailedModuleRequests.MODULE)
      return;
    const failure = request.failure();
    const error = Object.isNull(failure) ? FailedModuleRequests.NO_ERROR : failure.errorText;
    const line = `Failed module request at ${new Date().toISOString()}: ${error} ${request.url()}`;
    this.lines.push(line);
    run.logger.log(line);
  }
}
