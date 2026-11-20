/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, computed, signal } from "@angular/core";

import "@noldova/context.core";

import type { SearchAnswer } from "./search-answer.js";
import { SearchFilter } from "./search-filter.js";
import { SearchGroup } from "./search-group.js";
import { SearchQuery } from "./search-query.js";
import { SearchRank } from "./search-rank.js";
import type { SearchResult } from "./search-result.js";
import { SearchRow } from "./search-row.js";
import type { SearchSourceContribution } from "./search-source-contribution.js";
import { Resources } from "../../resources.js";

export class SearchSession {
  private readonly sources: readonly SearchSourceContribution[];
  private readonly commandsSource: string;
  private readonly fail: (source: SearchSourceContribution, error: unknown) => void;
  private readonly recentController: AbortController = new AbortController();
  private readonly queryValue: WritableSignal<SearchQuery> = signal(SearchQuery.empty);
  private readonly filterValue: WritableSignal<string | null> = signal(null);
  private readonly recentValue: WritableSignal<ReadonlyMap<string, readonly SearchResult[]>> = signal(new Map());
  private readonly answersValue: WritableSignal<ReadonlyMap<string, SearchAnswer>> = signal(new Map());
  private readonly waitingValue: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly answeredValue: WritableSignal<string> = signal(String.empty);
  private readonly asks: Map<string, number> = new Map();
  private searching: AbortController | null = null;
  private typed: string = String.empty;

  private readonly searched: Signal<readonly SearchSourceContribution[]> = computed(() =>
    this.queryValue().isCommandsOnly ? this.sources.filter(t => t.name === this.commandsSource) : this.sources);
  private readonly activeFilter: Signal<string | null> = computed(() => {
    const filter = this.filterValue();
    return this.searched().some(t => t.name === filter) ? filter : null;
  });

  public readonly query: Signal<SearchQuery> = this.queryValue.asReadonly();
  public readonly isSearching: Signal<boolean> = computed(() => this.waitingValue().size > 0);
  public readonly answeredText: Signal<string> = this.answeredValue.asReadonly();
  public readonly filters: Signal<readonly SearchFilter[]> = computed(() => {
    const filter = this.activeFilter();
    const query = this.queryValue();
    const answers = this.answersValue();
    return [
      new SearchFilter(null, Resources.allFilterLabel, null, false, Object.isNull(filter)),
      ...this.searched().map(t => {
        const answer = query.isEmpty ? undefined : answers.get(t.name);
        return new SearchFilter(t.name, t.label, answer?.total ?? null, answer?.isCapped ?? false, t.name === filter);
      })
    ];
  });
  public readonly groups: Signal<readonly SearchGroup[]> = computed(() => {
    const filter = this.activeFilter();
    const shown = this.searched().filter(t => Object.isNull(filter) || t.name === filter);
    const query = this.queryValue();
    const recent = query.isEmpty ? shown.flatMap(t => {
      const results = this.recentValue().get(t.name) ?? [];
      return Object.isNull(t.recentHeading) || results.length === 0 ? [] : [new SearchGroup(t.name, t.recentHeading, results.map(u => new SearchRow(t, u)))];
    }) : [];
    if (query.isEmpty && !query.isCommandsOnly)
      return recent;
    const listed = new Set(recent.flatMap(t => t.rows.map(u => u.id)));
    const answers = this.answersValue();
    const found = shown.map(t => ({ source: t, rows: (answers.get(t.name)?.results ?? []).map(u => new SearchRow(t, u)).filter(u => !listed.has(u.id)) }));
    const isMixed = shown.length > 1;
    const arrived = [...answers.keys()];
    const best = isMixed ? [...found].sort((a, b) => arrived.indexOf(a.source.name) - arrived.indexOf(b.source.name))
      .reduce<SearchRow | null>((kept, t) => kept ?? SearchSession.bestOf(query.text, t.rows), null) : null;
    const groups = found.flatMap(t => {
      const rows = t.rows.filter(u => u !== best).slice(0, isMixed ? Resources.searchGroupRows : t.rows.length);
      return rows.length === 0 ? [] : [new SearchGroup(t.source.name, t.source.heading, rows)];
    });
    return [...recent, ...Object.isNull(best) ? [] : [new SearchGroup(Resources.bestMatchGroup, Resources.bestMatchHeading, [best])], ...groups];
  });

