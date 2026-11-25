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
import { Event, Request, Response, SecretAction, SecretAnswered, SecretCommand, ShellEvents, ShellMethods, type WireMessage, WireDecoder } from "@noldova/desktop.protocol";
import type { Endpoint } from "@noldova/desktop.runtime";

import { NoFrameException } from "../exceptions/no-frame.exception.js";
import { UnexpectedMessageException } from "../exceptions/unexpected-message.exception.js";

export class RawConnectionFixture implements Disposable {
  private static readonly ANSWER_TIMEOUT: number = 10_000;
  private static readonly DEVICE_CALL: string = "device:";

  private readonly socket: Socket;
  private readonly frames: string[] = [];
  private readonly closed: Promise<unknown>;
  private readonly ended: Promise<unknown>;
  private pending: string = String.empty;
  private arrival: PromiseWithResolvers<void> | null = null;
  private device: string | null = null;

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

  public answerDevice(device: string): void {
    this.device = device;
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
      throw new NoFrameException();
    return frame;
  }

  public async readResponseAsync(): Promise<Response> {
    const message = new WireDecoder().decode(await this.readTextAsync());
    if (!(message instanceof Response))
      throw new UnexpectedMessageException("a response", message.toText());
    return message;
  }

  public async readEventAsync(): Promise<Event> {
    const message = new WireDecoder().decode(await this.readTextAsync());
    if (!(message instanceof Event))
      throw new UnexpectedMessageException("an event", message.toText());
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
      const frame = this.pending.slice(0, index);
      if (!this.isDeviceExchange(frame))
        this.frames.push(frame);
      this.pending = this.pending.slice(index + 1);
      index = this.pending.indexOf("\n");
    }
    if (this.frames.length > 0)
      this.arrival?.resolve();
  }

  private isDeviceExchange(frame: string): boolean {
    if (Object.isNull(this.device))
      return false;
    const message = new WireDecoder().decode(frame);
    if (message instanceof Response)
      return message.id?.startsWith(RawConnectionFixture.DEVICE_CALL) === true;
    if (!(message instanceof Event) || !message.name.equals(ShellEvents.secretCommand))
      return false;
    const command = SecretCommand.fromJson(message.payload);
    if (command.action !== SecretAction.Device)
      return false;
    this.sendMessages(new Request(`${RawConnectionFixture.DEVICE_CALL}${String(command.call)}`, ShellMethods.secretAnswered,
      new SecretAnswered(command.call, this.device).toJson()));
    return true;
  }
}
