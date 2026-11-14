/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type WritableSignal, signal } from "@angular/core";

import "@noldova/context.core";

import { Resources } from "../../resources.js";
import { DocumentHeading } from "../models/document-heading.js";
import { DocumentLook } from "../models/document-look.js";
import type { Tab } from "../models/layout/tab.js";
import { TabLabel } from "../models/layout/tab-label.js";
import type { ViewBadge } from "../models/view-badge.js";

@Injectable({ providedIn: "root" })
export class TabLabelService {
  private readonly labels: WritableSignal<ReadonlyMap<string, TabLabel>> = signal(new Map());
  private readonly titles: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly icons: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly breadcrumbs: WritableSignal<ReadonlyMap<string, readonly string[]>> = signal(new Map());
  private readonly breadcrumbIcons: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly badges: WritableSignal<ReadonlyMap<string, ViewBadge>> = signal(new Map());
  private readonly working: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly waiting: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly looks: WritableSignal<ReadonlyMap<string, readonly [Tab, DocumentLook]>> = signal(new Map());

  public register(name: string, label: TabLabel): void {
    this.labels.update(t => new Map([...t, [name, label]]));
  }

  public setBadge(view: string, badge: ViewBadge | null): void {
    this.badges.update(t => new Map([...t].filter(([name]) => name !== view).concat(Object.isNull(badge) ? [] : [[view, badge]])));
  }

  public badgeOf(tab: Tab): ViewBadge | null {
    return tab.isMovable ? this.badges().get(tab.name) ?? null : null;
  }

  public setWorking(tabKey: string, isWorking: boolean): void {
    this.working.update(t => new Set([...t].filter(u => u !== tabKey).concat(isWorking ? [tabKey] : [])));
  }

  public isWorking(tab: Tab): boolean {
    return this.working().has(tab.key);
  }

  public setWaiting(tabKey: string, isWaiting: boolean): void {
    this.waiting.update(t => new Set([...t].filter(u => u !== tabKey).concat(isWaiting ? [tabKey] : [])));
  }

  public isWaiting(tab: Tab): boolean {
    return this.waiting().has(tab.key);
  }

  public setLook(tab: Tab, look: DocumentLook): void {
    this.looks.update(t => new Map([...t, [tab.key, [tab, look]]]));
  }

  public lookOf(tab: Tab): DocumentLook {
    return this.looks().get(tab.key)?.[1] ?? DocumentLook.none;
  }

  public dropLooks(isDropped: (tab: Tab) => boolean): void {
    if ([...this.looks().values()].some(([tab]) => isDropped(tab)))
      this.looks.update(t => new Map([...t].filter(([, [tab]]) => !isDropped(tab))));
  }

  public setTitle(tab: Tab, title: string): void {
    this.titles.update(t => new Map([...t, [tab.key, title]]));
  }

  public titleOf(tab: Tab): string | null {
    return this.titles().get(tab.key) ?? null;
  }

  public setIcon(tab: Tab, icon: string): void {
    this.icons.update(t => new Map([...t, [tab.key, icon]]));
  }

  public forget(tabKey: string): void {
    this.titles.update(t => new Map([...t].filter(([key]) => key !== tabKey)));
    this.icons.update(t => new Map([...t].filter(([key]) => key !== tabKey)));
    this.breadcrumbs.update(t => new Map([...t].filter(([key]) => key !== tabKey)));
    this.breadcrumbIcons.update(t => new Map([...t].filter(([key]) => key !== tabKey)));
  }

  public setHeading(tab: Tab, heading: DocumentHeading): void {
    this.setTitle(tab, heading.title);
    this.breadcrumbs.update(t => new Map([...t, [tab.key, heading.breadcrumb]]));
    this.breadcrumbIcons.update(t => new Map([...t].filter(([key]) => key !== tab.key).concat(Object.isNull(heading.icon) ? [] : [[tab.key, heading.icon]])));
  }

  public headingOf(tab: Tab): DocumentHeading {
    return new DocumentHeading(this.of(tab).title, this.breadcrumbs().get(tab.key) ?? [], this.breadcrumbIcons().get(tab.key) ?? null);
  }

  public of(tab: Tab): TabLabel {
    const label = this.labels().get(tab.name);
    const title = this.titles().get(tab.key);
    if (!Object.isUndefined(title))
      return new TabLabel(title, this.icons().get(tab.key) ?? label?.icon ?? (tab.isMovable ? Resources.viewGlyph : Resources.documentGlyph));
    if (!Object.isUndefined(label))
      return Object.isUndefined(tab.instance) ? label : new TabLabel(Resources.formatTabInstanceTitle(label.title, tab.instance), label.icon);
    return new TabLabel(tab.instance ?? tab.name, tab.isMovable ? Resources.viewGlyph : Resources.documentGlyph);
  }
}
