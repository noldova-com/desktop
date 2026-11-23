/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, computed, effect, inject } from "@angular/core";

import "@noldova/context.core";

import type { DockSide } from "../enums/dock-side.js";
import type { DocumentHeading } from "../models/document-heading.js";
import { ClosedTabs } from "../models/layout/closed-tabs.js";
import type { Layout } from "../models/layout/layout.js";
import type { TabGroup } from "../models/layout/tab-group.js";
import { TabDropTarget } from "../models/layout/tab-drop-target.js";
import { ViewFront } from "../models/layout/view-front.js";
import { ViewTab } from "../models/layout/view-tab.js";
import { LayoutService } from "./layout.service.js";
import { TabFocusService } from "./tab-focus.service.js";
import { TabLabelService } from "./tab-label.service.js";
import { ViewDialogService } from "./view-dialog.service.js";

@Injectable({ providedIn: "root" })
export class ViewInstancesService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly viewDialogs: ViewDialogService = inject(ViewDialogService);
  private readonly closed: ClosedTabs = new ClosedTabs(ViewTab, inject(ErrorHandler));
  private readonly fronts: Map<string, ViewFront> = new Map();

  public constructor() {
    inject(DestroyRef).onDestroy(this.layout.onChange((from, to) => this.keepFronts(to)));
    effect(() => {
      for (const key of this.closed.notice(this.layout.layout().groups.flatMap(t => t.tabs)))
        this.labels.forget(key);
    });
  }

  public openInstance(name: string, instance: string, heading: DocumentHeading, icon: string | null, tabGroup: string | null): void {
    const tab = this.label(name, instance, heading, icon);
    this.closed.reopen(tab);
    const before = this.layout.layout();
    if (!before.isOpen(tab)) {
      const group = this.groupFor(tab, tabGroup);
      if (Object.isNull(group))
        this.layout.openView(tab);
      else
        this.layout.place(tab, new TabDropTarget(group.id, group.tabs.length));
    }
    this.layout.activate(tab);
    this.noteFront(tab, before);
  }

  public returnFront(name: string, instance: string): void {
    const front = this.fronts.get(new ViewTab(name, instance).key);
    if (!Object.isUndefined(front))
      this.layout.activate(front.earlier);
  }

  public restore(name: string, instance: string, heading: DocumentHeading, icon: string | null, tabGroup: string | null): void {
    const tab = new ViewTab(name, instance);
    if (this.layout.layout().isOpen(tab))
      this.label(name, instance, heading, icon);
    else if (!this.closed.isUnheard(tab))
      this.openInstance(name, instance, heading, icon, tabGroup);
  }

  public update(name: string, instance: string, title: string | null, icon: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null = null): void {
    const tab = new ViewTab(name, instance);
    if (!this.layout.layout().isOpen(tab))
      return;
    if (!Object.isNull(title) || !Object.isNull(breadcrumb))
      this.labels.setHeading(tab, this.labels.headingOf(tab).with(title, breadcrumb, breadcrumbIcon));
    if (!Object.isNull(icon))
      this.labels.setIcon(tab, icon);
  }

  public close(name: string, instance: string): void {
    this.closeQuietly(new ViewTab(name, instance));
  }

  public reconcile(names: ReadonlySet<string>, kept: ReadonlySet<string>): void {
    for (const tab of this.layout.layout().groups.flatMap(t => t.tabs))
      if (tab instanceof ViewTab && names.has(tab.name) && !kept.has(tab.key))
        this.closeQuietly(tab);
    this.closed.reconcile(names);
  }

  public reveal(tab: ViewTab): void {
    if (!this.layout.layout().isOpen(tab))
      this.layout.openView(tab);
    this.layout.activate(tab);
    const side = this.sideOf(tab);
    if (!Object.isNull(side))
      this.layout.keepOpen(side);
    this.tabFocus.focus(tab);
  }

  public show(tab: ViewTab): void {
    this.reveal(tab);
    this.tabFocus.focusContent(tab);
  }

  public hideDock(tab: ViewTab): void {
    const side = this.sideOf(tab);
    if (!Object.isNull(side))
      this.layout.hideDock(side);
  }

  public dockOf(tab: ViewTab): Signal<DockSide | null> {
    return computed(() => this.sideOf(tab));
  }

  public onClosed(name: string, listener: (instance: string) => void): () => void {
    return this.closed.onClosed(name, listener);
  }

  private noteFront(tab: ViewTab, before: Layout): void {
    for (const group of this.layout.layout().groups.filter(t => t.tabs.some(u => u.equals(tab)))) {
      const earlier = before.group(group.id)?.active ?? tab;
      if (!earlier.equals(tab))
        this.fronts.set(tab.key, new ViewFront(group, earlier));
    }
  }

  private keepFronts(layout: Layout): void {
    for (const [key, front] of this.fronts)
      if (!front.holds(layout.group(front.groupId)))
        this.fronts.delete(key);
  }

  private label(name: string, instance: string, heading: DocumentHeading, icon: string | null): ViewTab {
    const tab = new ViewTab(name, instance);
    this.labels.setHeading(tab, heading);
    if (!Object.isNull(icon))
      this.labels.setIcon(tab, icon);
    return tab;
  }

  private sideOf(tab: ViewTab): DockSide | null {
    const group = this.layout.layout().groupOf(tab);
    return Object.isNull(group) ? null : this.layout.layout().sideOf(group.id);
  }

  private groupFor(tab: ViewTab, tabGroup: string | null): TabGroup | null {
    const layout = this.layout.layout();
    const given = layout.groups.find(t => t.id.toString() === tabGroup);
    if (!Object.isUndefined(given))
      return given;
    const holders = layout.groups.filter(t => t.tabs.some(u => u instanceof ViewTab && u.name === tab.name));
    const current = this.layout.currentGroup();
    return holders.find(t => t.id === current.id) ?? holders[0] ?? null;
  }

  private closeQuietly(tab: ViewTab): void {
    if (tab.equals(this.viewDialogs.shown()))
      this.viewDialogs.close();
    const group = this.layout.layout().groupOf(tab);
    if (Object.isNull(group))
      return;
    this.closed.hush(tab);
    this.layout.close(tab);
    const next = this.layout.layout().group(group.id)?.active ?? this.layout.currentGroup().active;
    if (!Object.isNull(next))
      this.tabFocus.focusIfLost(next);
  }
}
