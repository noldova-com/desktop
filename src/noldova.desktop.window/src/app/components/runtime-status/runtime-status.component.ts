/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, type Signal, computed, inject } from "@angular/core";

import { StartupStateKind } from "../../enums/startup-state-kind.js";
import type { StartupState } from "../../models/startup-state.js";
import { StartupService } from "../../services/startup.service.js";
import { ProductName } from "../../models/product-name.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-runtime-status",
  templateUrl: "./runtime-status.component.html",
  styleUrl: "./runtime-status.component.css"
})
export class RuntimeStatusComponent {
  private readonly state: Signal<StartupState> = inject(StartupService).state;

  protected readonly status: Signal<string> = computed(() => this.state().isReady ? Resources.runtimeConnected : Resources.runtimeNotConnected);
  protected readonly details: Signal<readonly string[]> = computed(() => RuntimeStatusComponent.detailsOf(this.state()).filter(t => t.length > 0));

  private static detailsOf(state: StartupState): readonly string[] {
    const [first = String.empty] = state.details;
    switch (state.kind) {
      case StartupStateKind.Ready:
        return [];
      case StartupStateKind.PreShellData:
        return [Resources.formatPreShellDataTitle(ProductName.current), first];
      case StartupStateKind.Failed:
        return [Resources.formatFailedTitle(ProductName.current), first];
      case StartupStateKind.WorkInProgress:
        return [Resources.formatWorkInProgressTitle(ProductName.current), ...state.details];
      case StartupStateKind.WaitingForWork:
        return [Resources.formatWaitingTitle(ProductName.current), ...state.details];
      case StartupStateKind.NewerBuild:
        return [Resources.formatNewerBuildTitle(ProductName.current), Resources.formatNewerBuild(ProductName.current, first)];
      case StartupStateKind.Updating:
        return [Resources.formatUpdatingTitle(ProductName.current, first)];
      default:
        return [Resources.formatStartingTitle(ProductName.current)];
    }
  }
}
