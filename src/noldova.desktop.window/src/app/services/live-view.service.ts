/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, DestroyRef, EnvironmentInjector, Injectable, type Signal, type WritableSignal, afterNextRender, createComponent, effect, inject, signal,
  untracked } from "@angular/core";

import "@noldova/context.core";

import { TabContentComponent } from "../components/tab-content/tab-content.component.js";
import type { Tab } from "../models/layout/tab.js";
import { LiveView } from "../models/live-view.js";
import { LayoutService } from "./layout.service.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class LiveViewService {
  private readonly application: ApplicationRef = inject(ApplicationRef);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly views: Map<string, LiveView> = new Map();
  private readonly destroyedValue: WritableSignal<number> = signal(0);
  private readonly shownValue: WritableSignal<ReadonlySet<string>> = signal(new Set());

  public readonly destroyed: Signal<number> = this.destroyedValue.asReadonly();
  public readonly shownTabs: Signal<ReadonlySet<string>> = this.shownValue.asReadonly();

  public constructor() {
    effect(() => {
      const layout = this.layout.layout();
      untracked(() => {
        for (const view of this.views.values())
          view.readScrollOffsets();
        this.removeWhere(t => (Object.isNull(t.slot) || t.isConcealed) && !layout.isOpen(t.tab));
      });
    });
    inject(DestroyRef).onDestroy(() => this.removeWhere(() => true));
  }

  public show(tab: Tab, slot: HTMLElement, isDocked: boolean): TabContentComponent {
    const view = this.views.get(tab.key) ?? this.create(tab);
    view.ref.setInput(Resources.tabInput, tab);
    view.ref.setInput(Resources.dockedInput, isDocked);
    if (view.slot === slot && !view.isConcealed)
      return view.ref.instance;
    if (Object.isNull(view.slot) || view.isConcealed)
      this.application.attachView(view.ref.hostView);
    if (view.slot === slot)
      view.reveal();
    else {
      if (!Object.isNull(view.slot))
        view.leave();
      view.enter(slot);
    }
    view.ref.setInput(Resources.shownInput, true);
    this.mark(tab.key, true);
    view.ref.changeDetectorRef.markForCheck();
    afterNextRender(() => view.restore(), { injector: this.environment });
    return view.ref.instance;
  }

  public hide(tab: Tab, slot: HTMLElement): void {
    const view = this.views.get(tab.key);
    if (Object.isUndefined(view) || view.slot !== slot || view.isConcealed)
      return;
    view.conceal();
    this.mark(tab.key, false);
    view.ref.setInput(Resources.shownInput, false);
    this.application.detachView(view.ref.hostView);
    if (!this.layout.layout().isOpen(tab))
      this.remove(view);
  }

  public destroy(owns: (tab: Tab) => boolean): void {
    this.removeWhere(t => owns(t.tab));
  }

  private removeWhere(test: (view: LiveView) => boolean): void {
    const doomed = [...this.views.values()].filter(test);
    for (const view of doomed)
      this.remove(view);
    if (doomed.length > 0)
      this.destroyedValue.update(t => t + 1);
  }

  private create(tab: Tab): LiveView {
    const view = new LiveView(tab, createComponent(TabContentComponent, { environmentInjector: this.environment }));
    this.views.set(tab.key, view);
    return view;
  }

  private mark(key: string, isShown: boolean): void {
    if (this.shownValue().has(key) === isShown)
      return;
    const shown = new Set(this.shownValue());
    if (isShown)
      shown.add(key);
    else
      shown.delete(key);
    this.shownValue.set(shown);
  }

  private remove(view: LiveView): void {
    this.views.delete(view.tab.key);
    this.mark(view.tab.key, false);
    view.dispose();
    view.element.remove();
    view.ref.destroy();
  }
}
