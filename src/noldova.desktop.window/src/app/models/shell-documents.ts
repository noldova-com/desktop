/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContentPadding } from "../enums/content-padding.js";
import { Resources } from "../../resources.js";
import { DocumentContribution } from "./document-contribution.js";
import { DocumentTab } from "./layout/document-tab.js";
import type { Tab } from "./layout/tab.js";
import { TabLabel } from "./layout/tab-label.js";

export class ShellDocuments {
  public static readonly settings: DocumentContribution = new DocumentContribution(
    Resources.settingsDocument,
    () => import("../components/settings/settings.component.js").then(t => t.SettingsComponent),
    ContentPadding.None);
  public static readonly settingsTab: DocumentTab = new DocumentTab(Resources.settingsDocument);
  public static readonly settingsLabel: TabLabel = new TabLabel(Resources.settingsTitle, Resources.settingsGlyph);
  public static readonly modules: DocumentContribution = new DocumentContribution(
    Resources.modulesDocument,
    () => import("../components/modules/modules.component.js").then(t => t.ModulesComponent),
    ContentPadding.None);
  public static readonly modulesTab: DocumentTab = new DocumentTab(Resources.modulesDocument);
  public static readonly modulesLabel: TabLabel = new TabLabel(Resources.modulesTitle, Resources.modulesGlyph);
  public static readonly all: readonly DocumentContribution[] = [ShellDocuments.settings, ShellDocuments.modules];

  public static find(tab: Tab): DocumentContribution | null {
    return tab instanceof DocumentTab ? ShellDocuments.all.find(t => t.name === tab.name) ?? null : null;
  }
}
