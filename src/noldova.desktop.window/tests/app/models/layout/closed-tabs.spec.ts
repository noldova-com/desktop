/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ErrorHandler } from "@angular/core";

import { ClosedTabs } from "../../../../src/app/models/layout/closed-tabs";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";

describe("ClosedTabs", () => {
  const shell = (instance: string): ViewTab => new ViewTab("terminal.shell", instance);
  const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
  let errors: unknown[];
  let heard: string[];
  let closed: ClosedTabs;

  beforeEach(() => {
    errors = [];
    heard = [];
    const handler: Pick<ErrorHandler, "handleError"> = { handleError: (error: unknown) => errors.push(error) };
    closed = new ClosedTabs(ViewTab, handler);
    closed.onClosed("terminal.shell", t => heard.push(`terminal.shell ${t}`));
  });

  it("tells a name's listeners of each of its instance tabs gone since the last notice, never of one hushed, of another kind or without an instance, and returns every key gone", () => {
    closed.notice([shell("1"), shell("2"), shell("3"), new ViewTab("terminal.panel"), note("1")]);
    closed.hush(shell("2"));
    const gone = closed.notice([shell("3")]);
    closed.notice([]);

    expect(gone).toEqual([shell("1").key, shell("2").key]);
    expect(heard).toEqual(["terminal.shell 1", "terminal.shell 3"]);
  });

  it("forgets a hush at the next notice, so a later close of that tab is heard", () => {
    closed.notice([shell("1")]);
    closed.hush(shell("1"));
    closed.notice([shell("1")]);
    closed.notice([]);

    expect(heard).toEqual(["terminal.shell 1"]);
  });

  it("tells the next listeners when one throws, reports the error, and stops telling one that is removed", () => {
    const failure = new Error("Listener failed.");
    closed.onClosed("terminal.shell", () => {
      throw failure;
    });
    const stop = closed.onClosed("terminal.shell", () => heard.push("removed"));
    closed.onClosed("terminal.shell", t => heard.push(`after ${t}`));
    closed.onClosed("files.tree", t => heard.push(`files ${t}`));
    stop();
    closed.notice([shell("1")]);
    closed.notice([]);

    expect(heard).toEqual(["terminal.shell 1", "after 1"]);
    expect(errors).toEqual([failure]);
  });

  it("holds a close no listener hears until a reconcile names its tab's name, tells it once, and drops it when the tab opens again first", () => {
    const later: string[] = [];
    const browser = new ClosedTabs(DocumentTab, { handleError: (error: unknown) => errors.push(error) });
    const page = (instance: string): DocumentTab => new DocumentTab("browser.page", instance);
    browser.notice([page("1"), page("2"), page("3")]);
    browser.notice([]);
    const held = ["1", "2", "3"].map(t => browser.isUnheard(page(t)));
    browser.reopen(page("2"));
    browser.onClosed("browser.page", t => later.push(t));
    browser.reconcile(new Set(["notes.note"]));
    const unnamed = [...later];
    browser.reconcile(new Set(["browser.page"]));
    browser.reconcile(new Set(["browser.page"]));

    expect(held).toEqual([true, true, true]);
    expect(unnamed).toEqual([]);
    expect(later).toEqual(["1", "3"]);
    expect(["1", "2", "3"].map(t => browser.isUnheard(page(t)))).toEqual([false, false, false]);
  });
});
