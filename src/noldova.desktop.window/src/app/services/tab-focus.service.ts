/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, EnvironmentInjector, Injectable, type Signal, type WritableSignal, afterNextRender, inject, signal } from "@angular/core";

import "@noldova/context.core";

import type { Tab } from "../models/layout/tab.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class TabFocusService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);
  private readonly contentValue: WritableSignal<string | null> = signal(null);
  private timer: ReturnType<typeof setTimeout> | undefined = undefined;

  public readonly content: Signal<string | null> = this.contentValue.asReadonly();

  public constructor() {
    const listener = (event: Event): void => this.notice(event);
    const events = [Resources.focusInEvent, Resources.pointerDownEvent, Resources.keyDownEvent];
    for (const name of events)
      this.document.addEventListener(name, listener, true);
    inject(DestroyRef).onDestroy(() => {
      for (const name of events)
        this.document.removeEventListener(name, listener, true);
      this.drop();
    });
  }

  public focus(tab: Tab, isRowKept: boolean = false): void {
    afterNextRender(() => {
      const element = this.elementOf(tab);
      element?.focus({ preventScroll: isRowKept });
      if (!isRowKept || this.isOutOfRow(element))
        element?.scrollIntoView(Resources.revealOptions);
    }, { injector: this.environment });
  }

  public focusContent(tab: Tab): void {
    this.drop();
    this.contentValue.set(tab.key);
    this.timer = setTimeout(() => this.drop(), Resources.contentFocusTimeout);
  }

  public isContentAsked(tab: Tab): boolean {
    return this.contentValue() === tab.key;
  }

  public settleContent(tab: Tab): void {
    if (this.isContentAsked(tab))
      this.drop();
  }

  public followActive(tabs: readonly Tab[], active: Tab | null): void {
    if (tabs.some(t => this.isContentAsked(t) && !t.equals(active)))
      this.drop();
  }

  public focusIfLost(tab: Tab): void {
    afterNextRender(() => {
      const active = this.document.activeElement;
      if (Object.isNull(active) || active === this.document.body)
        this.elementOf(tab)?.focus();
    }, { injector: this.environment });
  }

  private notice(event: Event): void {
    const key = this.contentValue();
    if (Object.isNull(key))
      return;
    if (!(event.target instanceof Element) || Object.isNull(event.target.closest(Resources.formatTabFocusArea(key))))
      this.drop();
  }

  private drop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.contentValue.set(null);
  }

  private isOutOfRow(element: HTMLElement | undefined): boolean {
    const row = element?.closest<HTMLElement>(Resources.tabScrollerSelector);
    if (Object.isNullOrUndefined(element) || Object.isNullOrUndefined(row))
      return false;
    const [box, rect, style] = [row.getBoundingClientRect(), element.getBoundingClientRect(), getComputedStyle(row)];
    const actions = Number.parseFloat(style.scrollPaddingInlineEnd);
    const [start, end] = style.direction === Resources.rightToLeft ? [box.left + actions, box.right] : [box.left, box.right - actions];
    return rect.right <= start || rect.left >= end;
  }

  private elementOf(tab: Tab): HTMLElement | undefined {
    return [...this.document.querySelectorAll<HTMLElement>(Resources.tabKeySelector)].find(t => t.dataset[Resources.tabKeyData] === tab.key);
  }
}
