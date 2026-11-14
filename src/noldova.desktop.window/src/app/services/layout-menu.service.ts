/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import { MenuItem } from "../models/menu-item.js";
import { ViewTab } from "../models/layout/view-tab.js";
import { Resources } from "../../resources.js";
import { LayoutService } from "./layout.service.js";
import { MenuService } from "./menu.service.js";
import { TabLabelService } from "./tab-label.service.js";

@Injectable({ providedIn: "root" })
export class LayoutMenuService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);

  public constructor() {
    inject(MenuService).provideGroup(Resources.layoutViewsGroup, () => this.items());
  }

  private items(): readonly MenuItem[] {
    return this.layout.registry().views.filter(t => !t.hasInstances).map(t => MenuItem.ofCommand(Resources.toggleViewCommand, { [Resources.viewArgument]: t.name }, this.labels.of(new ViewTab(t.name)).title));
  }
}
