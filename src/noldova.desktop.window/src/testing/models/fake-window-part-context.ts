/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, Type } from "@angular/core";

import type { JsonValue } from "@noldova/context.json";
import type { AgentControlState, SettingScope } from "@noldova/desktop.protocol";
import { Fake } from "@noldova/desktop.protocol/testing";

import type { IWindowPalette } from "../../app/interfaces/i-window-palette.js";
import type { IWindowPartContext } from "../../app/interfaces/i-window-part-context.js";
import type { TimeFormatService } from "../../app/services/time-format.service.js";
import { FakeTimeFormats } from "./fake-time-formats.js";
import { FakeWindowSecrets } from "./fake-window-secrets.js";
import { FakeWindowWebViews } from "./fake-window-web-views.js";

export class FakeWindowPartContext extends Fake<IWindowPartContext> implements IWindowPartContext {
  private readonly documentClosed: Set<{ readonly name: string; readonly listener: (instance: string) => void }> = new Set<{ readonly name: string; readonly listener: (instance: string) => void }>();
  private readonly tabRenamed: Set<{ readonly name: string; readonly listener: (instance: string, title: string) => void }> = new Set<{ readonly name: string; readonly listener: (instance: string, title: string) => void }>();
  private readonly viewClosed: Set<{ readonly name: string; readonly listener: (instance: string) => void }> = new Set<{ readonly name: string; readonly listener: (instance: string) => void }>();
  private readonly placeShown: Set<{ readonly name: string; readonly listener: (place: string, instance: string | null) => void }> = new Set<{ readonly name: string; readonly listener: (place: string, instance: string | null) => void }>();
  private readonly events: Set<{ readonly name: string; readonly listener: (payload: JsonValue) => void }> = new Set<{ readonly name: string; readonly listener: (payload: JsonValue) => void }>();
  private readonly settingChanged: Set<{ readonly name: string; readonly listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void }> = new Set<{ readonly name: string; readonly listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void }>();
  private readonly dependencyChanged: Set<(moduleId: string, isActive: boolean) => void> = new Set<(moduleId: string, isActive: boolean) => void>();

