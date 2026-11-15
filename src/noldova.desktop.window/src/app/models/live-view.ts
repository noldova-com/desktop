/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef } from "@angular/core";

import "@noldova/context.core";

import type { TabContentComponent } from "../components/tab-content/tab-content.component.js";
import type { Tab } from "./layout/tab.js";
import { ScrollOffset } from "./scroll-offset.js";
import { Resources } from "../../resources.js";

export class LiveView {
  private readonly offsets: Map<Element, ScrollOffset> = new Map();
  private readonly scrolled: Set<Element> = new Set();
  private frame: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private focused: HTMLElement | null = null;
  private slotValue: HTMLElement | null = null;
  private isInPlace: boolean = true;
  private isConcealedValue: boolean = false;

  public readonly tab: Tab;
  public readonly ref: ComponentRef<TabContentComponent>;

  public constructor(tab: Tab, ref: ComponentRef<TabContentComponent>) {
    this.tab = tab;
    this.ref = ref;
    this.element.addEventListener(Resources.scrollEvent, event => this.keep(event), { capture: true, passive: true });
  }

  public get element(): HTMLElement {
    return this.ref.instance.element;
  }

  public get slot(): HTMLElement | null {
    return this.slotValue;
  }

  public get isConcealed(): boolean {
    return this.isConcealedValue;
  }

  public conceal(): void {
    this.keepPlace();
    this.element.inert = true;
    this.element.classList.add(Resources.concealedTabContentClass);
    this.isConcealedValue = true;
  }

  public leave(): void {
    if (!this.isConcealedValue)
      this.keepPlace();
    this.reveal();
    this.element.remove();
    this.slotValue = null;
  }

  public enter(slot: HTMLElement): void {
    slot.append(this.element);
    this.slotValue = slot;
  }

  public reveal(): void {
    this.element.inert = false;
    this.element.classList.remove(Resources.concealedTabContentClass);
    this.isConcealedValue = false;
  }

  public restore(): void {
    this.isInPlace = true;
    for (const [element, offset] of this.offsets)
      if (this.element.contains(element))
        offset.restore();
      else
        this.offsets.delete(element);
    const focused = this.focused;
    this.focused = null;
    const document = this.element.ownerDocument;
    if (!Object.isNull(focused) && document.activeElement === document.body && this.element.isConnected && this.element.contains(focused))
      focused.focus({ preventScroll: true });
  }

  public readScrollOffsets(): void {
    this.cancelRead();
    if (this.element.isConnected)
      for (const element of this.scrolled)
        this.offsets.set(element, ScrollOffset.of(element));
    this.scrolled.clear();
  }

  public dispose(): void {
    this.cancelRead();
    this.scrolled.clear();
  }

  private keepPlace(): void {
    this.readScrollOffsets();
    const active = this.element.ownerDocument.activeElement;
    this.focused = active instanceof HTMLElement && this.element.contains(active) ? active : null;
    this.isInPlace = false;
  }

  private keep(event: Event): void {
    if (!this.isInPlace || !this.element.isConnected || !(event.target instanceof Element))
      return;
    this.scrolled.add(event.target);
    if (Object.isNull(this.frame) && Object.isNull(this.timer))
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.timer = setTimeout(() => {
          this.timer = null;
          this.readScrollOffsets();
        });
      });
  }

  private cancelRead(): void {
    if (!Object.isNull(this.frame))
      cancelAnimationFrame(this.frame);
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.frame = null;
    this.timer = null;
  }
}
