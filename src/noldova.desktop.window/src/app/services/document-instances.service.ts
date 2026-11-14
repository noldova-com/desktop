/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, effect, inject } from "@angular/core";

import "@noldova/context.core";

import { ClosedTabs } from "../models/layout/closed-tabs.js";
import { DocumentTab } from "../models/layout/document-tab.js";
import { LayoutService } from "./layout.service.js";

@Injectable({ providedIn: "root" })
export class DocumentInstancesService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly closed: ClosedTabs = new ClosedTabs(DocumentTab, inject(ErrorHandler));

  public constructor() {
    effect(() => {
      this.closed.notice(this.layout.layout().groups.flatMap(t => t.tabs));
    });
  }

  public isUnheard(name: string, instance: string): boolean {
    return this.closed.isUnheard(new DocumentTab(name, instance));
  }

  public reopen(name: string, instance: string): void {
    this.closed.reopen(new DocumentTab(name, instance));
  }

  public hush(name: string, instance: string): void {
    this.closed.hush(new DocumentTab(name, instance));
  }

  public instancesOf(name: string): readonly string[] {
    return this.layout.layout().groups.flatMap(t => t.tabs).flatMap(t => t instanceof DocumentTab && t.name === name && !Object.isUndefined(t.instance) ? [t.instance] : []);
  }

  public reconcile(names: ReadonlySet<string>): void {
    this.closed.reconcile(names);
  }

  public onClosed(name: string, listener: (instance: string) => void): () => void {
    return this.closed.onClosed(name, listener);
  }
}
