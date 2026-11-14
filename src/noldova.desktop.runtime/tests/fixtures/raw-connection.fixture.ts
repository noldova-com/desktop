/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { type Socket, connect } from "node:net";

import "@noldova/context.core";
import { Event, Response, type WireMessage, WireDecoder } from "@noldova/desktop.protocol";
import type { Endpoint } from "@noldova/desktop.runtime";

export class RawConnectionFixture implements Disposable {
  private static readonly ANSWER_TIMEOUT: number = 10_000;

  private readonly socket: Socket;
  private readonly frames: string[] = [];
  private readonly closed: Promise<unknown>;
  private readonly ended: Promise<unknown>;
  private pending: string = String.empty;
  private arrival: PromiseWithResolvers<void> | null = null;

  private constructor(socket: Socket) {
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => this.receive(chunk));
    socket.on("error", () => socket.destroy());
    this.closed = once(socket, "close");
    this.ended = once(socket, "end");
    void this.ended.catch(() => undefined);
    socket.once("close", () => this.arrival?.resolve());
  }

  public static async connectAsync(endpoint: Endpoint, allowHalfOpen: boolean = false): Promise<RawConnectionFixture> {
    const socket = Object.isNull(endpoint.port)
      ? connect({ path: String(endpoint.path), allowHalfOpen })
      : connect({ port: endpoint.port, host: "127.0.0.1", allowHalfOpen });
    await once(socket, "connect");
    return new RawConnectionFixture(socket);
  }

  public get frameCount(): number {
    return this.frames.length;
  }

  public get isClosed(): boolean {
    return this.socket.closed;
  }

  public send(text: string): void {
    this.socket.write(text);
  }

  public sendMessages(...messages: WireMessage[]): void {
    this.socket.write(messages.map(t => `${t.toText()}\n`).join(String.empty));
  }

  public async readTextAsync(): Promise<string> {
    if (this.frames.length === 0 && !this.socket.closed) {
      const arrival = Promise.withResolvers<void>();
      this.arrival = arrival;
      const limit = setTimeout(() => arrival.resolve(), RawConnectionFixture.ANSWER_TIMEOUT);
      await arrival.promise;
      clearTimeout(limit);
      this.arrival = null;
    }
    const frame = this.frames.shift();
    if (Object.isUndefined(frame))
      throw new Error("No frame arrived.");
    return frame;
  }

  public async readResponseAsync(): Promise<Response> {
    const message = new WireDecoder().decode(await this.readTextAsync());
    if (!(message instanceof Response))
      throw new Error(`Expected a response, not ${message.toText()}.`);
    return message;
  }

  public async readEventAsync(): Promise<Event> {
    const message = new WireDecoder().decode(await this.readTextAsync());
    if (!(message instanceof Event))
      throw new Error(`Expected an event, not ${message.toText()}.`);
    return message;
  }

  public reset(): void {
    this.socket.resetAndDestroy();
  }

  public async waitForCloseAsync(): Promise<void> {
    await this.closed;
  }

  public async waitForEndAsync(): Promise<void> {
    await this.ended;
  }

  public [Symbol.dispose](): void {
    this.socket.destroy();
  }

  private receive(chunk: string): void {
    this.pending += chunk;
    let index = this.pending.indexOf("\n");
    while (index >= 0) {
      this.frames.push(this.pending.slice(0, index));
      this.pending = this.pending.slice(index + 1);
      index = this.pending.indexOf("\n");
    }
    if (this.frames.length > 0)
      this.arrival?.resolve();
  }
}
