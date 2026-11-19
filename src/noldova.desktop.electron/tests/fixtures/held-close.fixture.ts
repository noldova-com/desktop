/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

type OpenCallback = (failure: NodeJS.ErrnoException | null, handle: number) => void;
type CloseCallback = (failure: NodeJS.ErrnoException | null) => void;

export class HeldCloseFixture implements Disposable {
  private readonly open: typeof fs.open = fs.open;
  private readonly close: typeof fs.close = fs.close;
  private readonly handles: Set<number> = new Set<number>();
  private readonly held: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly released: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private isArmed: boolean = false;
  private isHolding: boolean = false;

  public constructor(folder: string) {
    const { open, close } = this;
    const opening = (path: fs.PathLike, flags: fs.OpenMode, mode: fs.Mode | OpenCallback, callback?: OpenCallback): void => {
      const done = typeof mode === "function" ? mode : callback;
      const tracked: OpenCallback = (failure, handle) => {
        if (Object.isNull(failure) && String(path).startsWith(folder))
          this.handles.add(handle);
        done?.(failure, handle);
      };
      if (typeof mode === "function")
        open(path, flags, tracked);
      else
        open(path, flags, mode, tracked);
    };
    const closing = (handle: number, callback: CloseCallback): void => {
      const closeNow = (): void => close(handle, failure => {
        this.handles.delete(handle);
        callback(failure);
      });
      if (!this.handles.has(handle) || !this.isArmed || this.isHolding) {
        closeNow();
        return;
      }
      this.isHolding = true;
      this.held.resolve();
      void this.released.promise.then(closeNow);
    };
    Object.assign(fs, { open: opening, close: closing });
    syncBuiltinESMExports();
  }

  public get openCount(): number {
    return this.handles.size;
  }

  public holdNext(): void {
    this.isArmed = true;
  }

  public heldAsync(): Promise<void> {
    return this.held.promise;
  }

  public release(): void {
    this.released.resolve();
  }

  public [Symbol.dispose](): void {
    this.release();
    Object.assign(fs, { open: this.open, close: this.close });
    syncBuiltinESMExports();
  }
}
