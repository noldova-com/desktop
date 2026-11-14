/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, inject } from "@angular/core";

import { UpdateAction } from "../../enums/update-action.js";
import { UpdateStateKind } from "../../enums/update-state-kind.js";
import type { UpdateState } from "../../models/update-state.js";
import { UpdateService } from "../../services/update.service.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-update-item",
  templateUrl: "./update-item.component.html",
  styleUrl: "./update-item.component.css"
})
export class UpdateItemComponent {
  private readonly updates: UpdateService = inject(UpdateService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof UpdateStateKind = UpdateStateKind;
  protected readonly state: Signal<UpdateState> = this.updates.state;

  protected restart(): void {
    this.updates.act(UpdateAction.Restart);
  }

  protected openAbout(): void {
    this.updates.openAbout();
  }
}
