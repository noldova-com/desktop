/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Directive, ElementRef, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, inject, input, signal } from "@angular/core";

import { AppearanceService } from "@noldova/ui.components.angular";

import type { GroupFrame } from "../models/layout/group-frame.js";
import { Resources } from "../../resources.js";

@Directive({
  selector: "[nolTabScroller]",
  exportAs: "nolTabScroller",
  host: {
    "(wheel)": "scrollAcross($event)"
  }
})
export class TabScrollerDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly isOverflowingValue: WritableSignal<boolean> = signal(false);
  private revealed: readonly unknown[] = [];
  private measured: readonly unknown[] = [];
  private actionsWidth: number = Number.NaN;
  private unfoldedWidth: number = 0;

  public readonly actionBar = input.required<HTMLElement>({ alias: "nolTabScroller" });
  public readonly frame = input.required<GroupFrame>({ alias: "nolTabScrollerFrame" });
  public readonly rowCount = input<number>(0, { alias: "nolTabScrollerRows" });
  public readonly isOverflowing: Signal<boolean> = this.isOverflowingValue.asReadonly();

  public constructor() {
    const appearance = inject(AppearanceService);
    const observer = new ResizeObserver(() => {
      if (this.measureActions())
        this.reveal();
      this.isOverflowingValue.set(this.overflows());
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    afterNextRender(() => observer.observe(this.actionBar()));
    afterRenderEffect(() => {
      const frame = this.frame();
      const view = [frame.group.active?.key, frame.bounds.width, this.isOverflowingValue(), appearance.typography()];
      const buttons = [this.rowCount(), appearance.typography()];
      const isStale = buttons.some((t, index) => t !== this.measured[index]);
      this.measured = buttons;
      if (isStale && this.isOverflowingValue()) {
        this.isOverflowingValue.set(false);
        return;
      }
      this.measureActions();
      if (view.some((t, index) => t !== this.revealed[index]))
        this.reveal();
      this.revealed = view;
      this.isOverflowingValue.set(this.overflows());
    });
  }

  protected scrollAcross(event: WheelEvent): void {
    if (event.deltaX !== 0 || event.deltaY === 0 || this.host.scrollWidth <= this.host.clientWidth)
      return;
    event.preventDefault();
    this.host.scrollLeft += event.deltaY;
  }

  private overflows(): boolean {
    const folded = this.isOverflowingValue() ? this.unfoldedWidth - this.actionsWidth : 0;
    const slack = this.host.querySelector(Resources.tabStripEndSelector)?.getBoundingClientRect().width ?? 0;
    return this.host.scrollWidth - slack + folded > this.host.clientWidth;
  }

  private measureActions(): boolean {
    const width = this.actionBar().getBoundingClientRect().width;
    if (!this.isOverflowingValue())
      this.unfoldedWidth = width;
    if (width === this.actionsWidth)
      return false;
    this.actionsWidth = width;
    this.host.style.scrollPaddingInlineEnd = Resources.formatPixels(width);
    this.host.style.setProperty(Resources.tabActionsWidthProperty, Resources.formatPixels(width));
    return true;
  }

  private reveal(): void {
    this.host.querySelectorAll(Resources.selectedTabSelector).forEach(t => t.scrollIntoView(Resources.revealOptions));
  }
}
