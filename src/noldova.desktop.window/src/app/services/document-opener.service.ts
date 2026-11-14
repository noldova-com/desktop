/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../../resources.js";
import type { DocumentHeading } from "../models/document-heading.js";
import { DocumentTab } from "../models/layout/document-tab.js";
import { LayoutService } from "./layout.service.js";
import { TabFocusService } from "./tab-focus.service.js";
import { TabLabelService } from "./tab-label.service.js";
import { ViewDialogService } from "./view-dialog.service.js";

@Injectable({ providedIn: "root" })
export class DocumentOpenerService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly viewDialogs: ViewDialogService = inject(ViewDialogService);

  public open(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean, after: string | null = null): void {
    this.layout.openDocument(this.titled(moduleId, name, instance, heading), isPreview, Object.isNull(after) ? null : new DocumentTab(name, after));
  }

  public restore(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean): void {
    this.layout.restoreDocument(this.titled(moduleId, name, instance, heading), isPreview);
  }

  public restoreSaved(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean): void {
    const tab = this.titled(moduleId, name, instance, heading);
    if (this.layout.layout().isOpen(tab))
      this.layout.restoreDocument(tab, isPreview);
  }

  public keep(moduleId: string, name: string, instance: string): void {
    this.requireOwnDocument(moduleId, name);
    this.layout.keep(new DocumentTab(name, instance));
  }

  public close(moduleId: string, name: string, instance: string): void {
    this.requireOwnDocument(moduleId, name);
    const tab = new DocumentTab(name, instance);
    if (tab.equals(this.viewDialogs.shown()))
      this.viewDialogs.close();
    const group = this.layout.layout().groupOf(tab);
    if (Object.isNull(group))
      return;
    this.layout.close(tab);
    const next = this.layout.layout().group(group.id)?.active ?? this.layout.currentGroup().active;
    if (!Object.isNull(next))
      this.tabFocus.focusIfLost(next);
  }

  public update(moduleId: string, name: string, instance: string, title: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null = null): void {
    this.requireOwnDocument(moduleId, name);
    const tab = new DocumentTab(name, instance);
    if (this.layout.layout().isOpen(tab))
      this.labels.setHeading(tab, this.labels.headingOf(tab).with(title, breadcrumb, breadcrumbIcon));
  }

  private titled(moduleId: string, name: string, instance: string, heading: DocumentHeading): DocumentTab {
    this.requireOwnDocument(moduleId, name);
    const tab = new DocumentTab(name, instance);
    this.labels.setHeading(tab, heading);
    return tab;
  }

  private requireOwnDocument(moduleId: string, name: string): void {
    if (!name.startsWith(`${moduleId}${Resources.contributionSeparator}`))
      throw new ArgumentException(Resources.formatForeignDocument(moduleId, name), Resources.nameParameterName);
    if (!this.layout.registry().hasDocument(name))
      throw new ArgumentException(Resources.formatUnregisteredDocument(name), Resources.nameParameterName);
  }
}
