/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Socket } from "node:net";

import "@noldova/context.core";
import { FailureCode, FrameReader, FrameWriter, type WireMessage, WireDecoder } from "@noldova/desktop.protocol";

import { SessionState } from "../../enums/session-state.js";
import type { ISessionListener } from "../../interfaces/i-session-listener.js";
import { Resources } from "../../resources.js";

export class ClientSession {
  private readonly listener: ISessionListener;
  private readonly reader: FrameReader;
  private readonly writer: FrameWriter;
  private readonly decoder: WireDecoder = new WireDecoder();
  private readonly requests: Map<string, AbortController> = new Map();
  private readonly requestWindows: Map<string, number> = new Map();
  private readonly closedWindows: Set<number> = new Set();
  private currentState: SessionState = SessionState.AwaitingHandshake;
  private clientName: string = String.empty;

  public readonly connection: number;
  public readonly socket: Socket;

  public constructor(socket: Socket, connection: number, maximumFrameLength: number, listener: ISessionListener) {
    this.socket = socket;
    this.connection = connection;
    this.listener = listener;
    this.reader = new FrameReader(maximumFrameLength);
    this.writer = new FrameWriter(maximumFrameLength);
    socket.setEncoding(Resources.utf8Encoding);
    socket.on(Resources.dataEvent, (chunk: string) => this.receive(chunk));
    socket.on(Resources.errorEvent, () => socket.destroy());
    socket.on(Resources.closeEvent, () => this.handleClosed());
  }

  public get state(): SessionState {
    return this.currentState;
  }

  public get client(): string {
    return this.clientName;
  }

  public get isOpen(): boolean {
    return this.currentState !== SessionState.Closed;
  }

  public enter(state: SessionState, client: string): void {
    this.currentState = state;
    this.clientName = client;
  }

  public send(message: WireMessage): void {
    this.write(this.writer.write(message));
  }

  public write(frame: string): void {
    if (this.isOpen)
      this.socket.write(frame);
  }

  public hasRequest(id: string): boolean {
    return this.requests.has(id);
  }

  public trackRequest(id: string, controller: AbortController, window: number | null = null): void {
    this.requests.set(id, controller);
    if (!Object.isNull(window))
      this.requestWindows.set(id, window);
  }

  public releaseRequest(id: string): void {
    this.requests.delete(id);
    this.requestWindows.delete(id);
  }

  public cancelRequest(id: string, reason: unknown): void {
    this.requests.get(id)?.abort(reason);
  }

  public closeWindow(window: number): boolean {
    if (this.closedWindows.has(window))
      return false;
    this.closedWindows.add(window);
    for (const [id, owner] of this.requestWindows)
      if (owner === window)
        this.cancelRequest(id, FailureCode.Cancelled);
    return true;
  }

  public hasClosedWindow(window: number): boolean {
    return this.closedWindows.has(window);
  }

  public end(): void {
    this.currentState = SessionState.Closed;
    this.socket.end();
  }

  public close(): void {
    this.socket.destroy();
  }

  private receive(chunk: string): void {
    let frames: string[];
    try {
      frames = this.reader.read(chunk);
    }
    catch (error) {
      this.listener.onInvalidFrame(this, error);
      return;
    }

    for (const frame of frames) {
      if (!this.isOpen)
        return;
      let message: WireMessage;
      try {
        message = this.decoder.decode(frame);
      }
      catch (error) {
        this.listener.onInvalidFrame(this, error);
        continue;
      }
      this.listener.onMessage(this, message);
    }
  }

  private handleClosed(): void {
    this.currentState = SessionState.Closed;
    for (const controller of this.requests.values())
      controller.abort();
    this.requests.clear();
    this.listener.onClosed(this);
  }
}
