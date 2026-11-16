/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Type } from "@angular/core";

import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import {
  CommandContribution, DockSide, DocumentContribution, type IWindowPartContext, LinkPlace, PlaceholderContribution, SearchAnswer, SearchSourceContribution,
  SettingsPageContribution, StatusBarItemContribution, StatusBarItemState, StatusBarSide, TopBarActionContribution, TopBarActionState, ViewContribution
} from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";

import { FakeMembersFixture } from "../../fixtures/fake-members.fixture";
import type { FakeMember } from "../../types/fake-member";

const LOAD_COMPONENT = (): Promise<Type<unknown>> => Promise.reject(new Error("Not loaded."));

const MEMBERS: Readonly<Record<keyof IWindowPartContext, FakeMember<IWindowPartContext>>> = {
  webViews: ["fake", t => t.webViews],
  secrets: ["fake", t => t.secrets],
  registerView: ["told", t => t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, LOAD_COMPONENT))],
  registerDocument: ["told", t => t.registerDocument(new DocumentContribution("notes.note", LOAD_COMPONENT))],
  registerPlaceholder: ["told", t => t.registerPlaceholder(new PlaceholderContribution("notes.start", LOAD_COMPONENT))],
  registerSettingsPage: ["told", t => t.registerSettingsPage(new SettingsPageContribution("notes.sync", LOAD_COMPONENT))],
  setSettingsRows: ["told", t => t.setSettingsRows("notes.sync", [])],
  registerCommand: ["told", t => t.registerCommand(new CommandContribution("notes.newNote", "New note", null, null, () => Promise.resolve(null)))],
  registerSearchSource: ["told", t => t.registerSearchSource(new SearchSourceContribution("notes.search", "Notes", "notes", "Notes", null, "description",
    () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([]))))],
  registerStatusBarItem: ["answered", t => t.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")))],
  registerTopBarAction: ["answered", t => t.registerTopBarAction(new TopBarActionContribution("notes.print", new TopBarActionState("print", "Print", "notes.print")))],
  registerSave: ["tracked", t => t.registerSave(() => Promise.resolve())],
  registerSelectionSource: ["tracked", t => t.registerSelectionSource(document.createElement("div"), { hasSelection: () => false, readSelection: () => String.empty })],
  provideMenuGroup: ["tracked", t => t.provideMenuGroup("notes.context", () => [])],
  provideSettingOptions: ["tracked", t => t.provideSettingOptions("notes.sort", () => null)],
  refreshSettingOptions: ["told", t => t.refreshSettingOptions("notes.sort")],
  provideSettingCheck: ["tracked", t => t.provideSettingCheck("notes.sort", () => null)],
  setViewBadge: ["told", t => t.setViewBadge("notes.list", null)],
  markWorking: ["tracked", t => t.markWorking("notes.sync")],
  markWaiting: ["tracked", t => t.markWaiting("notes.sync")],
  isAllowed: ["answered", t => t.isAllowed("notes.read")],
  runCommandAsync: ["answered", t => t.runCommandAsync("notes.newNote")],
  findWindowCommand: ["answered", t => t.findWindowCommand(new KeyboardEvent("keydown", { key: "n" }))],
  keyOf: ["answered", t => t.keyOf("notes.newNote")],
  postNotificationAsync: ["answered", t => t.postNotificationAsync(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Info,
    null, [], null))],
  openDocument: ["told", t => t.openDocument("notes.note", "1", "Plan")],
  keepDocument: ["told", t => t.keepDocument("notes.note", "1")],
  closeDocument: ["told", t => t.closeDocument("notes.note", "1")],
  forgetDocument: ["told", t => t.forgetDocument("notes.note", "1")],
  updateDocument: ["told", t => t.updateDocument("notes.note", "1", { title: "Plan" })],
  onDocumentClosed: ["listened", t => t.onDocumentClosed("notes.note", () => undefined)],
  onTabRenamed: ["listened", t => t.onTabRenamed("notes.note", () => undefined)],
  listOpenDocumentsAsync: ["answered", t => t.listOpenDocumentsAsync("notes.note")],
  openView: ["told", t => t.openView("terminal.session", "1", "Shell")],
  updateView: ["told", t => t.updateView("terminal.session", "1", { title: "Shell" })],
  closeView: ["told", t => t.closeView("terminal.session", "1")],
  closeDialog: ["told", t => t.closeDialog("terminal.session", "1")],
  showView: ["told", t => t.showView("terminal.session")],
  hideViewDock: ["told", t => t.hideViewDock("terminal.session")],
  growViewDock: ["tracked", t => t.growViewDock("terminal.session", 10)],
  viewDockOf: ["answered", t => t.viewDockOf("terminal.session", "1")],
  onViewClosed: ["listened", t => t.onViewClosed("terminal.session", () => undefined)],
  recordPlace: ["told", t => t.recordPlace("terminal.session", "/home", "1")],
  forgetPlace: ["told", t => t.forgetPlace("terminal.session", "/home", "1")],
  onPlaceShown: ["listened", t => t.onPlaceShown("terminal.session", () => undefined)],
  showInDialogAsync: ["answered", t => t.showInDialogAsync("notes.list")],
  log: ["told", t => t.log("Saved.")],
  openLinkAsync: ["answered", t => t.openLinkAsync("https://example.com")],
  showLinkMenu: ["told", t => t.showLinkMenu("https://example.com", new MouseEvent("contextmenu"))],
  registerInAppBrowser: ["tracked", t => t.registerInAppBrowser({ placeFor: () => LinkPlace.InApp, openAsync: () => Promise.resolve() })],
  showInFolderAsync: ["answered", t => t.showInFolderAsync("/notes/plan.md")],
  openFileAsync: ["answered", t => t.openFileAsync("/notes/plan.md")],
  chooseFolderAsync: ["answered", t => t.chooseFolderAsync()],
  chooseFilePathAsync: ["answered", t => t.chooseFilePathAsync()],
  saveFileAsync: ["answered", t => t.saveFileAsync("plan.md", new Uint8Array([1, 2, 3]))],
  chooseFilesAsync: ["answered", t => t.chooseFilesAsync()],
  grantFilesAsync: ["answered", t => t.grantFilesAsync([])],
  discardFileGrants: ["told", t => t.discardFileGrants(["grant-1"])],
  fileAddressOf: ["answered", t => t.fileAddressOf("grant-1")],
  requestAsync: ["answered", t => t.requestAsync("git.status", null)],
  onEvent: ["listened", t => t.onEvent("git.changed", () => undefined)],
  readSetting: ["answered", t => t.readSetting("terminal.theme")],
  readSettingAsync: ["answered", t => t.readSettingAsync("terminal.theme")],
  writeSettingAsync: ["answered", t => t.writeSettingAsync("terminal.theme", "dark")],
  resetSettingAsync: ["answered", t => t.resetSettingAsync("terminal.theme")],
  onSettingChanged: ["listened", t => t.onSettingChanged("terminal.theme", () => undefined)],
  isDependencyActive: ["answered", t => t.isDependencyActive("git")],
  onDependencyChanged: ["listened", t => t.onDependencyChanged(() => undefined)],
  agentControl: ["property", t => t.agentControl],
  openBelowWindowRowAsync: ["answered", t => t.openBelowWindowRowAsync(LOAD_COMPONENT)]
};

