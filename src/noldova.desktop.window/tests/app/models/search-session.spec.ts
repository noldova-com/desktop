/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchResult } from "../../../src/app/models/search-result";
import { SearchSession } from "../../../src/app/models/search-session";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";

interface IPending<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
}

const answered: Promise<unknown>[] = [];

function pending<T>(): IPending<T> {
  let done: (value: T) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    done = resolve;
    fail = reject;
  });
  const resolve = (value: T): void => {
    done(value);
    answered.push(promise);
  };
  const reject = (error: unknown): void => {
    fail(error);
    answered.push(promise);
  };
  return { promise, resolve, reject };
}

class FakeSource {
  public readonly recent: IPending<readonly SearchResult[]>[] = [];
  public readonly searches: { readonly query: string; readonly signal: AbortSignal; readonly answer: IPending<SearchAnswer> }[] = [];
  public readonly recentSignals: AbortSignal[] = [];
  public readonly contribution: SearchSourceContribution;

  public constructor(name: string, label: string, recentHeading: string | null) {
    this.contribution = new SearchSourceContribution(name, label, label.toLowerCase(), `In ${label}`, recentHeading, "search", t => {
      const answer = pending<readonly SearchResult[]>();
      this.recent.push(answer);
      this.recentSignals.push(t);
      return answer.promise;
    }, (query, signal) => {
      const answer = pending<SearchAnswer>();
      this.searches.push({ query, signal, answer });
      return answer.promise;
    });
  }

  public answer(index: number, titles: readonly string[], total?: number): void {
    this.searches[index]?.answer.resolve(new SearchAnswer(titles.map(t => result(t)), total));
  }
}

function result(title: string): SearchResult {
  return new SearchResult(title, title, String.empty, () => Promise.resolve());
}

function titles(session: SearchSession): readonly (readonly string[])[] {
  return session.groups().map(t => [t.heading, ...t.rows.map(u => u.result.title)]);
}

async function settle(): Promise<void> {
  await Promise.allSettled(answered.splice(0));
}