  public readonly webViews: FakeWindowWebViews = new FakeWindowWebViews();
  public readonly secrets: FakeWindowSecrets = new FakeWindowSecrets();
  public readonly formats: FakeTimeFormats = new FakeTimeFormats();
  public readonly timeFormats: TimeFormatService = this.formats.service;
  public readonly registerView: IWindowPartContext["registerView"] = (...args) => this.tell("registerView", args, this.answers.registerView);
  public readonly registerDocument: IWindowPartContext["registerDocument"] = (...args) => this.tell("registerDocument", args, this.answers.registerDocument);
  public readonly registerPlaceholder: IWindowPartContext["registerPlaceholder"] = (...args) => this.tell("registerPlaceholder", args, this.answers.registerPlaceholder);
  public readonly registerSettingsPage: IWindowPartContext["registerSettingsPage"] = (...args) => this.tell("registerSettingsPage", args, this.answers.registerSettingsPage);
  public readonly setSettingsRows: IWindowPartContext["setSettingsRows"] = (...args) => this.tell("setSettingsRows", args, this.answers.setSettingsRows);
  public readonly registerCommand: IWindowPartContext["registerCommand"] = (...args) => this.tell("registerCommand", args, this.answers.registerCommand);
  public readonly registerSearchSource: IWindowPartContext["registerSearchSource"] = (...args) => this.tell("registerSearchSource", args, this.answers.registerSearchSource);
  public readonly registerStatusBarItem: IWindowPartContext["registerStatusBarItem"] = (...args) => this.ask("registerStatusBarItem", args, this.answers.registerStatusBarItem);
  public readonly registerTopBarAction: IWindowPartContext["registerTopBarAction"] = (...args) => this.ask("registerTopBarAction", args, this.answers.registerTopBarAction);
  public readonly registerSave: IWindowPartContext["registerSave"] = (...args) => this.track("registerSave", args);
  public readonly registerSelectionSource: IWindowPartContext["registerSelectionSource"] = (...args) => this.track("registerSelectionSource", args);
  public readonly provideUndo: IWindowPartContext["provideUndo"] = (...args) => this.track("provideUndo", args);
  public readonly provideMenuGroup: IWindowPartContext["provideMenuGroup"] = (...args) => this.track("provideMenuGroup", args);
  public readonly provideSettingOptions: IWindowPartContext["provideSettingOptions"] = (...args) => this.track("provideSettingOptions", args);
  public readonly refreshSettingOptions: IWindowPartContext["refreshSettingOptions"] = (...args) => this.tell("refreshSettingOptions", args, this.answers.refreshSettingOptions);
  public readonly provideSettingCheck: IWindowPartContext["provideSettingCheck"] = (...args) => this.track("provideSettingCheck", args);
  public readonly setViewBadge: IWindowPartContext["setViewBadge"] = (...args) => this.tell("setViewBadge", args, this.answers.setViewBadge);
  public readonly markWorking: IWindowPartContext["markWorking"] = (...args) => this.track("markWorking", args);
  public readonly markWaiting: IWindowPartContext["markWaiting"] = (...args) => this.track("markWaiting", args);
  public readonly isAllowed: IWindowPartContext["isAllowed"] = (...args) => this.ask("isAllowed", args, this.answers.isAllowed);
  public readonly runCommandAsync: IWindowPartContext["runCommandAsync"] = (...args) => this.respondAsync("runCommandAsync", args, this.answers.runCommandAsync);
  public readonly findWindowCommand: IWindowPartContext["findWindowCommand"] = (...args) => this.ask("findWindowCommand", args, this.answers.findWindowCommand);
  public readonly keyOf: IWindowPartContext["keyOf"] = (...args) => this.ask("keyOf", args, this.answers.keyOf);
  public readonly postNotificationAsync: IWindowPartContext["postNotificationAsync"] = (...args) => this.respondAsync("postNotificationAsync", args, this.answers.postNotificationAsync);
  public readonly openDocument: IWindowPartContext["openDocument"] = (...args) => this.tell("openDocument", args, this.answers.openDocument);
  public readonly keepDocument: IWindowPartContext["keepDocument"] = (...args) => this.tell("keepDocument", args, this.answers.keepDocument);
  public readonly closeDocument: IWindowPartContext["closeDocument"] = (...args) => this.tell("closeDocument", args, this.answers.closeDocument);
  public readonly forgetDocument: IWindowPartContext["forgetDocument"] = (...args) => this.tell("forgetDocument", args, this.answers.forgetDocument);
  public readonly updateDocument: IWindowPartContext["updateDocument"] = (...args) => this.tell("updateDocument", args, this.answers.updateDocument);
  public readonly onDocumentClosed: IWindowPartContext["onDocumentClosed"] = (name, listener) => this.listen("onDocumentClosed", [name, listener], this.documentClosed, { name, listener });
  public readonly onTabRenamed: IWindowPartContext["onTabRenamed"] = (name, listener) => this.listen("onTabRenamed", [name, listener], this.tabRenamed, { name, listener });
  public readonly listOpenDocumentsAsync: IWindowPartContext["listOpenDocumentsAsync"] = (...args) => this.respondAsync("listOpenDocumentsAsync", args, this.answers.listOpenDocumentsAsync);
  public readonly openView: IWindowPartContext["openView"] = (...args) => this.tell("openView", args, this.answers.openView);
  public readonly updateView: IWindowPartContext["updateView"] = (...args) => this.tell("updateView", args, this.answers.updateView);
  public readonly closeView: IWindowPartContext["closeView"] = (...args) => this.tell("closeView", args, this.answers.closeView);
  public readonly returnView: IWindowPartContext["returnView"] = (...args) => this.tell("returnView", args, this.answers.returnView);
  public readonly closeDialog: IWindowPartContext["closeDialog"] = (...args) => this.tell("closeDialog", args, this.answers.closeDialog);
  public readonly showView: IWindowPartContext["showView"] = (...args) => this.tell("showView", args, this.answers.showView);
  public readonly hideViewDock: IWindowPartContext["hideViewDock"] = (...args) => this.tell("hideViewDock", args, this.answers.hideViewDock);
  public readonly growViewDock: IWindowPartContext["growViewDock"] = (...args) => this.track("growViewDock", args);
  public readonly viewDockOf: IWindowPartContext["viewDockOf"] = (...args) => this.ask("viewDockOf", args, this.answers.viewDockOf);
  public readonly onViewClosed: IWindowPartContext["onViewClosed"] = (name, listener) => this.listen("onViewClosed", [name, listener], this.viewClosed, { name, listener });
  public readonly recordPlace: IWindowPartContext["recordPlace"] = (...args) => this.tell("recordPlace", args, this.answers.recordPlace);
  public readonly forgetPlace: IWindowPartContext["forgetPlace"] = (...args) => this.tell("forgetPlace", args, this.answers.forgetPlace);
  public readonly onPlaceShown: IWindowPartContext["onPlaceShown"] = (name, listener) => this.listen("onPlaceShown", [name, listener], this.placeShown, { name, listener });
  public readonly showInDialogAsync: IWindowPartContext["showInDialogAsync"] = (...args) => this.respondAsync("showInDialogAsync", args, this.answers.showInDialogAsync);
  public readonly log: IWindowPartContext["log"] = (...args) => this.tell("log", args, this.answers.log);
  public readonly openLinkAsync: IWindowPartContext["openLinkAsync"] = (...args) => this.respondAsync("openLinkAsync", args, this.answers.openLinkAsync);
  public readonly showLinkMenu: IWindowPartContext["showLinkMenu"] = (...args) => this.tell("showLinkMenu", args, this.answers.showLinkMenu);
  public readonly registerInAppBrowser: IWindowPartContext["registerInAppBrowser"] = (...args) => this.track("registerInAppBrowser", args);
  public readonly showInFolderAsync: IWindowPartContext["showInFolderAsync"] = (...args) => this.respondAsync("showInFolderAsync", args, this.answers.showInFolderAsync);
  public readonly openFileAsync: IWindowPartContext["openFileAsync"] = (...args) => this.respondAsync("openFileAsync", args, this.answers.openFileAsync);
  public readonly chooseFolderAsync: IWindowPartContext["chooseFolderAsync"] = (...args) => this.respondAsync("chooseFolderAsync", args, this.answers.chooseFolderAsync);
  public readonly chooseFilePathAsync: IWindowPartContext["chooseFilePathAsync"] = (...args) => this.respondAsync("chooseFilePathAsync", args, this.answers.chooseFilePathAsync);
  public readonly saveFileAsync: IWindowPartContext["saveFileAsync"] = (...args) => this.respondAsync("saveFileAsync", args, this.answers.saveFileAsync);
  public readonly chooseFilesAsync: IWindowPartContext["chooseFilesAsync"] = (...args) => this.respondAsync("chooseFilesAsync", args, this.answers.chooseFilesAsync);
  public readonly grantFilesAsync: IWindowPartContext["grantFilesAsync"] = (...args) => this.respondAsync("grantFilesAsync", args, this.answers.grantFilesAsync);
  public readonly discardFileGrants: IWindowPartContext["discardFileGrants"] = (...args) => this.tell("discardFileGrants", args, this.answers.discardFileGrants);
  public readonly fileAddressOf: IWindowPartContext["fileAddressOf"] = (...args) => this.ask("fileAddressOf", args, this.answers.fileAddressOf);
  public readonly requestAsync: IWindowPartContext["requestAsync"] = (...args) => this.respondAsync("requestAsync", args, this.answers.requestAsync);
  public readonly onEvent: IWindowPartContext["onEvent"] = (name, listener) => this.listen("onEvent", [name, listener], this.events, { name, listener });
  public readonly readSetting: IWindowPartContext["readSetting"] = (...args) => this.ask("readSetting", args, this.answers.readSetting);
  public readonly readSettingAsync: IWindowPartContext["readSettingAsync"] = (...args) => this.respondAsync("readSettingAsync", args, this.answers.readSettingAsync);
  public readonly writeSettingAsync: IWindowPartContext["writeSettingAsync"] = (...args) => this.respondAsync("writeSettingAsync", args, this.answers.writeSettingAsync);
  public readonly resetSettingAsync: IWindowPartContext["resetSettingAsync"] = (...args) => this.respondAsync("resetSettingAsync", args, this.answers.resetSettingAsync);
  public readonly onSettingChanged: IWindowPartContext["onSettingChanged"] = (name, listener) => this.listen("onSettingChanged", [name, listener], this.settingChanged, { name, listener });
  public readonly isDependencyActive: IWindowPartContext["isDependencyActive"] = (...args) => this.ask("isDependencyActive", args, this.answers.isDependencyActive);
  public readonly onDependencyChanged: IWindowPartContext["onDependencyChanged"] = listener => this.listen("onDependencyChanged", [listener], this.dependencyChanged, listener);

