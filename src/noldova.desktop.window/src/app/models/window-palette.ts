/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef } from "@angular/core";

import type { IWindowPalette } from "../interfaces/i-window-palette.js";

export class WindowPalette<T> implements IWindowPalette<T> {
  private readonly end: () => void;
  private readonly isShown: () => boolean;

  public readonly componentRef: ComponentRef<T>;
  public readonly closed: Promise<void>;

  public constructor(componentRef: ComponentRef<T>, closed: Promise<void>, end: () => void, isShown: () => boolean) {
    this.componentRef = componentRef;
    this.closed = closed;
    this.end = end;
    this.isShown = isShown;
  }

  public get isOpen(): boolean {
    return this.isShown();
  }

  public close(): void {
    this.end();
  }
}
