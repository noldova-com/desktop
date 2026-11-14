/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModulesComponent } from "../../../src/app/components/modules/modules.component";
import { SettingsComponent } from "../../../src/app/components/settings/settings.component";
import { ContentPadding } from "../../../src/app/enums/content-padding";
import { ShellDocuments } from "../../../src/app/models/shell-documents";

describe("ShellDocuments", () => {
  it("has Settings and Modules as the shell's documents, each in a tab without an instance, labelled with its title and glyph", async () => {
    expect(ShellDocuments.all.map(t => t.name)).toEqual(["desktop.settings", "desktop.modules"]);
    expect([ShellDocuments.settingsTab.key, ShellDocuments.settingsTab.instance]).toEqual(["document/desktop.settings", undefined]);
    expect([ShellDocuments.settingsLabel.title, ShellDocuments.settingsLabel.icon]).toEqual(["Settings", "settings"]);
    expect(await ShellDocuments.settings.loadComponent()).toBe(SettingsComponent);
    expect([ShellDocuments.modulesTab.key, ShellDocuments.modulesTab.instance]).toEqual(["document/desktop.modules", undefined]);
    expect([ShellDocuments.modulesLabel.title, ShellDocuments.modulesLabel.icon]).toEqual(["Modules", "extension"]);
    expect(await ShellDocuments.modules.loadComponent()).toBe(ModulesComponent);
  });

  it("lays out Settings and Modules edge to edge, since each pads its own scrolling areas", () => {
    expect(ShellDocuments.all.map(t => t.padding)).toEqual([ContentPadding.None, ContentPadding.None]);
  });
});
