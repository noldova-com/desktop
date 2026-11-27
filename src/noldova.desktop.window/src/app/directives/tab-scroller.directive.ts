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
    "(wheel)": "scrollAcross($event)",
    "(scroll)": "placeThumb()",
    "(focusin)": "revealFocused($event)"
  }
})
export class TabScrollerDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly isOverflowingValue: WritableSignal<boolean> = signal(false);
  private readonly observer: ResizeObserver;
  private observed: readonly HTMLElement[] = [];
  private measured: readonly unknown[] = [];
  private revealed: readonly unknown[] = [];
  private actionsWidth: number = Number.NaN;
  private unfoldedWidth: number = 0;
  private grip: { readonly x: number; readonly scroll: number } | undefined;

  public readonly actionBar = input.required<HTMLElement>({ alias: "nolTabScroller" });
  public readonly thumb = input.required<HTMLElement>({ alias: "nolTabScrollerThumb" });
  public readonly frame = input.required<GroupFrame>({ alias: "nolTabScrollerFrame" });
  public readonly rowCount = input<number>(0, { alias: "nolTabScrollerRows" });
  public readonly isOverflowing: Signal<boolean> = this.isOverflowingValue.asReadonly();

  public constructor() {
    const appearance = inject(AppearanceService);
    this.observer = new ResizeObserver(() => {
      if (this.measureActions())
        this.reveal();
      this.measureTabs();
      this.placeThumb();
    });
    inject(DestroyRef).onDestroy(() => this.observer.disconnect());
    afterNextRender(() => {
      this.observer.observe(this.host);
      this.observer.observe(this.actionBar());
    });
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
      const isMoved = this.measureActions();
      this.measureTabs();
      if (isMoved || view.some((t, index) => t !== this.revealed[index]))
        this.reveal();
      this.revealed = view;
      this.placeThumb();
    });
  }

  public grab(event: PointerEvent): void {
    if (event.button !== 0)
      return;
    event.preventDefault();
    this.thumb().setPointerCapture(event.pointerId);
    this.grip = { x: event.clientX, scroll: this.host.scrollLeft };
  }

  public drag(event: PointerEvent): void {
    if (Object.isUndefined(this.grip))
      return;
    this.host.scrollLeft = this.grip.scroll + (event.clientX - this.grip.x) * this.host.scrollWidth / this.host.clientWidth;
  }

  public release(): void {
    this.grip = undefined;
  }

  protected scrollAcross(event: WheelEvent): void {
    if (event.deltaX !== 0 || event.deltaY === 0 || this.host.scrollWidth <= this.host.clientWidth)
      return;
    event.preventDefault();
    this.host.scrollLeft += event.deltaY;
  }

  protected revealFocused(event: FocusEvent): void {
    if (event.target instanceof HTMLElement && event.target.matches(Resources.tabKeySelector))
      this.reveal(event.target);
  }

  protected placeThumb(): void {
    const thumb = this.thumb();
    const [view, content] = [this.host.clientWidth, this.host.scrollWidth];
    const isFitting = content <= view;
    thumb.hidden = isFitting;
    if (isFitting)
      return;
    thumb.style.inlineSize = Resources.formatPixels(view * view / content);
    thumb.style.insetInlineStart = Resources.formatPixels(Math.abs(this.host.scrollLeft) * view / content);
  }

  private measureTabs(): void {
    const tabs = [...this.host.querySelectorAll<HTMLElement>(Resources.tabKeySelector)];
    this.observed.filter(t => !tabs.includes(t)).forEach(t => this.observer.unobserve(t));
    tabs.filter(t => !this.observed.includes(t)).forEach(t => this.observer.observe(t));
    this.observed = tabs;
    const start = this.startOf();
    const tabsWidth = tabs.reduce((sum, t) => sum + TabScrollerDirective.widthOf(t), 0);
    this.host.style.setProperty(Resources.tabsWidthProperty, Resources.formatPixels(start + tabsWidth + this.unfoldedWidth));
    const overflows = tabsWidth > this.host.clientWidth - start - this.unfoldedWidth + TabScrollerDirective.TOLERANCE;
    if (overflows !== this.isOverflowingValue())
      this.isOverflowingValue.set(overflows);
  }

  private measureActions(): boolean {
    const width = this.actionBar().getBoundingClientRect().width;
    if (!this.isOverflowingValue())
      this.unfoldedWidth = width;
    if (width === this.actionsWidth)
      return false;
    this.actionsWidth = width;
    this.host.style.setProperty(Resources.tabActionsWidthProperty, Resources.formatPixels(width));
    return true;
  }

  private reveal(tab: HTMLElement | null = this.host.querySelector<HTMLElement>(Resources.selectedTabSelector)): void {
    if (Object.isNull(tab))
      return;
    const [row, box] = [this.host.getBoundingClientRect(), tab.getBoundingClientRect()];
    const isRightToLeft = getComputedStyle(this.host).direction === Resources.rightToLeft;
    const [from, to] = isRightToLeft ? [row.right - box.right, row.right - box.left] : [box.left - row.left, box.right - row.left];
    const [start, end] = [this.startOf(), this.host.clientWidth - this.actionsWidth];
    const shift = from < start ? from - start : to > end ? Math.min(to - end, from - start) : 0;
    if (Math.abs(shift) > TabScrollerDirective.TOLERANCE)
      this.host.scrollLeft += isRightToLeft ? -shift : shift;
  }

  private startOf(): number {
    return parseFloat(getComputedStyle(this.host).paddingInlineStart);
  }

  private static widthOf(tab: HTMLElement): number {
    const style = getComputedStyle(tab);
    return tab.getBoundingClientRect().width + (parseFloat(style.marginInlineStart) || 0) + (parseFloat(style.marginInlineEnd) || 0);
  }

  private static readonly TOLERANCE: number = 0.5;
}
