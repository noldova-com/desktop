/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, inject } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { QualifiedName } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";
import type { CommandRow } from "../models/command-row.js";
import type { TabGroup } from "../models/layout/tab-group.js";
import { DocumentTab } from "../models/layout/document-tab.js";
import { ViewTab } from "../models/layout/view-tab.js";
import type { SubmenuRow } from "../models/submenu-row.js";
import { CommandService } from "./command.service.js";
import { LayoutService } from "./layout.service.js";
import { MenuService } from "./menu.service.js";

@Injectable({ providedIn: "root" })
export class TabRowService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly menus: MenuService = inject(MenuService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public rowsOf(group: TabGroup): readonly (CommandRow | SubmenuRow)[] {
    const names = new Set(group.tabs.filter(t => t instanceof ViewTab).map(t => t.name));
    const registry = this.layout.registry();
    const documents = new Set(group.tabs.filter(t => t instanceof DocumentTab).flatMap(t => registry.documentTabRowPlace(t.name) ?? []));
    const places = new Set([...registry.views.filter(t => names.has(t.name)).flatMap(t => t.tabRowPlace ?? []), ...documents]);
    return [...places].flatMap(t => this.menus.resolve(t, TabRowService.contextOf(group, documents.has(t) ? t : null))).flatMap(t => t.rows);
  }

  public run(row: CommandRow): void {
    if (row.isEnabled)
      this.commands.runAsync(row.command, row.commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }

  private static contextOf(group: TabGroup, documentPlace: string | null): JsonObject {
    const active = group.active;
    const tabGroup = { [Resources.tabGroupArgument]: group.id.toString() };
    if (Object.isNull(documentPlace) || !(active instanceof DocumentTab) || Object.isUndefined(active.instance))
      return tabGroup;
    return QualifiedName.find(active.name)?.owner === QualifiedName.find(documentPlace)?.owner
      ? { ...tabGroup, [Resources.documentArgument]: active.name, [Resources.instanceArgument]: active.instance }
      : tabGroup;
  }
}
