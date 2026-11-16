/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";

import "@noldova/context.core";

import type { IViteLogger } from "./interfaces/i-vite-logger.ts";
import type { IViteServer } from "./interfaces/i-vite-server.ts";
import type { IVitestPluginContext } from "./interfaces/i-vitest-plugin-context.ts";

export class TestServerResponseLog {
  private static readonly NAME: string = "noldova-test-server-response-log";
  private static readonly FONT: RegExp = /\.(?:woff2?|ttf|otf)(?:[?#]|$)/u;
  private static readonly FAILED_STATUS: number = 400;
  private static readonly REQUEST: "request" = "request";

  private watched: number = 0;
  private fonts: number = 0;

  public readonly name: string = TestServerResponseLog.NAME;
  public readonly configureServer: (server: IViteServer) => void = server => {
    server.httpServer?.on(TestServerResponseLog.REQUEST, (request, response) => this.watch(server.config.logger, request, response));
  };
  public readonly configureVitest: (context: IVitestPluginContext) => void = context => context.vitest.onClose(() => context.vitest.logger.log(this.summary));

  public get summary(): string {
    return `The response log watched ${this.watched} requests to the test server, ${this.fonts} of them for fonts; 0 fonts means it is not attached to the server that serves the fonts.`;
  }

  private watch(logger: IViteLogger, request: IncomingMessage, response: ServerResponse): void {
    const url = request.url ?? String.empty;
    this.watched += 1;
    if (TestServerResponseLog.FONT.test(url))
      this.fonts += 1;
    const started = performance.now();
    response.once("close", () => {
      const isFinished = response.writableFinished;
      if (isFinished && response.statusCode < TestServerResponseLog.FAILED_STATUS)
        return;
      const elapsed = Math.round(performance.now() - started);
      logger.warn(isFinished
        ? `The test server answered ${request.method} ${url} with ${response.statusCode} after ${elapsed} ms.`
        : `The request ${request.method} ${url} closed after ${elapsed} ms before the test server finished its answer, status ${response.statusCode}, headers ${response.headersSent ? "sent" : "not sent"}.`);
    });
  }
}
