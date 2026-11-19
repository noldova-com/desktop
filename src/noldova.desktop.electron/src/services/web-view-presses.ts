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
  private frames: ReadonlyMap<string, readonly [number | null, number]> = new Map();
  private open: readonly string[] = [];

  public addRelayed(presses: number): void {
    this.relayed += presses;
  }

  public note(frame: string, kind: unknown, stamp: unknown, isRelayRunning: boolean): void {
    if (kind === Resources.pressEndKind) {
      this.open = this.open.filter(t => t !== frame);
      return;
    }
    const last = this.frames.get(frame);
    if (kind === Resources.pressResumeKind && !Object.isUndefined(last))
      return this.openFrame(frame);
    if (kind !== Resources.pressStartKind || !Number.isFinite(stamp))
      return;
    if (!Object.isUndefined(last) && last[1] === stamp)
      return this.openFrame(frame);
    const isRelayed = this.relayed > 0 || isRelayRunning;
    if (this.relayed > 0)
      this.relayed -= 1;
    if (!isRelayed)
      this.count += 1;
    const kept = [...this.frames].filter(([key]) => key !== frame).slice(1 - Resources.pressFrameLimit);
    this.frames = new Map([...kept, [frame, [isRelayed ? null : this.count, Number(stamp)]]]);
    this.openFrame(frame);
  }

  public read(): number | null {
    const handling = this.open.at(-1);
    return Object.isUndefined(handling) ? null : this.frames.get(handling)?.[0] ?? null;
  }

  public forget(): void {
    this.relayed = 0;
    this.frames = new Map();
    this.open = [];
  }

  private openFrame(frame: string): void {
    this.open = [...this.open.filter(t => t !== frame && this.frames.has(t)), frame];
  }
}
