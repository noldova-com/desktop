/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import { DocumentTab } from "../models/layout/document-tab.js";
import { Resources } from "../../resources.js";
import { LayoutService } from "./layout.service.js";

@Injectable({ providedIn: "root" })
export class DocumentHistoryService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly entries: WritableSignal<readonly DocumentTab[]> = signal([]);
  private readonly index: WritableSignal<number> = signal(-1);

  public readonly canGoBack: Signal<boolean> = computed(() => !Object.isNull(this.nearest(-1)));
  public readonly canGoForward: Signal<boolean> = computed(() => !Object.isNull(this.nearest(1)));

  public constructor() {
    effect(() => {
      const active = this.layout.layout().documents.active;
      if (active instanceof DocumentTab)
        untracked(() => this.record(active));
    });
  }

  public go(step: number): void {
    const nearest = this.nearest(step);
    if (Object.isNull(nearest))
      return;
    const [index, tab] = nearest;
    this.index.set(index);
    if (this.layout.layout().isOpen(tab))
      this.layout.activate(tab);
    else
      this.layout.openDocument(tab, true);
  }

  public forget(tab: DocumentTab): void {
    const entries = this.entries();
    this.index.set(entries.slice(0, this.index() + 1).filter(t => !t.equals(tab)).length - 1);
    this.entries.set(entries.filter(t => !t.equals(tab)));
  }

  private record(tab: DocumentTab): void {
    const entries = this.entries();
    if (tab.equals(entries[this.index()] ?? null))
      return;
    const kept = [...entries.slice(0, this.index() + 1), tab].slice(-Resources.documentHistoryLimit);
    this.entries.set(kept);
    this.index.set(kept.length - 1);
  }

  private nearest(step: number): readonly [number, DocumentTab] | null {
    const layout = this.layout.layout();
    const registry = this.layout.registry();
    const entries = [...this.entries().entries()];
    const candidates = step < 0 ? entries.slice(0, Math.max(this.index(), 0)).reverse() : entries.slice(this.index() + 1);
    return candidates.find(([, t]) => t.isAvailable(registry) && !t.equals(layout.documents.active)) ?? null;
  }
}
