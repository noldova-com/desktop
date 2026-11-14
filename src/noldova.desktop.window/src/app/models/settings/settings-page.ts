/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SettingDefinition } from "@noldova/desktop.protocol";

import { Resources } from "../../../resources.js";
import { SettingsGroup } from "./settings-group.js";
import type { SettingsPageEntry } from "./settings-page-entry.js";

export class SettingsPage {
  public readonly title: string;
  public readonly groups: readonly SettingsGroup[];
  public readonly isShortcuts: boolean;
  public readonly isGallery: boolean;
  public readonly isAbout: boolean;
  public readonly isGeneral: boolean;
  public readonly entry: SettingsPageEntry | null;

  public constructor(title: string, groups: readonly SettingsGroup[], isShortcuts: boolean = false, isGallery: boolean = false, entry: SettingsPageEntry | null = null) {
    this.title = title;
    this.groups = [...groups];
    this.isShortcuts = isShortcuts;
    this.isGallery = isGallery;
    this.isAbout = title === Resources.aboutPage;
    this.isGeneral = title === Resources.generalPage;
    this.entry = entry;
  }

  public static galleryOf(title: string): SettingsPage {
    return new SettingsPage(title, [], false, true);
  }

  public static pagesOf(definitions: readonly SettingDefinition[], extra: readonly SettingsPage[] = [], own: readonly SettingsPageEntry[] = []): readonly SettingsPage[] {
    const pages = definitions.map(t => t.page);
    const titles = [...new Set([...Resources.leadingSettingsPages, ...pages])]
      .filter(t => t !== Resources.aboutPage && (t !== Resources.generalPage || pages.includes(t)) && !own.some(u => u.title === t));
    return [
      ...SettingsPage.placeOwn(titles, definitions, own).map(place => !Object.isString(place)
        ? new SettingsPage(place.title, SettingsPage.groupsOf(definitions.filter(t => t.page === place.title)), false, false, place)
        : place === Resources.shortcutsPage
          ? new SettingsPage(place, [], true)
          : new SettingsPage(place, SettingsPage.groupsOf(definitions.filter(t => t.page === place)))),
      ...extra,
      new SettingsPage(Resources.aboutPage, SettingsPage.groupsOf(definitions.filter(t => t.page === Resources.aboutPage)))
    ];
  }

  public filter(isMatch: (definition: SettingDefinition) => boolean): SettingsPage {
    return new SettingsPage(this.title, this.groups.map(t => new SettingsGroup(t.title, t.definitions.filter(isMatch))).filter(t => t.definitions.length > 0), this.isShortcuts, false, this.entry);
  }

  private static placeOwn(titles: readonly string[], definitions: readonly SettingDefinition[], own: readonly SettingsPageEntry[]): readonly (string | SettingsPageEntry)[] {
    const placed: (string | SettingsPageEntry)[] = [...titles];
    for (const entry of own) {
      const last = placed.findLastIndex(t => Object.isString(t)
        ? !Resources.leadingSettingsPages.includes(t) && definitions.some(u => u.page === t && u.name.owner === entry.moduleId)
        : t.moduleId === entry.moduleId);
      placed.splice(last < 0 ? placed.length : last + 1, 0, entry);
    }
    return placed;
  }

  private static groupsOf(definitions: readonly SettingDefinition[]): readonly SettingsGroup[] {
    return [...new Set(definitions.map(t => t.group))].map(group => new SettingsGroup(group, definitions.filter(t => t.group === group)));
  }
}
