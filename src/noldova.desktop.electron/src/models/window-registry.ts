/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { OpenWindow } from "../services/open-window.js";
import type { SenderPolicy } from "../services/sender-policy.js";
import { SenderInfo } from "./sender-info.js";
import { WindowPage } from "./window-page.js";

export class WindowRegistry {
  private readonly policy: SenderPolicy;
  private readonly windows: Map<number, OpenWindow> = new Map();
  private readonly pages: Map<number, WindowPage> = new Map();
  private nextPage: number = 1;

  public constructor(policy: SenderPolicy) {
    this.policy = policy;
  }

  public get size(): number {
    return this.windows.size;
  }

  public get all(): readonly OpenWindow[] {
    return [...this.windows.values()];
  }

  public get first(): OpenWindow | null {
    const [open] = this.windows.values();
    return open ?? null;
  }

  public get isAnyFocused(): boolean {
    return this.all.some(t => !t.window.isDestroyed() && t.window.isFocused());
  }

  public add(contentsId: number, open: OpenWindow): void {
    this.windows.set(contentsId, open);
  }

  public remove(contentsId: number): void {
    this.windows.delete(contentsId);
  }

  public find(contentsId: number): OpenWindow | null {
    return this.windows.get(contentsId) ?? null;
  }

  public findTrusted(event: IIpcEvent): OpenWindow | null {
    const frame = event.senderFrame;
    if (Object.isNull(frame) || !this.policy.isTrusted(new SenderInfo(frame.url, Object.isNull(frame.parent), event.sender.id)))
      return null;
    return this.find(event.sender.id);
  }

  public isLast(prompt: IQuitPrompt): boolean {
    return this.all.every(t => t === prompt);
  }

  public sendToAll(channel: string, ...values: unknown[]): void {
    for (const open of this.windows.values())
      if (!open.window.isDestroyed())
        open.window.webContents.send(channel, ...values);
  }

  public sendTo(contentsId: number, channel: string, ...values: unknown[]): void {
    const open = this.windows.get(contentsId);
    if (!Object.isUndefined(open) && !open.window.isDestroyed())
      open.window.webContents.send(channel, ...values);
  }

  public startPage(contentsId: number, id: string): WindowPage | null {
    const ended = this.pages.get(contentsId);
    if (ended?.id === id)
      return null;
    this.pages.set(contentsId, new WindowPage(id, this.nextPage++));
    ended?.end();
    return ended ?? null;
  }

  public endPage(contentsId: number): void {
    this.pages.get(contentsId)?.end();
    this.pages.delete(contentsId);
  }

  public findPage(contentsId: number): WindowPage | null {
    return this.pages.get(contentsId) ?? null;
  }

  public pageOf(contentsId: number, page: unknown): WindowPage | null {
    const id = Object.isString(page) ? page : null;
    const current = this.pages.get(contentsId);
    if (!Object.isUndefined(current))
      return current.id === id ? current : null;
    const started = new WindowPage(id, this.nextPage++);
    this.pages.set(contentsId, started);
    return started;
  }
}
