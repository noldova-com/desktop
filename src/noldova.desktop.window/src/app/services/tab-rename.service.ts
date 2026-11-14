/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, type Signal, type WritableSignal, effect, inject, signal } from "@angular/core";

import "@noldova/context.core";

import { DockSide } from "../enums/dock-side.js";
import type { Tab } from "../models/layout/tab.js";
import { LayoutService } from "./layout.service.js";
import { TabLabelService } from "./tab-label.service.js";

@Injectable({ providedIn: "root" })
export class TabRenameService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly listeners: Map<string, Set<(instance: string, title: string) => void>> = new Map();
  private readonly renamed: WritableSignal<Tab | null> = signal(null);

  public constructor() {
    effect(() => {
      const tab = this.renamed();
      if (!Object.isNull(tab) && !this.isInStrip(tab))
        this.renamed.set(null);
    });
  }

  public get editing(): Signal<Tab | null> {
    return this.renamed.asReadonly();
  }

  public canRename(tab: Tab): boolean {
    return !Object.isUndefined(tab.instance) && tab.isRenamable(this.layout.registry()) && this.isInStrip(tab);
  }

  public begin(tab: Tab): void {
    if (this.canRename(tab))
      this.renamed.set(tab);
  }

  public keep(title: string): void {
    const tab = this.renamed();
    this.renamed.set(null);
    const kept = title.trim();
    if (Object.isNull(tab) || Object.isUndefined(tab.instance) || !this.isInStrip(tab) || kept === this.labels.of(tab).title)
      return;
    for (const listener of [...this.listenersOf(tab.name)])
      this.tell(listener, tab.instance, kept);
  }

  public cancel(): void {
    this.renamed.set(null);
  }

  public onRenamed(name: string, listener: (instance: string, title: string) => void): () => void {
    const listeners = this.listenersOf(name);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  private isInStrip(tab: Tab): boolean {
    const group = this.layout.layout().groupOf(tab);
    const frame = Object.isNull(group) ? null : this.layout.geometry().frameOf(group.id);
    if (Object.isNull(frame))
      return false;
    return Object.isNull(frame.side) || frame.side === DockSide.Bottom || !this.layout.iconSides().has(frame.side);
  }

  private listenersOf(name: string): Set<(instance: string, title: string) => void> {
    const listeners = this.listeners.get(name) ?? new Set<(instance: string, title: string) => void>();
    this.listeners.set(name, listeners);
    return listeners;
  }

  private tell(listener: (instance: string, title: string) => void, instance: string, title: string): void {
    try {
      listener(instance, title);
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }
}
