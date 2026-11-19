/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusTrapFactory } from "@angular/cdk/a11y";
import { NgComponentOutlet } from "@angular/common";
import {
  Component, DestroyRef, ElementRef, ErrorHandler, Injector, type InputSignal, type ResourceRef, type Signal, type Type, type WritableSignal, afterRenderEffect, computed,
  inject, input, resource, signal, untracked
} from "@angular/core";

import "@noldova/context.core";
import { ModuleState } from "@noldova/desktop.protocol";

import { ContentPadding } from "../../enums/content-padding.js";
import { PageNotLoadedException } from "../../exceptions/page-not-loaded.exception.js";
import { ContentPaddingRef } from "../../models/content-padding-ref.js";
import { Bounds } from "../../models/layout/bounds.js";
import { DocumentTab } from "../../models/layout/document-tab.js";
import type { Tab } from "../../models/layout/tab.js";
import { ModuleFailure } from "../../models/module-failure.js";
import { TabContent } from "../../models/tab-content.js";
import type { WindowPartContext } from "../../models/window-part-context.js";
import { WindowPartTokens } from "../../models/window-part-tokens.js";
import { Resources } from "../../../resources.js";
import { DockGrowthService } from "../../services/dock-growth.service.js";
import { LayoutService } from "../../services/layout.service.js";
import { ModuleStatusService } from "../../services/module-status.service.js";
import { TabFocusService } from "../../services/tab-focus.service.js";
import { TabLabelService } from "../../services/tab-label.service.js";
import { WindowPartHostService } from "../../services/window-part-host.service.js";
import { ModuleFailureCardComponent } from "../module-failure-card/module-failure-card.component.js";

