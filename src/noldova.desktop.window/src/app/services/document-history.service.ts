/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import { DocumentTab } from "../models/layout/document-tab.js";
import type { Layout } from "../models/layout/layout.js";
import type { Tab } from "../models/layout/tab.js";
import type { ViewRegistry } from "../models/layout/view-registry.js";
import { ViewPlace } from "../models/view-place.js";
import { Resources } from "../../resources.js";
import { LayoutService } from "./layout.service.js";
import { ViewInstancesService } from "./view-instances.service.js";

@Injectable({ providedIn: "root" })
export class DocumentHistoryService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly views: ViewInstancesService = inject(ViewInstancesService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly entries: WritableSignal<readonly (DocumentTab | ViewPlace)[]> = signal([]);
  private readonly index: WritableSignal<number> = signal(-1);
  private readonly listeners: WritableSignal<ReadonlyMap<string, readonly ((place: string, instance: string | null) => void)[]>> = signal(new Map());
  private readonly activeDocument: Signal<Tab | null> = computed(() => this.layout.layout().documents.active, { equal: (a, b) => a?.key === b?.key });

  public readonly canGoBack: Signal<boolean> = computed(() => !Object.isNull(this.nearest(-1)));
  public readonly canGoForward: Signal<boolean> = computed(() => !Object.isNull(this.nearest(1)));

  public constructor() {
    effect(() => {
      const active = this.activeDocument();
      if (active instanceof DocumentTab)
        untracked(() => this.record(active));
    });
  }

  public go(step: number): void {
    const nearest = this.nearest(step);
    if (Object.isNull(nearest))
      return;
    const [index, entry] = nearest;
    this.index.set(index);
    if (entry instanceof ViewPlace)
      this.show(entry);
    else if (this.layout.layout().isOpen(entry))
      this.layout.activate(entry);
    else
      this.layout.openDocument(entry, true);
  }

  public recordPlace(place: ViewPlace): void {
    this.record(place);
  }

  public onPlaceShown(view: string, listener: (place: string, instance: string | null) => void): () => void {
    this.listeners.update(t => new Map(t).set(view, [...t.get(view) ?? [], listener]));
    return () => this.listeners.update(t => {
      const listeners = new Map(t);
      const kept = [...listeners].filter(([name]) => name === view).flatMap(([, u]) => u);
      if (!kept.includes(listener))
        return t;
      kept.splice(kept.indexOf(listener), 1);
      if (kept.length === 0)
        listeners.delete(view);
      else
        listeners.set(view, kept);
      return listeners;
    });
  }

  public forget(tab: DocumentTab): void {
    this.remove(t => t instanceof DocumentTab && t.equals(tab));
  }

  public forgetPlace(place: ViewPlace): void {
    this.remove(t => place.equals(t));
  }

  public dropPlaces(isDropped: (view: string) => boolean): void {
    this.remove(t => t instanceof ViewPlace && isDropped(t.view));
  }

  private static same(entry: DocumentTab | ViewPlace, other: DocumentTab | ViewPlace | undefined): boolean {
    return entry instanceof ViewPlace ? entry.equals(other) : other instanceof DocumentTab && entry.equals(other);
  }

  private record(entry: DocumentTab | ViewPlace): void {
    const entries = this.entries();
    if (DocumentHistoryService.same(entry, entries[this.index()]))
      return;
    const kept = [...entries.slice(0, this.index() + 1), entry].slice(-Resources.documentHistoryLimit);
    this.entries.set(kept);
    this.index.set(kept.length - 1);
  }

  private remove(isRemoved: (entry: DocumentTab | ViewPlace) => boolean): void {
    const entries = this.entries();
    this.index.set(entries.slice(0, this.index() + 1).filter(t => !isRemoved(t)).length - 1);
    this.entries.set(entries.filter(t => !isRemoved(t)));
  }

  private show(place: ViewPlace): void {
    this.views.show(place.tab);
    for (const listener of [...this.listeners()].filter(([view]) => view === place.view).flatMap(([, t]) => t)) {
      try {
        listener(place.place, place.instance);
      }
      catch (error) {
        this.errors.handleError(error);
      }
    }
  }

  private nearest(step: number): readonly [number, DocumentTab | ViewPlace] | null {
    const layout = this.layout.layout();
    const registry = this.layout.registry();
    const all = this.entries();
    const active = all[this.index()] instanceof ViewPlace ? null : layout.documents.active;
    const entries = [...all.entries()];
    const candidates = step < 0 ? entries.slice(0, Math.max(this.index(), 0)).reverse() : entries.slice(this.index() + 1);
    return candidates.find(([, t]) => this.isAvailable(t, layout, registry) && (t instanceof ViewPlace || !t.equals(active))) ?? null;
  }

  private isAvailable(entry: DocumentTab | ViewPlace, layout: Layout, registry: ViewRegistry): boolean {
    if (entry instanceof DocumentTab)
      return entry.isAvailable(registry);
    return this.listeners().has(entry.view) && (Object.isNull(entry.instance) || layout.isOpen(entry.tab));
  }
}