const RAISERS: readonly (readonly [string, string, (context: FakeWindowPartContext, listener: () => void) => () => void, (context: FakeWindowPartContext) => void])[] = [
  ["raiseDocumentClosed", "removed|third|fourth", (context, listener) => context.onDocumentClosed("notes.note", listener), context => context.raiseDocumentClosed("notes.note", "1")],
  ["raiseTabRenamed", "removed|third|fourth", (context, listener) => context.onTabRenamed("notes.note", listener), context => context.raiseTabRenamed("notes.note", "1", "Plan")],
  ["raiseViewClosed", "removed|third|fourth", (context, listener) => context.onViewClosed("terminal.session", listener), context => context.raiseViewClosed("terminal.session", "1")],
  ["raisePlaceShown", "removed|third|fourth", (context, listener) => context.onPlaceShown("notes.list", listener), context => context.raisePlaceShown("notes.list", "note-1")],
  ["raiseEvent", "removed|third", (context, listener) => context.onEvent("git.changed", listener), context => context.raiseEvent("git.changed", null)],
  ["raiseSettingChanged", "removed|third", (context, listener) => context.onSettingChanged("terminal.theme", listener), context => context.raiseSettingChanged("terminal.theme", "dark", null, true)],
  ["raiseDependencyChanged", "third|fourth", (context, listener) => context.onDependencyChanged(listener), context => context.raiseDependencyChanged("git", false)]
];

