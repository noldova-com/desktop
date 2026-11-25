/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type TemplateRef, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/context.core";

import { BuildTokens } from "../models/build-tokens.js";
import { LayoutService } from "./layout.service.js";

@Injectable({ providedIn: "root" })
export class WindowRowTabsService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly barValue: WritableSignal<TemplateRef<unknown> | null> = signal(null);

  public readonly isEnabled: boolean = inject(BuildTokens.titleBar).documentTabs;
  public readonly groupId: Signal<number | null> = computed(() => this.isEnabled ? this.layout.layout().documentGroups.at(0)?.id ?? null : null);
  public readonly bar: Signal<TemplateRef<unknown> | null> = this.barValue.asReadonly();

  public show(bar: TemplateRef<unknown>): void {
    this.barValue.set(bar);
  }

  public withdraw(bar: TemplateRef<unknown>): void {
    if (this.barValue() === bar)
      this.barValue.set(null);
  }
}
