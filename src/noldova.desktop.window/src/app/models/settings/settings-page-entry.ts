/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ModuleFailure } from "../module-failure.js";
import type { SettingsPageContribution } from "../settings-page-contribution.js";
import type { SettingsRow } from "./settings-row.js";
import type { WindowPartContext } from "../window-part-context.js";

export class SettingsPageEntry {
  public readonly name: string;
  public readonly title: string;
  public readonly moduleId: string;
  public readonly page: SettingsPageContribution | null;
  public readonly context: WindowPartContext | null;
  public readonly failure: ModuleFailure | null;

  public constructor(name: string, title: string, moduleId: string, page: SettingsPageContribution | null, context: WindowPartContext | null, failure: ModuleFailure | null) {
    this.name = name;
    this.title = title;
    this.moduleId = moduleId;
    this.page = page;
    this.context = context;
    this.failure = failure;
  }

  public get rows(): readonly SettingsRow[] {
    return this.context?.settingsRowsOf(this.name) ?? [];
  }

  public isSame(other: SettingsPageEntry): boolean {
    return this.name === other.name && this.title === other.title && this.page === other.page && this.context === other.context && this.failure === other.failure;
  }
}
