/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { Injectable, type Signal, type WritableSignal, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import { DialogService } from "@noldova/ui.components.angular";
import { ArgumentException } from "@noldova/context.exceptions";
import { QualifiedName } from "@noldova/desktop.protocol";

import { ViewDialogComponent } from "../components/view-dialog/view-dialog.component.js";
import { ViewDialogRefusal } from "../enums/view-dialog-refusal.js";
import { ViewDialogException } from "../exceptions/view-dialog.exception.js";
import { DocumentTab } from "../models/layout/document-tab.js";
import type { Tab } from "../models/layout/tab.js";
import type { TabReveal } from "../models/layout/tab-reveal.js";
import { Resources } from "../../resources.js";
import { LayoutService } from "./layout.service.js";
import { LiveViewService } from "./live-view.service.js";
import { StartupService } from "./startup.service.js";
import { TabFocusService } from "./tab-focus.service.js";
import { TabLabelService } from "./tab-label.service.js";

@Injectable({ providedIn: "root" })
export class ViewDialogService {
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly startup: StartupService = inject(StartupService);
  private readonly liveViews: LiveViewService = inject(LiveViewService);
  private readonly shownValue: WritableSignal<Tab | null> = signal(null);
  private dialog: DialogRef<unknown, ViewDialogComponent> | null = null;
  private wasOpen: boolean = false;
  private shownAfter: number = 0;
  private focusedAfter: Tab | null = null;

  public readonly shown: Signal<Tab | null> = this.shownValue.asReadonly();

  public constructor() {
    effect(() => {
      const tab = this.shownValue();
      if (!Object.isNull(tab) && !this.isShowable(tab))
        untracked(() => this.close());
    });
    effect(() => {
      const reveal = this.layout.revealed();
      if (!Object.isNull(reveal))
        untracked(() => this.leaveFor(reveal));
    });
  }

  public canShow(tab: Tab): boolean {
    return !this.dialogs.isOpen && !this.startup.isReconnecting() && tab.isAvailable(this.layout.registry());
  }

  public showAsync(tab: Tab, title: string | null = null): Promise<void> {
    if (this.dialogs.isOpen)
      return Promise.reject(new ViewDialogException(ViewDialogRefusal.AlreadyOpen));
    if (this.startup.isReconnecting())
      return Promise.reject(new ViewDialogException(ViewDialogRefusal.Reconnecting));
    if (!tab.isAvailable(this.layout.registry()))
      return Promise.reject(new ArgumentException(tab instanceof DocumentTab ? Resources.formatUnregisteredDocument(tab.name) : Resources.formatUnregisteredView(tab.name), Resources.tabParameterName));
    if (!Object.isNull(title))
      this.labels.setTitle(tab, title);
    this.wasOpen = this.layout.layout().isOpen(tab);
    this.shownAfter = this.layout.revealed()?.sequence ?? 0;
    this.shownValue.set(tab);
    this.liveViews.prepareLeave(tab);
    this.layout.hide(tab);
    const dialog = this.dialogs.open(ViewDialogComponent);
    this.dialog = dialog;
    return new Promise(resolve => dialog.closed.subscribe(() => {
      this.dialog = null;
      this.shownValue.set(null);
      this.layout.hide(null);
      const focused = this.focusedAfter;
      this.focusedAfter = null;
      if (Object.isNull(focused))
        this.tabFocus.focusIfLost(tab);
      else
        this.tabFocus.focus(focused);
      resolve();
    }));
  }

  public ownsCommand(name: string): boolean {
    const tab = this.shownValue();
    if (Object.isNull(tab) || Object.isNull(this.dialog) || !this.dialogs.isTopmost(this.dialog))
      return false;
    const owner = QualifiedName.parse(tab.name);
    return !owner.isShell && owner.owner === QualifiedName.parse(name).owner;
  }

  public close(): void {
    const tab = this.shownValue();
    if (!Object.isNull(tab) && !Object.isNull(this.dialog))
      this.liveViews.prepareLeave(tab);
    this.dialog?.close();
  }

  public closeShowing(name: string, instance: string | null): void {
    const tab = this.shownValue();
    if (Object.isNull(tab) || tab.name !== name || (!Object.isNull(instance) && tab.instance !== instance))
      return;
    const reveal = this.layout.revealed();
    if (!Object.isNull(reveal) && this.isLeftFor(reveal))
      this.focusedAfter = reveal.tab;
    this.close();
  }

  public openInMainWindow(tab: Tab): void {
    if (this.layout.layout().isOpen(tab))
      this.layout.activate(tab);
    else
      this.layout.openInCurrentGroup(tab);
    this.focusedAfter = tab;
    this.close();
  }

  private leaveFor(reveal: TabReveal): void {
    if (!this.isLeftFor(reveal))
      return;
    this.focusedAfter = reveal.tab;
    this.close();
  }

  private isLeftFor(reveal: TabReveal): boolean {
    return !Object.isNull(this.dialog) && reveal.sequence > this.shownAfter && reveal.tab instanceof DocumentTab && !reveal.tab.equals(this.shownValue())
      && this.layout.layout().isOpen(reveal.tab);
  }

  private isShowable(tab: Tab): boolean {
    return !this.startup.isReconnecting() && tab.isAvailable(this.layout.registry()) && (!this.wasOpen || this.layout.layout().isOpen(tab));
  }
}
