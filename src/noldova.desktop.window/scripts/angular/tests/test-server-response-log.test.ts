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

import { TestServerResponseLog } from "../test-server-response-log.ts";

const servers: Server[] = [];

const startAsync = async (answer: (request: IncomingMessage, response: ServerResponse) => void, warnings: string[], onWarning: () => void, log: TestServerResponseLog = new TestServerResponseLog()): Promise<number> => {
  const server = createServer(answer);
  log.configureServer({ httpServer: server, config: { logger: { warn: message => { warnings.push(message); onWarning(); } } } });
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

describe("TestServerResponseLog", () => {
  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it("returns nothing from configureServer, so Vite runs no post hook though the server's on returns a function, and watches nothing without an HTTP server", () => {
    const log = new TestServerResponseLog();
    const listen = (): void => undefined;
    const returned: unknown = log.configureServer({ httpServer: { on: () => listen }, config: { logger: { warn: () => undefined } } });
    const withoutServer: unknown = log.configureServer({ httpServer: null, config: { logger: { warn: () => undefined } } });

    assert.deepEqual([returned, withoutServer], [undefined, undefined]);
    assert.match(log.summary, /^The response log watched 0 requests to the test server, 0 of them for fonts/u);
  });

  it("reports at the run's close how many requests it watched and how many of them were for fonts, 0 before any", async () => {
    const log = new TestServerResponseLog();
    const lines: string[] = [];
    let close: () => void = () => undefined;
    log.configureVitest({ vitest: { logger: { log: line => lines.push(line) }, onClose: listener => { close = listener; } } });
    const before = log.summary;
    const port = await startAsync((_incoming, response) => response.writeHead(200).end("x"), [], () => undefined, log);

    await getAsync(port, "/fonts/inter.woff2");
    await getAsync(port, "/fonts/inter.otf?v=2");
    await getAsync(port, "/setup.ts");
    close();

    assert.equal(before, "The response log watched 0 requests to the test server, 0 of them for fonts; 0 fonts means it is not attached to the server that serves the fonts.");
    assert.deepEqual(lines, ["The response log watched 3 requests to the test server, 2 of them for fonts; 0 fonts means it is not attached to the server that serves the fonts."]);
  });

  it("logs each request the server answers with a failure, a spec file's import as well as a font, and nothing for a file it serves", async () => {
    const warnings: string[] = [];
    let warned: () => void = () => undefined;
    const port = await startAsync((incoming, response) => {
      const status = incoming.url?.includes("/missing/") === true ? 404 : 200;
      response.writeHead(status).end("x");
    }, warnings, () => warned());

    const served = await getAsync(port, "/fonts/inter.woff2?v=1");
    const font = new Promise<void>(resolve => {
      warned = resolve;
    });
    const missing = await getAsync(port, "/missing/inter.woff2");
    await font;
    const spec = new Promise<void>(resolve => {
      warned = resolve;
    });
    const failed = await getAsync(port, "/@fs/D:/a/missing/window.spec.ts?import&browserv=1");
    await spec;

    assert.deepEqual([served, missing, failed], [200, 404, 404]);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0] ?? "", /^The test server answered GET \/missing\/inter\.woff2 with 404 after \d+ ms\.$/u);
    assert.match(warnings[1] ?? "", /^The test server answered GET \/@fs\/D:\/a\/missing\/window\.spec\.ts\?import&browserv=1 with 404 after \d+ ms\.$/u);
  });

  it("logs a request that closes before the server finishes its answer", async () => {
    const warnings: string[] = [];
    let warned: () => void = () => undefined;
    const logged = new Promise<void>(resolve => {
      warned = resolve;
    });
    const port = await startAsync((_incoming, response) => {
      response.writeHead(200);
      response.write("partial");
    }, warnings, () => warned());

    const client = request({ host: "127.0.0.1", port, path: "/@fs/D:/a/tests/window.spec.ts" }, response => {
      response.once("data", () => client.destroy());
    });
    client.once("error", () => undefined).end();
    await logged;

    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /^The request GET \/@fs\/D:\/a\/tests\/window\.spec\.ts closed after \d+ ms before the test server finished its answer, status 200, headers sent\.$/u);
  });
});
