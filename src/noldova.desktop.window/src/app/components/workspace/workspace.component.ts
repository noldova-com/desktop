/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusTrapFactory } from "@angular/cdk/a11y";
import { Component, DestroyRef, ElementRef, type Signal, type WritableSignal, afterRenderEffect, effect, inject, signal, untracked, viewChild } from "@angular/core";

import { AppearanceService } from "@noldova/ui.components.angular";

import { DockSide } from "../../enums/dock-side.js";
import type { ContributionMatch } from "../../models/contribution-match.js";
import type { GroupFrame } from "../../models/layout/group-frame.js";
import { LayoutMetrics } from "../../models/layout/layout-metrics.js";
import { LayoutService } from "../../services/layout.service.js";
import { StartupService } from "../../services/startup.service.js";
import { TabFocusService } from "../../services/tab-focus.service.js";
import { WindowPartHostService } from "../../services/window-part-host.service.js";
import { DockComponent } from "../dock/dock.component.js";
import { DockingGuidesComponent } from "../docking-guides/docking-guides.component.js";
import { EmptyWindowComponent } from "../empty-window/empty-window.component.js";
import { PlaceholderContentComponent } from "../placeholder-content/placeholder-content.component.js";
import { SplitSashComponent } from "../split-sash/split-sash.component.js";
import { TabGroupComponent } from "../tab-group/tab-group.component.js";
import { TabSlotComponent } from "../tab-slot/tab-slot.component.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-workspace",
  imports: [DockComponent, DockingGuidesComponent, EmptyWindowComponent, PlaceholderContentComponent, SplitSashComponent, TabGroupComponent, TabSlotComponent],
  templateUrl: "./workspace.component.html",
  styleUrl: "./workspace.component.css",
  host: {
    "[attr.inert]": "startup.isReconnecting() ? '' : null",
    "(focusin)": "remember($event)"
  }
})
export class WorkspaceComponent {
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly focusTraps: FocusTrapFactory = inject(FocusTrapFactory);
  private readonly host: WindowPartHostService = inject(WindowPartHostService);
  private readonly generation: Signal<number> = this.host.generation;
  private readonly placeholderContent: Signal<PlaceholderContentComponent | undefined> = viewChild(PlaceholderContentComponent);
  private focused: HTMLElement | null = null;
  private focusedGroup: number | null = null;

  protected readonly startup: StartupService = inject(StartupService);
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);
  protected readonly placeholder: Signal<ContributionMatch | null> = this.host.placeholder;

  public constructor() {
    const appearance = inject(AppearanceService);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.width.set(entry.contentRect.width);
        this.height.set(entry.contentRect.height);
      }
    });
    observer.observe(this.element);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    effect(() => {
      if (appearance.painted() > 0)
        this.layout.setMetrics(this.measure(untracked(() => appearance.typography().rootSize)));
    });
    effect(() => {
      const rem = appearance.typography().rootSize;
      this.layout.setViewport(this.width() / rem, this.height() / rem);
    });
    afterRenderEffect(() => {
      this.generation();
      if (!this.startup.isReconnecting())
        untracked(() => this.restoreFocus());
    });
    afterRenderEffect(() => {
      this.layout.geometry();
      untracked(() => this.keepDockFocus());
    });
    afterRenderEffect(() => {
      const content = this.placeholderContent();
      if (content?.isLoaded() === true)
        untracked(() => this.focusPlaceholder(content));
    });
  }

  protected remember(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement))
      return;
    const group = target.closest<HTMLElement>(Resources.tabGroupSelector)?.dataset[Resources.tabGroupData];
    this.focused = target;
    this.focusedGroup = Object.isUndefined(group) ? null : Number(group);
  }

  protected isEmptyDocuments(frame: GroupFrame): boolean {
    return frame.group.isDocuments && this.layout.registry().views.length === 0;
  }

  private measure(rootSize: number): LayoutMetrics {
    const probe = this.element.ownerDocument.createElement(Resources.lookProbeElement);
    this.element.append(probe);
    const metrics = LayoutMetrics.measure(probe, rootSize);
    probe.remove();
    return metrics;
  }

  private restoreFocus(): void {
    const document = this.element.ownerDocument;
    if (document.activeElement !== document.body)
      return;
    if (!Object.isNull(this.focused) && this.element.contains(this.focused)) {
      this.focused.focus({ preventScroll: true });
      return;
    }
    const tab = this.layout.layout().groups.find(t => t.id === this.focusedGroup)?.active;
    if (!Object.isNullOrUndefined(tab))
      this.tabFocus.focusIfLost(tab);
  }

  private focusPlaceholder(content: PlaceholderContentComponent): void {
    const document = this.element.ownerDocument;
    if (document.activeElement !== document.body || this.focusedGroup !== this.layout.layout().documents.id)
      return;
    const trap = this.focusTraps.create(content.element, true);
    trap.focusFirstTabbableElement({ preventScroll: true });
    trap.destroy();
  }

  private keepDockFocus(): void {
    const document = this.element.ownerDocument;
    const layout = this.layout.layout();
    const tab = layout.groups.find(t => t.id === this.focusedGroup)?.active;
    const side = this.sides.find(t => layout.dock(t).root?.groups.some(u => u.id === this.focusedGroup) === true);
    if (document.activeElement !== document.body || Object.isNullOrUndefined(tab) || Object.isUndefined(side) || !this.layout.geometry().isCollapsed(side))
      return;
    this.element.querySelectorAll<HTMLElement>(Resources.formatDockStripView(side, tab.key)).forEach(t => t.focus());
  }
}
