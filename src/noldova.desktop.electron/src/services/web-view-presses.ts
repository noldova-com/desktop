/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class WebViewPresses {
  private relayed: number = 0;
  private count: number = 0;
  private frames: ReadonlyMap<string, readonly [number | null, number, string | null]> = new Map();
  private open: readonly string[] = [];
  private touches: readonly number[] = [];

  public addRelayed(presses: number): void {
    this.relayed += presses;
  }

  public addRelayedTouches(ids: readonly number[]): void {
    this.touches = [...this.touches, ...ids].slice(-Resources.relayedTouchLimit);
  }

  public note(frame: string, origin: string | null, kind: unknown, stamp: unknown, isRelayRunning: boolean, touches: unknown = []): void {
    if (kind === Resources.pressEndKind) {
      this.open = this.open.filter(t => t !== frame);
      return;
    }
    const last = this.frames.get(frame);
    if (kind === Resources.pressResumeKind && !Object.isUndefined(last))
      return this.openFrame(frame, [last[0], last[1], origin]);
    if (kind !== Resources.pressStartKind || !Number.isFinite(stamp))
      return;
    if (!Object.isUndefined(last) && last[1] === stamp)
      return this.openFrame(frame, [last[0], last[1], origin]);
    const ids: readonly unknown[] = Array.isArray(touches) ? touches : [];
    const isTouchRelayed = this.touches.some(t => ids.includes(t));
    this.touches = this.touches.filter(t => !ids.includes(t));
    const isCounted = !isTouchRelayed && this.relayed > 0;
    const isRelayed = isCounted || isTouchRelayed || isRelayRunning;
    if (isCounted)
      this.relayed -= 1;
    if (!isRelayed)
      this.count += 1;
    this.openFrame(frame, [isRelayed ? null : this.count, Number(stamp), origin]);
  }

  public read(origin: string | null): number | null {
    const handling = Object.isNull(origin) ? undefined : this.open.findLast(t => this.frames.get(t)?.[2] === origin);
    return Object.isUndefined(handling) ? null : this.frames.get(handling)?.[0] ?? null;
  }

  public forget(): void {
    this.relayed = 0;
    this.touches = [];
    this.frames = new Map();
    this.open = [];
  }

  private openFrame(frame: string, press: readonly [number | null, number, string | null]): void {
    const kept = [...this.frames].filter(([key]) => key !== frame).slice(1 - Resources.pressFrameLimit);
    this.frames = new Map([...kept, [frame, press]]);
    this.open = [...this.open.filter(t => t !== frame && this.frames.has(t)), frame];
  }
}
