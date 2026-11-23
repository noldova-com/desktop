/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, effect, inject, linkedSignal, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import type { BottomDockSpan } from "../enums/bottom-dock-span.js";
import { DockSide } from "../enums/dock-side.js";
import { DockStyle } from "../enums/dock-style.js";
import { StartupStateKind } from "../enums/startup-state-kind.js";
import type { ILayoutStore } from "../interfaces/i-layout-store.js";
import { BuildTokens } from "../models/build-tokens.js";
import { DockYield } from "../models/layout/dock-yield.js";
import { DocumentTab } from "../models/layout/document-tab.js";
import type { DropTarget } from "../models/layout/drop-target.js";
import { EarlyDocument } from "../models/layout/early-document.js";
import { Layout } from "../models/layout/layout.js";
import { LayoutGeometry } from "../models/layout/layout-geometry.js";
import { LayoutMetrics } from "../models/layout/layout-metrics.js";
import type { ToolbarLayout } from "../models/layout/toolbar-layout.js";
import type { SplitHandle } from "../models/layout/split-handle.js";
import type { Tab } from "../models/layout/tab.js";
import type { TabGroup } from "../models/layout/tab-group.js";
import { TabDropTarget } from "../models/layout/tab-drop-target.js";
import { TabReveal } from "../models/layout/tab-reveal.js";
import { ViewRegistry } from "../models/layout/view-registry.js";
import type { ViewTab } from "../models/layout/view-tab.js";
import { LayoutStoreService } from "./layout-store.service.js";
import { LayoutReader } from "./layout.reader.js";
import { SettingsService } from "./settings.service.js";
import { StartupService } from "./startup.service.js";
import { TabLabelService } from "./tab-label.service.js";