describe("FakeWindowPartContext", () => {
  FakeMembersFixture.check<IWindowPartContext>(() => new FakeWindowPartContext(), MEMBERS);

  it("raises to each listener of the name it raises, in order, until the listener's disposer runs", () => {
    const context = new FakeWindowPartContext();
    const heard: string[] = [];
    const stops = [
      context.onDocumentClosed("notes.note", t => heard.push(`closed ${t}`)),
      context.onTabRenamed("notes.note", (t, title) => heard.push(`renamed ${t} ${title}`)),
      context.onViewClosed("terminal.session", t => heard.push(`view closed ${t}`)),
      context.onPlaceShown("terminal.session", (place, instance) => heard.push(`place ${place} ${instance ?? "none"}`)),
      context.onEvent("git.changed", t => heard.push(`event ${JSON.stringify(t)}`)),
      context.onSettingChanged("terminal.theme", (value, scope, isSet) => heard.push(`setting ${JSON.stringify([value, scope, isSet])}`)),
      context.onDependencyChanged((moduleId, isActive) => heard.push(`dependency ${moduleId} ${isActive}`))
    ];
    context.onDocumentClosed("notes.other", t => heard.push(`other closed ${t}`));
    const raiseAll = (round: string): void => {
      context.raiseDocumentClosed("notes.note", round);
      context.raiseTabRenamed("notes.note", round, "Plan");
      context.raiseViewClosed("terminal.session", round);
      context.raisePlaceShown("terminal.session", `/home/${round}`, round);
      context.raiseEvent("git.changed", { round });
      context.raiseSettingChanged("terminal.theme", "dark", null, true);
      context.raiseDependencyChanged("git", false);
    };

    raiseAll("1");
    for (const stop of stops)
      stop();
    raiseAll("2");

    expect(heard).toEqual(["closed 1", "renamed 1 Plan", "view closed 1", "place /home/1 1", "event {\"round\":\"1\"}", "setting [\"dark\",null,true]", "dependency git false"]);
  });

  for (const [raiser, expected, listen, raise] of RAISERS)
    it(`${raiser} calls the listeners as the window's dispatch does: ${expected}`, () => {
      const context = new FakeWindowPartContext();
      const heard: string[] = [];
      const failure = new Error("The listener failed.");
      let stopRemoved = (): void => undefined;
      listen(context, () => stopRemoved());
      stopRemoved = listen(context, () => heard.push("removed"));
      listen(context, () => heard.push("third"));
      listen(context, () => {
        throw failure;
      });
      listen(context, () => heard.push("fourth"));

      let thrown: unknown = null;
      try {
        raise(context);
      } catch (error) {
        thrown = error;
      }

      expect(heard.join("|")).toBe(expected);
      expect([thrown, context.errors]).toEqual(expected.endsWith("fourth") ? [null, [failure]] : [failure, []]);
    });

  it("raises to no listener of another name", () => {
    const context = new FakeWindowPartContext();
    const heard: string[] = [];
    context.onDocumentClosed("notes.other", t => heard.push(t));
    context.onTabRenamed("notes.other", t => heard.push(t));
    context.onViewClosed("terminal.other", t => heard.push(t));
    context.onPlaceShown("notes.other", t => heard.push(t));
    context.onEvent("git.other", () => heard.push("event"));
    context.onSettingChanged("terminal.other", () => heard.push("setting"));

    context.raiseDocumentClosed("notes.note", "1");
    context.raiseTabRenamed("notes.note", "1", "Plan");
    context.raiseViewClosed("terminal.session", "1");
    context.raisePlaceShown("notes.list", "note-1");
    context.raiseEvent("git.changed", null);
    context.raiseSettingChanged("terminal.theme", "dark", null, true);

    expect(heard).toEqual([]);
  });

  it("holds the fakes of its web views and secrets, which record their own calls", () => {
    const context = new FakeWindowPartContext();
    context.secrets.answer("isSetAsync", () => Promise.resolve(true));

    void context.secrets.isSetAsync("token");

    expect([context.secrets.callsOf("isSetAsync"), context.calls.length, context.webViews.calls.length]).toEqual([[["token"]], 0, 0]);
  });

  it("calls the answer to openBelowWindowRowAsync with the caller's type arguments", async () => {
    const context = new FakeWindowPartContext();
    const load = (): Promise<Type<unknown>> => Promise.reject(new Error("Not loaded."));
    context.answer("openBelowWindowRowAsync", () => Promise.resolve(null));

    await expect(context.openBelowWindowRowAsync(load)).resolves.toBeNull();
    expect(context.callsOf("openBelowWindowRowAsync")).toEqual([[load]]);
  });

  it("refuses, when strict, an unanswered registration or listener", () => {
    const context = new FakeWindowPartContext();
    context.beStrict();

    expect(() => context.refreshSettingOptions("notes.sort")).toThrowError(UnansweredCallException);
    expect(() => context.registerSave(() => Promise.resolve())).toThrowError(UnansweredCallException);
    expect(context.callsOf("registerSave")).toHaveLength(1);
    expect(context.activeCallsOf("registerSave")).toHaveLength(0);
  });
});
