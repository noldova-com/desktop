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

export class FontResponseLog {
  private static readonly NAME: string = "noldova-font-response-log";
  private static readonly FONT: RegExp = /\.(?:woff2?|ttf|otf)(?:[?#]|$)/u;
  private static readonly FAILED_STATUS: number = 400;

  public readonly name: string = FontResponseLog.NAME;
  public readonly configureServer: (server: IViteServer) => void = server => {
    server.middlewares.use((request, response, next) => {
      FontResponseLog.watch(server.config.logger, request, response);
      next();
    });
  };

  private static watch(logger: IViteLogger, request: IncomingMessage, response: ServerResponse): void {
    const url = request.url ?? String.empty;
    if (!FontResponseLog.FONT.test(url))
      return;
    const started = performance.now();
    response.once("close", () => {
      const isFinished = response.writableFinished;
      if (isFinished && response.statusCode < FontResponseLog.FAILED_STATUS)
        return;
      const elapsed = Math.round(performance.now() - started);
      logger.warn(isFinished
        ? `The test server answered the font request ${request.method} ${url} with ${response.statusCode} after ${elapsed} ms.`
        : `The font request ${request.method} ${url} closed after ${elapsed} ms before the test server finished its answer, status ${response.statusCode}, headers ${response.headersSent ? "sent" : "not sent"}.`);
    });
  }
}
