/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { ComponentPortal } from "@angular/cdk/portal";
import { Injectable, Injector, type Type, inject } from "@angular/core";

import "@noldova/context.core";
import { AnchoredOverlay, OverlayAlignment, OverlayAnchoring, OverlaySide } from "@noldova/ui.components.angular";

import { WindowPalette } from "../models/window-palette.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class WindowRowOverlayService {
  private readonly injector: Injector = inject(Injector);
  private readonly document: Document = inject(DOCUMENT);
  private overlay: AnchoredOverlay | null = null;
  private closeCurrent: (() => void) | null = null;

  public get isOpen(): boolean {
    return this.overlay?.isOpen ?? false;
  }

  public closeOpen(): void {
    this.closeCurrent?.();
  }

  public open<T>(component: Type<T>, injector: Injector, paneClass: string, startAt: ((row: Element) => number) | null = null): WindowPalette<T> | null {
    const row = this.document.querySelector(Resources.windowRowSelector);
    if (this.isOpen || Object.isNull(row))
      return null;
    const focused = this.document.activeElement;
    const returnFocus = focused instanceof HTMLElement ? focused : null;
    const overlay = new AnchoredOverlay(this.injector, paneClass);
    const closed = new Promise<void>(resolve => {
      overlay.detachments.subscribe(() => resolve());
    });
    const close = (): void => {
      if (this.overlay !== overlay)
        return;
      overlay.dispose();
      this.overlay = null;
      this.closeCurrent = null;
      if (returnFocus?.isConnected)
        returnFocus.focus();
    };
    overlay.outsidePointerEvents.subscribe(close);
    overlay.originLost.subscribe(close);
    overlay.keydownEvents.subscribe(event => {
      if (event.key !== Resources.escapeKey || event.defaultPrevented)
        return;
      event.preventDefault();
      close();
    });
    this.overlay = overlay;
    const cover = row.getBoundingClientRect().height;
    const anchoring = new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Center, Object.isNull(startAt) ? 0 : -cover);
    try {
      const ref = overlay.openComponent(new ComponentPortal(component, null, injector), row, anchoring, () => {
        const edges = row.getBoundingClientRect();
        const width = this.document.documentElement.clientWidth;
        return Object.isNull(startAt) ? new DOMRect(0, edges.top, width, edges.height) : new DOMRect(0, startAt(row), width, cover);
      });
      this.closeCurrent = close;
      return new WindowPalette(ref, closed, close, () => this.overlay === overlay);
    } catch (error) {
      overlay.dispose();
      this.overlay = null;
      throw error;
    }
  }
}