  public constructor(sources: readonly SearchSourceContribution[], commandsSource: string, fail: (source: SearchSourceContribution, error: unknown) => void) {
    this.sources = sources;
    this.commandsSource = commandsSource;
    this.fail = fail;
    for (const source of sources.filter(t => !Object.isNull(t.recentHeading)))
      this.askRecent(source);
  }

  public search(typed: string): void {
    this.typed = typed;
    const query = SearchQuery.parse(typed);
    if (!query.equals(this.queryValue()))
      this.ask(query);
    this.markAnswered();
  }

  public refresh(name: string): void {
    const source = this.sources.find(t => t.name === name);
    if (Object.isUndefined(source) || this.recentController.signal.aborted)
      return;
    if (!Object.isNull(source.recentHeading))
      this.askRecent(source);
    if (!Object.isNull(this.searching) && this.searched().includes(source))
      this.askAnswer(source, this.queryValue(), this.searching);
  }

  public choose(source: string | null): void {
    this.filterValue.set(source);
  }

  public moveFilter(step: number): void {
    const names = this.filters().map(t => t.source);
    const index = names.indexOf(this.activeFilter());
    this.filterValue.set(names[(index + step + names.length) % names.length] ?? null);
  }

  public close(): void {
    this.recentController.abort();
    this.searching?.abort();
    this.searching = null;
    this.waitingValue.set(new Set());
  }

  private ask(query: SearchQuery): void {
    this.searching?.abort();
    this.searching = null;
    this.queryValue.set(query);
    this.answersValue.set(new Map());
    this.waitingValue.set(new Set());
    if ((query.isEmpty && !query.isCommandsOnly) || this.recentController.signal.aborted)
      return;
    const controller = new AbortController();
    this.searching = controller;
    for (const source of this.searched())
      this.askAnswer(source, query, controller);
  }

  private askRecent(source: SearchSourceContribution): void {
    const signal = this.recentController.signal;
    void this.askAsync(source, Resources.recentAsk, signal, () => source.recentAsync(signal),
      results => this.recentValue.update(t => new Map([...t, [source.name, results]])), () => undefined);
  }

  private askAnswer(source: SearchSourceContribution, query: SearchQuery, controller: AbortController): void {
    this.waitingValue.update(t => new Set([...t, source.name]));
    void this.askAsync(source, Resources.answerAsk, controller.signal, () => source.searchAsync(query.text, controller.signal),
      answer => this.answersValue.update(t => new Map([...t, [source.name, answer]])),
      () => {
        this.waitingValue.update(t => new Set([...t].filter(u => u !== source.name)));
        this.markAnswered();
      });
  }

  private markAnswered(): void {
    if (this.waitingValue().size === 0)
      this.answeredValue.set(this.typed);
  }

  private async askAsync<T>(source: SearchSourceContribution, kind: string, signal: AbortSignal, call: () => Promise<T>, take: (value: T) => void, settled: () => void): Promise<void> {
    const key = `${kind} ${source.name}`;
    const ask = (this.asks.get(key) ?? 0) + 1;
    this.asks.set(key, ask);
    const isLatest = (): boolean => !signal.aborted && this.asks.get(key) === ask;
    try {
      const value = await call();
      if (isLatest())
        take(value);
    }
    catch (error) {
      if (isLatest())
        this.fail(source, error);
    }
    if (isLatest())
      settled();
  }

  private static bestOf(query: string, rows: readonly SearchRow[]): SearchRow | null {
    let best: SearchRow | null = null;
    let bestRank = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const rank = SearchRank.of(query, row.result.title);
      if (!Object.isNull(rank) && rank < bestRank) {
        best = row;
        bestRank = rank;
      }
    }
    return best;
  }
}
