/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Interface, createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { Event } from "@noldova/desktop.protocol";

import type { ICliCommandConsole } from "../interfaces/i-cli-command-console.js";
import { Resources } from "../resources.js";

export class CliCommandConsole implements ICliCommandConsole, Disposable {
  private readonly lines: Writable;
  private readonly prompts: Writable | null;
  private readonly input: Readable;
  private readonly listeners: Map<string, Set<(payload: JsonValue) => void>> = new Map();
  private readonly pendingLines: string[] = [];
  private readonly waiting: PromiseWithResolvers<string | null>[] = [];
  private reader: Interface | null = null;
  private hasEnded: boolean = false;
  private isAborted: boolean = false;

  public constructor(lines: Writable, prompts: Writable | null, input: Readable) {
    this.lines = lines;
    this.prompts = prompts;
    this.input = input;
  }

  public writeLine(text: string): void {
    this.lines.write(`${text}${Resources.lineEnd}`);
  }

  public askAsync(prompt: string): Promise<string | null> {
    if (this.isAborted)
      return Promise.resolve(null);
    this.prompts?.write(prompt);
    this.reader ??= this.read();
    const pending = this.pendingLines.shift();
    if (!Object.isUndefined(pending))
      return Promise.resolve(pending);
    if (this.hasEnded)
      return Promise.resolve(null);
    const waiting = Promise.withResolvers<string | null>();
    this.waiting.push(waiting);
    return waiting.promise;
  }

  public onEvent(name: string, listener: (payload: JsonValue) => void): Disposable {
    const listeners = this.listeners.get(name) ?? new Set<(payload: JsonValue) => void>();
    this.listeners.set(name, listeners);
    listeners.add(listener);
    return { [Symbol.dispose]: () => listeners.delete(listener) };
  }

  public receive(event: Event): void {
    for (const listener of [...this.listeners.get(event.name.text) ?? []])
      listener(event.payload);
  }

  public abort(): void {
    this.isAborted = true;
    this.end();
  }

  public [Symbol.dispose](): void {
    this.abort();
    this.listeners.clear();
  }

  private read(): Interface {
    const reader = createInterface({ input: this.input, terminal: false });
    reader.on(Resources.lineEvent, (line: string) => this.receiveLine(line));
    reader.on(Resources.closeEvent, () => this.end());
    return reader;
  }

  private receiveLine(line: string): void {
    const waiting = this.waiting.shift();
    if (Object.isUndefined(waiting))
      this.pendingLines.push(line);
    else
      waiting.resolve(line);
  }

  private end(): void {
    if (this.hasEnded)
      return;
    this.hasEnded = true;
    this.reader?.close();
    for (const waiting of this.waiting.splice(0))
      waiting.resolve(null);
  }
}
