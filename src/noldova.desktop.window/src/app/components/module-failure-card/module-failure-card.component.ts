/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, input } from "@angular/core";

import { CardComponent } from "@noldova/ui.components.angular";

import type { ModuleFailure } from "../../models/module-failure.js";
import { Resources } from "../../../resources.js";
import { ModuleSwitchComponent } from "../module-switch/module-switch.component.js";

@Component({
  selector: "nol-module-failure-card",
  imports: [CardComponent, ModuleSwitchComponent],
  templateUrl: "./module-failure-card.component.html",
  styleUrl: "./module-failure-card.component.css"
})
export class ModuleFailureCardComponent {
  protected readonly resources: typeof Resources = Resources;

  public readonly failure: InputSignal<ModuleFailure> = input.required<ModuleFailure>();
}
