/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { type Server, type Socket, createServer } from "node:net";

import "@noldova/context.core";

export class ProgramEndFixture implements AsyncDisposable {
  public static readonly HOST: string = "127.0.0.1";

  private readonly server: Server;
  private readonly connected: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly closed: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private socket: Socket | null = null;

  private constructor(server: Server) {
    this.server = server;
    server.once("connection", t => {
      this.socket = t;
      t.on("error", () => undefined);
      t.once("close", () => this.closed.resolve());
      t.resume();
      this.connected.resolve();
    });
  }

  public get port(): number {
    const address = this.server.address();
    return Object.isNull(address) || Object.isString(address) ? 0 : address.port;
  }

  public static async createAsync(): Promise<ProgramEndFixture> {
    const fixture = new ProgramEndFixture(createServer());
    fixture.server.listen(0, ProgramEndFixture.HOST);
    await once(fixture.server, "listening");
    return fixture;
  }

  public async connectedAsync(): Promise<void> {
    await this.connected.promise;
  }

  public async endedAsync(): Promise<void> {
    await this.connected.promise;
    await this.closed.promise;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    const closing = new Promise<void>(resolve => this.server.close(() => resolve()));
    this.socket?.destroy();
    await closing;
  }
}