describe("SearchSession", () => {
  let chats: FakeSource;
  let messages: FakeSource;
  let commands: FakeSource;
  let failures: [string, unknown][];
  let session: SearchSession;

  beforeEach(() => {
    chats = new FakeSource("chat.chats", "Chats", "Recent chats");
    messages = new FakeSource("chat.messages", "Messages", null);
    commands = new FakeSource("desktop.commands", "Commands", "Recent commands");
    failures = [];
    session = new SearchSession([chats.contribution, messages.contribution, commands.contribution], "desktop.commands", (source, error) => failures.push([source.name, error]));
  });

  afterEach(() => {
    session.close();
  });

  it("shows each source's recent items before typing, in source order, leaving out a source with no recent heading or no recent items", async () => {
    expect([chats.recent.length, messages.recent.length, commands.recent.length]).toEqual([1, 0, 1]);
    commands.recent[0]?.resolve([result("New chat"), result("Open settings")]);
    await settle();
    expect(titles(session)).toEqual([["Recent commands", "New chat", "Open settings"]]);

    chats.recent[0]?.resolve([result("Fix toMiles")]);
    await settle();

    expect(titles(session)).toEqual([["Recent chats", "Fix toMiles"], ["Recent commands", "New chat", "Open settings"]]);
    expect(session.filters().map(t => [t.label, t.count, t.isActive])).toEqual([["All", null, true], ["Chats", null, false], ["Messages", null, false], ["Commands", null, false]]);
  });

  it("asks every source at once for the trimmed query, shows a Best match first and each source's matches as they come, two under All, with each source's total", async () => {
    session.search("  term ");
    expect([chats.searches[0]?.query, messages.searches[0]?.query, commands.searches[0]?.query]).toEqual(["term", "term", "term"]);

    messages.answer(0, ["…the terminal opens…", "…in a terminal first…", "…a third terminal…"], 14);
    await settle();
    expect(titles(session)).toEqual([["Best match", "…the terminal opens…"], ["In Messages", "…in a terminal first…", "…a third terminal…"]]);

    commands.answer(0, ["Toggle terminal", "New terminal", "Terminal: Font size", "Split terminal"]);
    chats.answer(0, ["Open a terminal per teammate", "Terminal tab freezes"]);
    await settle();

    expect(titles(session)).toEqual([
      ["Best match", "…the terminal opens…"],
      ["In Chats", "Open a terminal per teammate", "Terminal tab freezes"],
      ["In Messages", "…in a terminal first…", "…a third terminal…"],
      ["In Commands", "Toggle terminal", "New terminal"]
    ]);
    expect(session.filters().map(t => [t.label, t.count])).toEqual([["All", null], ["Chats", 2], ["Messages", 14], ["Commands", 4]]);
  });

  it("keeps the Best match it showed, and so the first row Enter opens, when a later answer ranks better, listing that result in its own group, and picks again for the next query", async () => {
    session.search("plan");
    commands.answer(0, ["Open plans"]);
    await settle();
    const shown = session.groups()[0]?.rows[0]?.id;

    chats.answer(0, ["plan"]);
    messages.answer(0, ["Plans for the week"]);
    await settle();

    expect(titles(session)).toEqual([["Best match", "Open plans"], ["In Chats", "plan"], ["In Messages", "Plans for the week"]]);
    expect(session.groups()[0]?.rows[0]?.id).toBe(shown);
    session.search("plans");
    messages.answer(1, ["Plans for the week"]);
    commands.answer(1, ["Open plans"]);
    await settle();
    expect(titles(session)[0]).toEqual(["Best match", "Plans for the week"]);
  });

  it("gives a tie for the Best match to the source that answers first and never picks a result whose title lacks the query", async () => {
    session.search("term");
    chats.answer(0, ["Pick a license"]);
    messages.answer(0, ["New terminal"]);
    commands.answer(0, ["Split terminal"]);
    await settle();

    expect(titles(session)[0]).toEqual(["Best match", "New terminal"]);

    session.search("zzz");
    chats.answer(1, ["Pick a license"]);
    await settle();
    expect(titles(session)).toEqual([["In Chats", "Pick a license"]]);
  });

  it("under a source's filter shows every match it lists and no Best match, and Tab steps through the filters both ways, wrapping", async () => {
    session.search("term");
    commands.answer(0, ["New terminal", "Toggle terminal", "Split terminal"]);
    chats.answer(0, ["Terminal tab freezes"]);
    await settle();

    session.moveFilter(1);
    expect([session.filters().find(t => t.isActive)?.label, titles(session)]).toEqual(["Chats", [["In Chats", "Terminal tab freezes"]]]);
    session.moveFilter(2);
    expect(titles(session)).toEqual([["In Commands", "New terminal", "Toggle terminal", "Split terminal"]]);
    session.moveFilter(1);
    expect(session.filters().find(t => t.isActive)?.label).toBe("All");
    session.moveFilter(-1);
    expect(session.filters().find(t => t.isActive)?.label).toBe("Commands");
    session.choose("chat.messages");
    expect(titles(session)).toEqual([]);
    session.choose(null);
    expect(titles(session)[0]).toEqual(["Best match", "New terminal"]);
  });

  it("with > first asks the commands alone, lists only their filter and all their matches with no Best match, and forgets a filter it no longer lists", async () => {
    session.choose("chat.chats");
    session.search("> new ");
    commands.answer(0, ["New terminal", "New chat"]);
    await settle();

    expect([chats.searches.length, messages.searches.length, commands.searches[0]?.query]).toEqual([0, 0, "new"]);
    expect(session.filters().map(t => [t.label, t.isActive])).toEqual([["All", true], ["Commands", false]]);
    expect(titles(session)).toEqual([["In Commands", "New terminal", "New chat"]]);
    expect(session.query().isCommandsOnly).toBe(true);
  });

  it("with > alone lists the recent commands, then every other command the commands give for an empty query", async () => {
    commands.recent[0]?.resolve([result("New chat")]);
    session.search(" > ");
    commands.answer(0, ["New chat", "New terminal", "Split terminal"]);
    await settle();

    expect([commands.searches[0]?.query, chats.searches.length]).toEqual([String.empty, 0]);
    expect(titles(session)).toEqual([["Recent commands", "New chat"], ["In Commands", "New terminal", "Split terminal"]]);
    expect(session.filters().map(t => [t.label, t.count])).toEqual([["All", null], ["Commands", null]]);
  });

  it("aborts the last query's calls when the query changes, drops their late answers and their failures, and asks nothing again for the same query", async () => {
    session.search("ter");
    const first = commands.searches[0];
    session.search("term");
    session.search(" term");
    first?.answer.resolve(new SearchAnswer([result("Terminal")]));
    chats.searches[0]?.answer.reject(new Error("late"));
    await settle();

    expect([first?.signal.aborted, commands.searches.length, titles(session), failures]).toEqual([true, 2, [], []]);
  });

  it("logs a source's failed answer, keeps the others' groups, and shows no count for the failed source", async () => {
    session.search("term");
    const failure = new Error("The index is locked.");
    chats.searches[0]?.answer.reject(failure);
    commands.answer(0, ["New terminal", "Toggle terminal"]);
    await settle();

    expect(failures).toEqual([["chat.chats", failure]]);
    expect(titles(session)).toEqual([["Best match", "New terminal"], ["In Commands", "Toggle terminal"]]);
    expect(session.filters().map(t => t.count)).toEqual([null, null, null, 2]);
  });

  it("is searching from a query until every source it asks has answered or failed, afresh for each query, and not once the query is cleared or the session closes", async () => {
    const states: boolean[] = [session.isSearching()];
    session.search("ter");
    states.push(session.isSearching());
    session.search("term");
    chats.answer(1, ["Terminal tab freezes"]);
    messages.searches[1]?.answer.reject(new Error("The index is locked."));
    await settle();
    states.push(session.isSearching());
    commands.answer(1, ["New terminal"]);
    await settle();
    states.push(session.isSearching());
    session.search("> ");
    states.push(session.isSearching());
    session.search(String.empty);
    states.push(session.isSearching());
    session.search("plan");
    session.close();
    states.push(session.isSearching());

    expect(states).toEqual([false, true, true, false, true, false, false]);
  });

  it("logs a source whose call throws at once and a failed recent call", async () => {
    const error = new Error("No index.");
    const throwing = new SearchSourceContribution("chat.drafts", "Drafts", "drafts", "Drafts", "Recent drafts", "edit", () => Promise.reject(error), () => {
      throw error;
    });
    const own = new SearchSession([throwing], "desktop.commands", (source, failure) => failures.push([source.name, failure]));
    own.search("x");
    await settle();
    own.close();

    expect(failures).toEqual([["chat.drafts", error], ["chat.drafts", error]]);
  });

  it("on closing aborts the recent and search calls, drops what comes after and asks nothing for a later query", async () => {
    session.search("term");
    session.close();
    chats.recent[0]?.resolve([result("Fix toMiles")]);
    commands.answer(0, ["New terminal"]);
    session.search("terms");
    await settle();

    expect([chats.recentSignals[0]?.aborted, commands.searches[0]?.signal.aborted, commands.searches.length, titles(session)]).toEqual([true, true, 1, []]);
  });

  it("empties the groups when the query is cleared and shows the recent items again", async () => {
    commands.recent[0]?.resolve([result("New chat")]);
    session.search("term");
    commands.answer(0, ["New terminal"]);
    await settle();
    session.search(String.empty);

    expect([commands.searches[0]?.signal.aborted, titles(session)]).toEqual([true, [["Recent commands", "New chat"]]]);
  });
});
