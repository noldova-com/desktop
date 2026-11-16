/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { NgComponentOutlet } from "@angular/common";
import {
  Component, ErrorHandler, Injector, type InputSignal, type ResourceRef, type Signal, type Type, ViewEncapsulation, computed, inject, input, resource, signal
} from "@angular/core";

import "@noldova/context.core";
import { SpinnerComponent } from "@noldova/ui.components.angular";
import { ModuleState } from "@noldova/desktop.protocol";

import { SettingsPageNotLoadedException } from "../../exceptions/settings-page-not-loaded.exception.js";
import { ModuleFailure } from "../../models/module-failure.js";
import type { SettingsPageEntry } from "../../models/settings/settings-page-entry.js";
import { WindowPartTokens } from "../../models/window-part-tokens.js";
import { Resources } from "../../../resources.js";
import { ModuleStatusService } from "../../services/module-status.service.js";
import { ModuleFailureCardComponent } from "../module-failure-card/module-failure-card.component.js";

@Component({
  selector: "nol-settings-page-host",
  imports: [ModuleFailureCardComponent, NgComponentOutlet, SpinnerComponent],
  templateUrl: "./settings-page-host.component.html",
  styleUrl: "./settings-page-host.component.css",
  encapsulation: ViewEncapsulation.None
})
export class SettingsPageHostComponent {
  private readonly injector: Injector = inject(Injector);
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  protected readonly resources: typeof Resources = Resources;
  protected readonly component: ResourceRef<Type<unknown> | undefined> = resource({
    params: () => this.entry().page ?? undefined,
    loader: ({ params }) => params.loadComponent().catch((error: unknown) => {
      this.errors.handleError(new SettingsPageNotLoadedException(this.entry().moduleId, error));
      throw error;
    })
  });
  protected readonly loaded: Signal<Type<unknown> | null> = computed(() => this.component.hasValue() ? this.component.value() : null);
  protected readonly pageInjector: Signal<Injector> = computed(() => Injector.create({
    providers: [{ provide: WindowPartTokens.context, useValue: this.entry().context }, { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() },
      { provide: WindowPartTokens.activeDocument, useValue: signal(false).asReadonly() }],
    parent: this.injector
  }));
  protected readonly failure: Signal<ModuleFailure | null> = computed(() => {
    const entry = this.entry();
    if (!Object.isNull(entry.failure) || Object.isUndefined(this.component.error()))
      return entry.failure;
    const displayName = this.statuses.modules().find(t => t.id === entry.moduleId)?.displayName ?? entry.moduleId;
    return new ModuleFailure(entry.moduleId, displayName, ModuleState.Failed, Resources.settingsPageLoadFailed, []);
  });

  public readonly entry: InputSignal<SettingsPageEntry> = input.required<SettingsPageEntry>();
}