  public get agentControl(): Signal<AgentControlState | null> {
    return this.propertyOf("agentControl", this.answers.agentControl);
  }

  public openBelowWindowRowAsync<T>(load: () => Promise<Type<T>>): Promise<IWindowPalette<T> | null> {
    return this.answerOfAsync("openBelowWindowRowAsync", [load], this.answers.openBelowWindowRowAsync, t => t<T>(load));
  }

  public raiseDocumentClosed(name: string, instance: string): void {
    this.raiseIsolated(this.documentClosed, t => t.name === name && t.listener(instance));
  }

  public raiseTabRenamed(name: string, instance: string, title: string): void {
    this.raiseIsolated(this.tabRenamed, t => t.name === name && t.listener(instance, title));
  }

  public raiseViewClosed(name: string, instance: string): void {
    this.raiseIsolated(this.viewClosed, t => t.name === name && t.listener(instance));
  }

  public raisePlaceShown(view: string, place: string, instance: string | null = null): void {
    this.raiseIsolated(this.placeShown, t => t.name === view && t.listener(place, instance));
  }

  public raiseEvent(name: string, payload: JsonValue): void {
    this.raise(this.events, t => t.name === name && t.listener(payload));
  }

  public raiseSettingChanged(name: string, value: JsonValue, scope: SettingScope | null, isSet: boolean): void {
    this.raise(this.settingChanged, t => t.name === name && t.listener(value, scope, isSet));
  }

  public raiseDependencyChanged(moduleId: string, isActive: boolean): void {
    this.raiseLive(this.dependencyChanged, t => t(moduleId, isActive));
  }

  protected override parts(): readonly Pick<Fake<object>, "beStrict">[] {
    return [this.webViews, this.secrets];
  }
}
