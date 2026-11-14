/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { once } from "node:events";
import { type IncomingMessage, type Server, type ServerResponse, createServer, request } from "node:http";
import { afterEach, describe, it } from "node:test";

import "@noldova/context.core";

import { FontResponseLog } from "../font-response-log.ts";

type Handler = (request: IncomingMessage, response: ServerResponse, next: () => void) => void;

const servers: Server[] = [];

const startAsync = async (answer: (request: IncomingMessage, response: ServerResponse) => void, warnings: string[], onWarning: () => void, log: FontResponseLog = new FontResponseLog()): Promise<number> => {
  let middleware: Handler = (_request, _response, next) => next();
  log.configureServer({
    middlewares: { use: handler => { middleware = handler; } },
    config: { logger: { warn: message => { warnings.push(message); onWarning(); } } }
  });
  const server = createServer((incoming, response) => middleware(incoming, response, () => answer(incoming, response)));
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (Object.isNull(address) || Object.isString(address))
    throw new Error("The test server is not listening on a port.");
  return address.port;
};

const getAsync = (port: number, path: string): Promise<number> => new Promise((resolve, reject) => {
  request({ host: "127.0.0.1", port, path }, response => {
    response.resume();
    response.once("end", () => resolve(response.statusCode ?? 0));
  }).once("error", reject).end();
});

describe("FontResponseLog", () => {
  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it("returns nothing from configureServer, so Vite runs no post hook though the server's use returns its app", () => {
    const app = (): void => undefined;
    const returned: unknown = new FontResponseLog().configureServer({ middlewares: { use: () => app }, config: { logger: { warn: () => undefined } } });

    assert.equal(returned, undefined);
  });

  it("reports at the run's close how many font requests it watched, 0 before any, counting fonts only", async () => {
    const log = new FontResponseLog();
    const lines: string[] = [];
    let close: () => void = () => undefined;
    log.configureVitest({ vitest: { logger: { log: line => lines.push(line) }, onClose: listener => { close = listener; } } });
    const before = log.summary;
    const port = await startAsync((_incoming, response) => response.writeHead(200).end("x"), [], () => undefined, log);

    await getAsync(port, "/fonts/inter.woff2");
    await getAsync(port, "/fonts/inter.otf?v=2");
    await getAsync(port, "/setup.ts");
    close();

    assert.equal(before, "The font log watched 0 font requests to the test server; 0 means it is not attached to the server that serves the fonts.");
    assert.deepEqual(lines, ["The font log watched 2 font requests to the test server; 0 means it is not attached to the server that serves the fonts."]);
  });

  it("logs a font request the server answers with a failure, and nothing for a font it serves or another file it fails", async () => {
    const warnings: string[] = [];
    let warned: () => void = () => undefined;
    const port = await startAsync((incoming, response) => {
      const status = incoming.url?.startsWith("/missing") === true ? 404 : 200;
      response.writeHead(status).end("x");
    }, warnings, () => warned());

    const served = await getAsync(port, "/fonts/inter.woff2?v=1");
    const other = await getAsync(port, "/missing/setup.ts");
    const logged = new Promise<void>(resolve => {
      warned = resolve;
    });
    const missing = await getAsync(port, "/missing/inter.woff2");
    await logged;

    assert.deepEqual([served, other, missing], [200, 404, 404]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /^The test server answered the font request GET \/missing\/inter\.woff2 with 404 after \d+ ms\.$/u);
  });

  it("logs a font request that closes before the server finishes its answer", async () => {
    const warnings: string[] = [];
    let warned: () => void = () => undefined;
    const logged = new Promise<void>(resolve => {
      warned = resolve;
    });
    const port = await startAsync((_incoming, response) => {
      response.writeHead(200);
      response.write("partial");
    }, warnings, () => warned());

    const client = request({ host: "127.0.0.1", port, path: "/fonts/inter.ttf" }, response => {
      response.once("data", () => client.destroy());
    });
    client.once("error", () => undefined).end();
    await logged;

    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /^The font request GET \/fonts\/inter\.ttf closed after \d+ ms before the test server finished its answer, status 200, headers sent\.$/u);
  });
});
