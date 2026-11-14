/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, inject } from "@angular/core";

import { ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import { StartupStateKind } from "../../enums/startup-state-kind.js";
import type { StartupState } from "../../models/startup-state.js";
import { StartupService } from "../../services/startup.service.js";
import { ProductName } from "../../models/product-name.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-startup",
  imports: [ButtonComponent],
  templateUrl: "./startup.component.html",
  styleUrl: "./startup.component.css"
})
export class StartupComponent {
  private readonly startup: StartupService = inject(StartupService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly productName: string = ProductName.current;
  protected readonly kinds: typeof StartupStateKind = StartupStateKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: Signal<StartupState> = this.startup.state;
  protected readonly isActing: Signal<boolean> = this.startup.isActing;

  protected act(action: string): void {
    void this.startup.actAsync(action);
  }
}
