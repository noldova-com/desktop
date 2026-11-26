/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import "@noldova/context.core";
import type { SettingDefinition } from "@noldova/desktop.protocol";
import { QuickInputItem } from "@noldova/ui.components.angular";

import { UpdateStateKind } from "../enums/update-state-kind.js";
import { CommandMatch } from "../models/command-match.js";
import { CommandMatcher } from "../models/command-matcher.js";
import { CommandSearchEntry } from "../models/command-search-entry.js";
import { KnownIcon } from "../models/known-icon.js";
import { SearchAnswer } from "../models/search-answer.js";
import { SearchRank } from "../models/search-rank.js";
import { SearchResult } from "../models/search-result.js";
import { SearchSourceContribution } from "../models/search-source-contribution.js";
import { TextRange } from "../models/text-range.js";
import { ClockSettingService } from "./clock-setting.service.js";
import { CommandService } from "./command.service.js";
import { MenuBarService } from "./menu-bar.service.js";
import { RecentCommandsService } from "./recent-commands.service.js";
import { SettingsPageService } from "./settings-page.service.js";
import { SettingsRowsService } from "./settings-rows.service.js";
import { SettingsService } from "./settings.service.js";
import { UpdateService } from "./update.service.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class ShellSearchSourcesService {
  private readonly commands: CommandService = inject(CommandService);
  private readonly menuBar: MenuBarService = inject(MenuBarService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly clock: ClockSettingService = inject(ClockSettingService);
  private readonly updates: UpdateService = inject(UpdateService);
  private readonly recent: RecentCommandsService = inject(RecentCommandsService);
  private readonly pages: SettingsPageService = inject(SettingsPageService);
  private readonly rows: SettingsRowsService = inject(SettingsRowsService);

  private readonly entries: Signal<readonly CommandSearchEntry[]> = computed(() => [
    ...this.commands.commands().filter(t => this.commands.isEnabled(t.name))
      .map(t => new CommandSearchEntry(new QuickInputItem(t.name, t.title, KnownIcon.of(t.icon), this.commands.ownerOf(t.name), this.commands.keyLabel(t.name)), () => this.commands.run(t.name))),
    ...this.menuBar.searchRows().map(t => new CommandSearchEntry(new QuickInputItem(t.id, t.title, t.icon, t.menu, null), () => this.menuBar.run(t.id)))
  ].sort((a, b) => a.item.title.localeCompare(b.item.title) || a.detail.localeCompare(b.detail)));
  private readonly definitions: Signal<readonly SettingDefinition[]> = computed(() => {
    const definitions = this.settings.definitions().flatMap(t => t.name.text === Resources.timeFormatSetting ? [this.clock.definition, t] : [t]);
    return this.updates.state().kind === UpdateStateKind.Off ? definitions.filter(t => t.page !== Resources.aboutPage) : definitions;
  });

  public readonly commandsChanged: Signal<readonly unknown[]> = this.entries;
  public readonly commandsSource: SearchSourceContribution = new SearchSourceContribution(Resources.commandsSearchSource, Resources.commandsSearchLabel,
    Resources.commandsPlaceholderName, Resources.commandsSearchLabel, Resources.recentCommandsHeading, Resources.commandsSearchGlyph,
    () => Promise.resolve(this.recentCommands()), query => Promise.resolve(this.searchCommands(query)));
  public readonly settingsSource: SearchSourceContribution = new SearchSourceContribution(Resources.settingsSearchSource, Resources.settingsSearchLabel,
    Resources.settingsPlaceholderName, Resources.settingsSearchLabel, null, Resources.settingsSearchGlyph,
    () => Promise.resolve([]), query => Promise.resolve(this.searchSettings(query)));

  private recentCommands(): readonly SearchResult[] {
    const limit = this.settings.values().get(Resources.recentCommandCountSetting);
    const entries = new Map(this.entries().map(t => [t.item.id, t]));
    return this.recent.ids().flatMap(t => entries.get(t) ?? []).slice(0, Object.isNumber(limit) ? limit : 0).map(t => this.commandResult(t, null));
  }

  private searchCommands(query: string): SearchAnswer {
    return ShellSearchSourcesService.answerOf(query, this.entries().map(t => ({ title: t.item.title, detail: t.detail, create: (match: CommandMatch) => this.commandResult(t, match) })));
  }

  private searchSettings(query: string): SearchAnswer {
    return ShellSearchSourcesService.answerOf(query, [
      ...this.definitions().map(t => this.settingCandidate(t.name.text, t.page, t.title, t.name.text)),
      ...this.rows.rows().map(t => this.settingCandidate(Resources.formatSearchRowId(t.page, t.row.id), t.page, t.row.title, t.row.id))
    ]);
  }

  private settingCandidate(id: string, page: string, title: string, setting: string): { readonly title: string; readonly detail: string; readonly create: (match: CommandMatch) => SearchResult } {
    const shown = Resources.formatSettingSearchTitle(page, title);
    const detail = Resources.formatSettingSearchDetail(page);
    return {
      title: shown,
      detail,
      create: (match: CommandMatch) => new SearchResult(id, shown, detail, () => {
        this.pages.open(page, setting);
        return Promise.resolve();
      }, ShellSearchSourcesService.rangeOf(match.titleMatches), ShellSearchSourcesService.rangeOf(match.detailMatches))
    };
  }

  private commandResult(entry: CommandSearchEntry, match: CommandMatch | null): SearchResult {
    return new SearchResult(entry.item.id, entry.item.title, entry.detail, () => {
      this.recent.record(entry.item.id);
      entry.run();
      return Promise.resolve();
    }, ShellSearchSourcesService.rangeOf(match?.titleMatches ?? []), ShellSearchSourcesService.rangeOf(match?.detailMatches ?? []), entry.item.keyLabel ?? null);
  }

  private static answerOf(query: string, candidates: readonly { readonly title: string; readonly detail: string; readonly create: (match: CommandMatch) => SearchResult }[]): SearchAnswer {
    const found = candidates.flatMap(t => {
      const match = query.length === 0 ? CommandMatch.none : CommandMatcher.match(query, t.detail, t.title);
      return Object.isNull(match) ? [] : [{ rank: SearchRank.of(query, t.title) ?? SearchRank.anywhere + 1, result: t.create(match) }];
    });
    return new SearchAnswer(found.sort((a, b) => a.rank - b.rank).map(t => t.result));
  }

  private static rangeOf(indices: readonly number[]): TextRange | null {
    return indices.length === 0 ? null : new TextRange(Math.min(...indices), indices.length);
  }
}
