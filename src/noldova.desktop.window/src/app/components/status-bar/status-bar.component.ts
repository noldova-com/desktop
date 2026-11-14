/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject } from "@angular/core";

import { BarItemsService } from "../../services/bar-items.service.js";
import { ModuleFailuresComponent } from "../module-failures/module-failures.component.js";
import { NotificationsComponent } from "../notifications/notifications.component.js";
import { StatusBarItemComponent } from "../status-bar-item/status-bar-item.component.js";
import { UpdateService } from "../../services/update.service.js";
import { UpdateItemComponent } from "../update-item/update-item.component.js";

@Component({
  selector: "nol-status-bar",
  imports: [ModuleFailuresComponent, NotificationsComponent, StatusBarItemComponent, UpdateItemComponent],
  templateUrl: "./status-bar.component.html",
  styleUrl: "./status-bar.component.css",
  host: {
    "data-nol-chrome": "bottom"
  }
})
export class StatusBarComponent {
  protected readonly bars: BarItemsService = inject(BarItemsService);
  protected readonly updates: UpdateService = inject(UpdateService);
}
