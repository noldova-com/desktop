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
  exportAs: "nolTabScroller"
})
export class TabScrollerDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly isOverflowingValue: WritableSignal<boolean> = signal(false);
  private readonly hiddenValue: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly observer: ResizeObserver;
  private observed: readonly HTMLElement[] = [];
  private measured: readonly unknown[] = [];
  private fitted: readonly unknown[] = [];
  private actionsWidth: number = Number.NaN;
  private unfoldedWidth: number = 0;

  public readonly actionBar = input.required<HTMLElement>({ alias: "nolTabScroller" });
  public readonly frame = input.required<GroupFrame>({ alias: "nolTabScrollerFrame" });
  public readonly rowCount = input<number>(0, { alias: "nolTabScrollerRows" });
  public readonly isOverflowing: Signal<boolean> = this.isOverflowingValue.asReadonly();
  public readonly hidden: Signal<ReadonlySet<string>> = this.hiddenValue.asReadonly();

  public constructor() {
    const appearance = inject(AppearanceService);
    this.observer = new ResizeObserver(() => {
      this.measureActions();
      this.fit();
    });
    inject(DestroyRef).onDestroy(() => this.observer.disconnect());
    afterNextRender(() => {
      this.observer.observe(this.host);
      this.observer.observe(this.actionBar());
    });
    afterRenderEffect(() => {
      const view = [this.frame(), appearance.typography()];
      const buttons = [this.rowCount(), appearance.typography()];
      const isStale = buttons.some((t, index) => t !== this.measured[index]);
      this.measured = buttons;
      if (isStale && this.isOverflowingValue()) {
        this.isOverflowingValue.set(false);
        this.fitted = [];
        return;
      }
      this.measureActions();
      if (view.some((t, index) => t !== this.fitted[index]))
        this.fit();
      this.fitted = view;
    });
  }

  public isHidden(key: string): boolean {
    return this.hiddenValue().has(key);
  }

  private fit(): void {
    const tabs = [...this.host.querySelectorAll<HTMLElement>(Resources.tabKeySelector)];
    this.observed.filter(t => !tabs.includes(t)).forEach(t => this.observer.unobserve(t));
    tabs.filter(t => !this.observed.includes(t)).forEach(t => this.observer.observe(t));
    this.observed = tabs;
    const widths = tabs.map(t => TabScrollerDirective.widthOf(t));
    const start = parseFloat(getComputedStyle(this.host).paddingInlineStart) || 0;
    const room = this.host.clientWidth - start;
    const tabsWidth = widths.reduce((sum, t) => sum + t, 0);
    this.host.style.setProperty(Resources.tabsWidthProperty, Resources.formatPixels(start + tabsWidth + this.unfoldedWidth));
    const overflows = tabsWidth > room - this.unfoldedWidth + TabScrollerDirective.TOLERANCE;
    if (overflows !== this.isOverflowingValue())
      this.isOverflowingValue.set(overflows);
    const shown = TabScrollerDirective.shownOf(widths, tabs.findIndex(t => t.matches(Resources.selectedTabSelector)), room - this.actionsWidth);
    const hidden = new Set(tabs.filter((_, index) => !shown.has(index)).map(t => t.dataset[Resources.tabKeyData]).filter((t): t is string => !Object.isUndefined(t)));
    const current = this.hiddenValue();
    if (hidden.size !== current.size || [...hidden].some(t => !current.has(t)))
      this.hiddenValue.set(hidden);
  }

  private measureActions(): void {
    const width = this.actionBar().getBoundingClientRect().width;
    if (!this.isOverflowingValue())
      this.unfoldedWidth = width;
    if (width === this.actionsWidth)
      return;
    this.actionsWidth = width;
    this.host.style.setProperty(Resources.tabActionsWidthProperty, Resources.formatPixels(width));
  }

  private static shownOf(widths: readonly number[], selected: number, room: number): ReadonlySet<number> {
    const shown: number[] = [];
    const sums = [0];
    let used = 0;
    for (const [index, width] of widths.entries()) {
      if (used + width > room + TabScrollerDirective.TOLERANCE)
        break;
      shown.push(index);
      used += width;
      sums.push(used);
    }
    const width = widths[selected];
    if (Object.isUndefined(width) || shown.includes(selected))
      return new Set(shown);
    const kept = Math.max(0, sums.findLastIndex(t => t + width <= room + TabScrollerDirective.TOLERANCE));
    return new Set([...shown.slice(0, kept), selected]);
  }

  private static widthOf(tab: HTMLElement): number {
    const style = getComputedStyle(tab);
    return tab.getBoundingClientRect().width + (parseFloat(style.marginInlineStart) || 0) + (parseFloat(style.marginInlineEnd) || 0);
  }

  private static readonly TOLERANCE: number = 0.5;
}
