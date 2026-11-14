/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, inject } from "@angular/core";

import "@noldova/context.core";

import type { ModuleFailure } from "../../models/module-failure.js";
import { ModuleSelectionService } from "../../services/module-selection.service.js";
import { WindowPartHostService } from "../../services/window-part-host.service.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-module-failures",
  templateUrl: "./module-failures.component.html",
  styleUrl: "./module-failures.component.css"
})
export class ModuleFailuresComponent {
  private readonly selection: ModuleSelectionService = inject(ModuleSelectionService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly failures: Signal<readonly ModuleFailure[]> = inject(WindowPartHostService).failures;

  protected open(id: string): void {
    this.selection.open(id);
  }
}
