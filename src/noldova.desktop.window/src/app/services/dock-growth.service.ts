/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/context.core";

import type { Bounds } from "../models/layout/bounds.js";
import { DockGrowth } from "../models/layout/dock-growth.js";
import type { Tab } from "../models/layout/tab.js";
import { LayoutService } from "./layout.service.js";

@Injectable({ providedIn: "root" })
export class DockGrowthService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly asked: WritableSignal<ReadonlyMap<string, DockGrowth>> = signal<ReadonlyMap<string, DockGrowth>>(new Map<string, DockGrowth>());
  private nextId: number = 1;

  public grow(tab: Tab, minimum: number): () => void {
    const growth = new DockGrowth(this.nextId++, minimum);
    this.asked.update(t => new Map(t).set(tab.key, growth));
    return () => this.release(tab, growth.id);
  }

  public minimumOf(tab: Tab): number | null {
    const growth = this.asked().get(tab.key);
    return Object.isUndefined(growth) || growth.isFitted ? null : growth.minimum;
  }

  public fit(tab: Tab, content: Bounds): void {
    const growth = this.asked().get(tab.key);
    const layout = this.layout.layout();
    const group = layout.groupOf(tab);
    const side = Object.isNull(group) ? null : layout.sideOf(group.id);
    if (Object.isUndefined(growth) || growth.isFitted || Object.isNull(side))
      return;
    const dock = layout.dock(side);
    const lacking = growth.minimum - content.length(dock.axis);
    if (lacking <= 0) {
      this.asked.update(t => new Map(t).set(tab.key, growth.withFitted(null, null, null)));
      return;
    }
    const geometry = this.layout.geometry();
    this.layout.growDock(side, Math.min(geometry.maximumSize(side), geometry.dock(side).length(dock.axis) + lacking), tab.key);
    this.asked.update(t => new Map(t).set(tab.key, growth.withFitted(side, dock.size, this.layout.layout().dock(side).size)));
  }

  private release(tab: Tab, id: number): void {
    const growth = this.asked().get(tab.key);
    if (growth?.id !== id)
      return;
    this.asked.update(t => {
      const asked = new Map(t);
      asked.delete(tab.key);
      return asked;
    });
    if (!Object.isNull(growth.side) && this.layout.layout().dock(growth.side).size === growth.grown)
      this.layout.restoreDock(growth.side, growth.before);
    this.layout.releaseGrowth(tab.key);
  }
}
