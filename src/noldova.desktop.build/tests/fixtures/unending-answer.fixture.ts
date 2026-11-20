/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createServer, type Server, type ServerResponse } from "node:http";

import "@noldova/context.core";

export class UnendingAnswerFixture implements AsyncDisposable {
  public readonly url: string;
  private readonly server: Server;
  private hasClosed: boolean = false;

  private constructor(server: Server, url: string) {
    this.server = server;
    this.url = url;
  }

  public get isClosed(): boolean {
    return this.hasClosed;
  }

  public static async startAsync(status: number): Promise<UnendingAnswerFixture> {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    const port = Object.isNull(address) || Object.isString(address) ? 0 : address.port;
    const fixture = new UnendingAnswerFixture(server, `http://127.0.0.1:${port}`);
    server.on("request", (_request, response: ServerResponse) => fixture.answer(status, response));
    return fixture;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.server.closeAllConnections();
    this.server.close();
    await once(this.server, "close");
  }

  private answer(status: number, response: ServerResponse): void {
    response.on("close", () => {
      this.hasClosed = true;
    });
    response.writeHead(status, { "Content-Type": "text/plain" });
    response.write("partial");
  }
}