@Injectable({ providedIn: "root" })
export class LayoutService {
  private readonly store: ILayoutStore = inject(LayoutStoreService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly startup: StartupService = inject(StartupService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly formerDocumentNames: ReadonlyMap<string, string> = new Map(inject(BuildTokens.sources).flatMap(t => t.formerDocumentNames));
  private readonly registryState: WritableSignal<ViewRegistry> = signal(ViewRegistry.createEmpty());
  private readonly layoutState: WritableSignal<Layout> = signal(Layout.createDefault(this.registryState()));
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);
  private readonly metrics: WritableSignal<LayoutMetrics | null> = signal(null);
  private readonly currentGroupId: WritableSignal<number | null> = signal(null);
  private readonly revealedState: WritableSignal<TabReveal | null> = signal(null);
  private readonly hiddenState: WritableSignal<Tab | null> = signal(null);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saved: Layout | null = null;
  private savedTitles: ReadonlyMap<string, string> = new Map();
  private early: EarlyDocument[] | null = [];
  private reopening: readonly EarlyDocument[] = [];
  private writing: Promise<void> = Promise.resolve();
  private readonly kept: WritableSignal<DockSide | null> = signal(null);
  private readonly changeListeners: Set<(from: Layout, to: Layout) => void> = new Set();
  private readonly titles: Signal<ReadonlyMap<string, string>> = computed(() => new Map(this.layoutState().groups.flatMap(t => t.tabs).flatMap(t => {
    const title = t instanceof DocumentTab ? this.labels.titleOf(t) : null;
    return Object.isNull(title) ? [] : [[t.key, title] as const];
  })));
  private readonly shownLayout: Signal<Layout> = computed(() => {
    const hidden = this.hiddenState();
    return Object.isNull(hidden) ? this.layoutState() : this.layoutState().close(hidden);
  });

  public readonly layout: Signal<Layout> = this.layoutState.asReadonly();
  public readonly revealed: Signal<TabReveal | null> = this.revealedState.asReadonly();
  public readonly registry: Signal<ViewRegistry> = this.registryState.asReadonly();
  public readonly hidden: Signal<Tab | null> = this.hiddenState.asReadonly();
  public readonly iconSides: Signal<ReadonlySet<DockSide>> = computed(() =>
    new Set([...Resources.dockStyleSettings].filter(([, name]) => this.settings.values().get(name) === DockStyle.Icons).map(([side]) => side)));
  public readonly isMeasured: Signal<boolean> = computed(() => !Object.isNull(this.metrics()));
  public readonly previewTabs: Signal<boolean> = computed(() => this.settings.values().get(Resources.previewTabsSetting) !== false);
  public readonly geometry: Signal<LayoutGeometry> = linkedSignal({
    source: () => ({ width: this.width(), height: this.height(), layout: this.shownLayout(), registry: this.registryState(), metrics: this.metrics(), iconSides: this.iconSides(), kept: this.kept() }),
    computation: (source, previous?: { readonly value: LayoutGeometry }) => new LayoutGeometry(source.width, source.height, source.layout, source.registry, source.metrics ?? LayoutMetrics.none, source.iconSides,
      new DockYield(source.layout.middleSize ?? Resources.middlePreferredSize, previous?.value.closedSides ?? new Set(), source.kept))
  });
  public readonly currentGroup: Signal<TabGroup> = computed(() => {
    const id = this.currentGroupId();
    return (Object.isNull(id) ? null : this.layoutState().group(id)) ?? this.layoutState().documents;
  });

  public constructor() {
    const view = inject(DOCUMENT).defaultView;
    const hidden = (): void => this.sendOnHide();
    view?.addEventListener(Resources.pageHideEvent, hidden);
    inject(DestroyRef).onDestroy(() => {
      this.clearSaveTimer();
      view?.removeEventListener(Resources.pageHideEvent, hidden);
    });
    effect(() => {
      if (this.startup.state().kind === StartupStateKind.Ready)
        this.startSave();
    });
    effect(() => {
      if (!this.previewTabs())
        this.update(this.layoutState().keepPreviews());
    });
    effect(() => {
      const titles = this.titles();
      untracked(() => {
        if (!LayoutService.isSame(titles, this.savedTitles))
          this.scheduleSave();
      });
    });
  }

  public setRegistry(registry: ViewRegistry): void {
    this.registryState.set(registry);
  }

  public setViewport(width: number, height: number): void {
    this.width.set(width);
    this.height.set(height);
    if (!untracked(() => this.geometry().isKeeping))
      this.kept.set(null);
  }

  public setMetrics(metrics: LayoutMetrics): void {
    this.metrics.set(metrics);
  }

  public async loadAsync(): Promise<boolean> {
    const saved = await this.store.readAsync();
    const read = Object.isNull(saved) ? null : this.read(saved);
    const layout = read?.[0] ?? Layout.createDefault(this.registryState());
    this.clearSaveTimer();
    this.reopening = (this.early ?? []).filter(t => this.layoutState().isOpen(t.tab));
    this.early = null;
    this.layoutState.set(layout);
    this.saved = layout;
    this.restoreTitles(layout, read?.[1] ?? new Map());
    this.savedTitles = this.titles();
    return !Object.isNull(read);
  }

  public saveAsync(): Promise<void> {
    this.clearSaveTimer();
    const saving = this.writing.then(() => this.writeLatestAsync());
    this.writing = saving.catch(() => undefined);
    return saving;
  }

  public openDocument(tab: DocumentTab, isPreview: boolean = false, after: DocumentTab | null = null, activate: boolean = true): void {
    this.early?.push(new EarlyDocument(tab, isPreview, after, activate));
    this.update(this.layoutState().openDocument(tab, isPreview && this.previewTabs(), after, activate));
    if (activate)
      this.reveal(tab);
  }

  public openView(tab: ViewTab): void {
    this.update(this.layoutState().openView(tab, this.registryState()));
  }

  public reopenEarlyDocuments(): void {
    this.early = null;
    for (const early of this.reopening)
      this.openDocument(early.tab, early.isPreview, early.after, early.activates);
    this.reopening = [];
  }

  public openInCurrentGroup(tab: Tab): void {
    const current = this.currentGroup();
    const group = current.accepts(tab) ? current : this.layoutState().documents;
    this.place(tab, new TabDropTarget(group.id, group.tabs.length));
    this.activate(tab);
  }

  public onChange(listener: (from: Layout, to: Layout) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  public hide(tab: Tab | null): void {
    this.hiddenState.set(tab);
  }

  public restoreDocument(tab: DocumentTab, isPreview: boolean): void {
    this.update(this.layoutState().restoreDocument(tab, isPreview && this.previewTabs()));
  }

  public keep(tab: Tab): void {
    this.update(this.layoutState().keep(tab));
  }

  public place(tab: Tab, target: DropTarget): void {
    this.update(target.place(this.layoutState(), tab));
  }

  public activate(tab: Tab): void {
    this.update(this.layoutState().activate(tab));
    this.reveal(tab);
    const group = this.layoutState().groupOf(tab);
    if (!Object.isNull(group))
      this.focusGroup(group.id);
  }

  public showInGroup(tab: Tab): void {
    this.update(this.layoutState().showInGroup(tab));
  }

  public focusGroup(id: number): void {
    this.currentGroupId.set(id);
    this.update(this.layoutState().focusDocuments(id));
  }

  public close(tab: Tab): void {
    this.closeTabs([tab]);
  }

  public closeTabs(tabs: readonly Tab[]): void {
    this.update(tabs.reduce((layout, t) => layout.close(t), this.layoutState()));
    this.labels.dropLooks(t => tabs.some(u => u.equals(t)));
  }

  public toggleDock(side: DockSide): void {
    if (this.geometry().closedSides.has(side)) {
      this.kept.set(side);
      return;
    }
    this.update(this.layoutState().toggleDock(side));
    if (this.kept() === side)
      this.kept.set(null);
    if (this.layoutState().dock(side).isExpanded)
      this.keepOpen(side);
  }

  public hideDock(side: DockSide): void {
    if (this.kept() === side)
      this.kept.set(null);
    if (this.layoutState().dock(side).isExpanded)
      this.update(this.layoutState().toggleDock(side));
  }

  public keepOpen(side: DockSide): void {
    if (this.geometry().closedSides.has(side))
      this.kept.set(side);
  }

  public resizeDock(side: DockSide, size: number): void {
    const layout = this.layoutState().resizeDock(side, Math.max(this.geometry().metrics.dockMinimum, size));
    if (side === DockSide.Bottom) {
      this.update(layout);
      return;
    }
    const geometry = this.geometry();
    const other = side === DockSide.Left ? DockSide.Right : DockSide.Left;
    const shown = geometry.dock(other).width;
    const held = geometry.isCollapsed(other) || layout.dock(other).preferredTrack(geometry.metrics, geometry.width) <= shown + geometry.metrics.gap ? layout : layout.resizeDock(other, shown);
    this.update(held.withMiddleSize(this.middleAfter(side, size)));
  }

  public restoreDock(side: DockSide, size: number | null): void {
    if (Object.isNull(size))
      this.update(this.layoutState().resizeDock(side, null));
    else
      this.resizeDock(side, size);
  }

  public setBottomSpan(span: BottomDockSpan): void {
    this.update(this.layoutState().withBottomSpan(span));
  }

  public resizeSplit(handle: SplitHandle, leadingLength: number): void {
    this.update(this.layoutState().resizeSplit(handle.resize(leadingLength)));
  }

  public setToolbars(toolbars: ToolbarLayout, band: string | null = null): void {
    this.update(this.layoutState().withToolbars(toolbars, band));
  }

  public reset(): void {
    this.update(this.layoutState().reset(this.registryState()));
  }

  private middleAfter(side: DockSide, size: number): number | null {
    const geometry = this.geometry();
    const middle = geometry.middle.width + geometry.dock(side).width - size;
    return middle < Resources.middlePreferredSize ? Math.max(0, middle) : null;
  }

  private reveal(tab: Tab): void {
    this.revealedState.set(new TabReveal(tab, (this.revealedState()?.sequence ?? 0) + 1));
  }

  private async writeLatestAsync(): Promise<void> {
    const layout = this.layoutState();
    const titles = this.titles();
    if (Object.isNull(this.saved) || (layout === this.saved && LayoutService.isSame(titles, this.savedTitles)) || !this.startup.state().canSave)
      return;
    if (await this.store.writeAsync({ ...layout.toJson(), ...titles.size === 0 ? {} : { [Resources.titlesField]: Object.fromEntries(titles) } })) {
      this.saved = layout;
      this.savedTitles = titles;
    }
  }

  private restoreTitles(layout: Layout, titles: ReadonlyMap<string, string>): void {
    for (const tab of layout.groups.flatMap(t => t.tabs)) {
      const title = titles.get(tab.key);
      if (tab instanceof DocumentTab && !Object.isUndefined(title) && Object.isNull(this.labels.titleOf(tab)))
        this.labels.setTitle(tab, title);
    }
  }

  private static isSame(titles: ReadonlyMap<string, string>, others: ReadonlyMap<string, string>): boolean {
    return titles.size === others.size && [...titles].every(([key, title]) => others.get(key) === title);
  }

  private read(saved: unknown): readonly [Layout, ReadonlyMap<string, string>] | null {
    try {
      return [LayoutReader.read(saved, this.formerDocumentNames), LayoutReader.readTitles(saved, this.formerDocumentNames)];
    }
    catch (error) {
      if (!(error instanceof JsonException))
        throw error;
      return null;
    }
  }

  private update(layout: Layout): void {
    const from = this.layoutState();
    if (layout === from)
      return;
    for (const listener of [...this.changeListeners])
      listener(from, layout);
    this.layoutState.set(layout);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    this.clearSaveTimer();
    if (!Object.isNull(this.saved))
      this.saveTimer = setTimeout(() => this.startSave(), Resources.layoutSaveDelay);
  }

  private sendOnHide(): void {
    this.clearSaveTimer();
    void this.writeLatestAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  private startSave(): void {
    void this.saveAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  private clearSaveTimer(): void {
    if (!Object.isNull(this.saveTimer))
      clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