@Component({
  selector: "nol-tab-content",
  imports: [NgComponentOutlet],
  templateUrl: "./tab-content.component.html",
  styleUrl: "./tab-content.component.css",
  host: {
    "[class.nol-tab-content-padded]": "isPadded()",
    "[class.nol-tab-content-docked]": "isDocked()",
    "[attr.data-tab-content]": "tab().key",
    "(focusin)": "remember($event)"
  }
})
export class TabContentComponent {
  private readonly host: WindowPartHostService = inject(WindowPartHostService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly injector: Injector = inject(Injector);
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly focusTraps: FocusTrapFactory = inject(FocusTrapFactory);
  private readonly growth: DockGrowthService = inject(DockGrowthService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly revision: Signal<number> = computed(() => this.host.revisionOf(this.tab()));
  private readonly stableTab: Signal<Tab> = computed(() => this.tab(), { equal: (a, b) => a.equals(b) });
  private readonly isActiveDocument: Signal<boolean> = computed(() => this.tab().equals(this.layout.layout().documents.active));
  private focused: HTMLElement | null = null;
  private isRetrying: boolean = false;
  private readonly changes: MutationObserver = new MutationObserver(() => this.retry());
  private readonly failedModule: WritableSignal<string | null> = signal(null);
  private readonly loaded: ResourceRef<TabContent | null | undefined> = resource({
    params: () => ({ tab: this.stableTab(), revision: this.revision() }),
    loader: ({ params, abortSignal }) => this.loadAsync(params.tab, abortSignal)
  });
  private readonly pageFailure: Signal<TabContent | null> = computed(() => {
    const moduleId = this.failedModule();
    if (Object.isNull(moduleId))
      return null;
    const displayName = this.statuses.modules().find(t => t.id === moduleId)?.displayName ?? moduleId;
    const failure = new ModuleFailure(moduleId, displayName, ModuleState.Failed, Resources.pageLoadFailed, []);
    return new TabContent(ModuleFailureCardComponent, this.injector, { failure }, ContentPadding.Default, new ContentPaddingRef());
  });

  protected readonly content: Signal<TabContent | null | undefined> = computed(() => this.pageFailure() ?? this.loaded.value());
  protected readonly isPadded: Signal<boolean> = computed(() => {
    const value = this.content();
    return !Object.isNullOrUndefined(value) && (value.pagePadding.value() ?? value.padding) === ContentPadding.Default;
  });

  public readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  public readonly tab: InputSignal<Tab> = input.required<Tab>();
  public readonly isDocked: InputSignal<boolean> = input<boolean>(false);
  public readonly isShown: InputSignal<boolean> = input<boolean>(true);
  public readonly isLoaded: Signal<boolean> = computed(() => this.loaded.hasValue());

  public constructor() {
    afterRenderEffect({
      read: () => {
        const isAsked = this.tabFocus.content() === this.tab().key && this.isLoaded();
        untracked(() => this.follow(isAsked));
      }
    });
    afterRenderEffect({
      read: () => {
        const isAsked = this.isDocked() && this.isShown() && this.isLoaded() && !Object.isNull(this.growth.minimumOf(this.tab()));
        if (isAsked)
          untracked(() => this.growDock());
      }
    });
    inject(DestroyRef).onDestroy(() => this.changes.disconnect());
  }

  protected remember(event: FocusEvent): void {
    if (event.target instanceof HTMLElement)
      this.focused = event.target;
  }

  private follow(isAsked: boolean): void {
    this.changes.disconnect();
    if (isAsked && !this.focusInside())
      this.changes.observe(this.element, { childList: true, subtree: true });
  }

  private growDock(): void {
    const style = getComputedStyle(this.element);
    const width = this.element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
    const height = this.element.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);
    const rootSize = Number.parseFloat(getComputedStyle(this.element.ownerDocument.documentElement).fontSize);
    if (width > 0 && height > 0)
      this.growth.fit(this.tab(), new Bounds(0, 0, width / rootSize, height / rootSize));
  }

  private retry(): void {
    if (this.isRetrying)
      return;
    this.isRetrying = true;
    requestAnimationFrame(() => {
      this.isRetrying = false;
      if (this.tabFocus.isContentAsked(this.tab()))
        this.focusInside();
    });
  }

  private focusInside(): boolean {
    if (!Object.isNull(this.focused) && this.element.contains(this.focused))
      this.focused.focus({ preventScroll: true });
    if (!this.hasFocus()) {
      const trap = this.focusTraps.create(this.element, true);
      trap.focusFirstTabbableElement({ preventScroll: true });
      trap.destroy();
    }
    const isInside = this.hasFocus();
    if (isInside)
      this.tabFocus.settleContent(this.tab());
    return isInside;
  }

  private hasFocus(): boolean {
    return this.element.contains(this.element.ownerDocument.activeElement);
  }

  private async loadAsync(tab: Tab, signal: AbortSignal): Promise<TabContent | null> {
    this.failedModule.set(null);
    const match = this.host.findContribution(tab);
    const pagePadding = new ContentPaddingRef();
    if (Object.isNull(match)) {
      const failure = this.host.findFailure(tab);
      return Object.isNull(failure) ? null : new TabContent(ModuleFailureCardComponent, this.injector, { failure }, ContentPadding.Default, pagePadding);
    }

    let component: Type<unknown>;
    try {
      component = await match.loadComponent();
    }
    catch (error) {
      return this.failLoad(match.context, error, signal);
    }
    const page = [{ provide: WindowPartTokens.contentPadding, useValue: pagePadding }, { provide: WindowPartTokens.shown, useValue: this.isShown },
      { provide: WindowPartTokens.activeDocument, useValue: this.isActiveDocument }];
    if (Object.isNull(match.context))
      return new TabContent(component, Injector.create({ providers: page, parent: this.injector }), {}, match.padding, pagePadding);
    const injector = Injector.create({ providers: [{ provide: WindowPartTokens.context, useValue: match.context }, ...page], parent: this.injector });
    const inputs = tab instanceof DocumentTab || !Object.isUndefined(tab.instance) ? { instance: tab.instance, title: this.labels.of(tab).title } : {};
    return new TabContent(component, injector, inputs, match.padding, pagePadding);
  }

  private failLoad(context: WindowPartContext | null, error: unknown, signal: AbortSignal): null {
    this.errors.handleError(Object.isNull(context) ? error : new PageNotLoadedException(context.moduleId, error));
    if (!signal.aborted)
      this.failedModule.set(context?.moduleId ?? null);
    return null;
  }
}
