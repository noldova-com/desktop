/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import type { ISettingsPageRow } from "../interfaces/i-settings-page-row.js";
import { SettingsRow } from "../models/settings/settings-row.js";
import { Resources } from "../../resources.js";
import { CommandService } from "./command.service.js";
import { WindowPartHostService } from "./window-part-host.service.js";

@Injectable({ providedIn: "root" })
export class SettingsRowsService {
  private readonly commands: CommandService = inject(CommandService);
  private readonly parts: WindowPartHostService = inject(WindowPartHostService);

  public readonly rows: Signal<readonly ISettingsPageRow[]> = computed(() => [
    ...this.commands.commands().map(t => ({ page: Resources.shortcutsPage, row: new SettingsRow(t.name, t.title, this.commands.keyLabel(t.name)) })),
    ...this.parts.settingsPages().flatMap(t => t.rows.map(u => ({ page: t.title, row: u })))
  ]);
}
