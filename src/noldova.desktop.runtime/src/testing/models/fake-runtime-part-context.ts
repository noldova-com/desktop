/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IRuntimePartContext } from "../../interfaces/i-runtime-part-context.js";
import type { ClientClosure } from "../../models/client-closure.js";
import { Resources } from "../../resources.js";
import { FakeAppShortcuts } from "./fake-app-shortcuts.js";
import { FakeAppWindows } from "./fake-app-windows.js";
import { FakeModuleDatabase } from "./fake-module-database.js";
import { FakeModuleLog } from "./fake-module-log.js";
import { FakeModuleSecrets } from "./fake-module-secrets.js";
import { FakeModuleSettings } from "./fake-module-settings.js";
import { FakePermissionsContext } from "./fake-permissions-context.js";
import { FakeRuntimeFiles } from "./fake-runtime-files.js";
import { FakeRuntimeWebViews } from "./fake-runtime-web-views.js";
import { FakeToolsContext } from "./fake-tools-context.js";

export class FakeRuntimePartContext extends Fake<IRuntimePartContext> implements IRuntimePartContext {
  private readonly clientClosed: Set<(closure: ClientClosure) => void | Promise<void>> = new Set<(closure: ClientClosure) => void | Promise<void>>();
  private readonly dependencyChanged: Set<(moduleId: string, isActive: boolean) => void> = new Set<(moduleId: string, isActive: boolean) => void>();

  public readonly database: FakeModuleDatabase = new FakeModuleDatabase();
  public readonly settings: FakeModuleSettings = new FakeModuleSettings();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly tools: FakeToolsContext = new FakeToolsContext(this.log);
  public readonly permissions: FakePermissionsContext = new FakePermissionsContext(this.log);
  public readonly webViews: FakeRuntimeWebViews = new FakeRuntimeWebViews();
  public readonly files: FakeRuntimeFiles = new FakeRuntimeFiles();
  public readonly secrets: FakeModuleSecrets = new FakeModuleSecrets();
  public readonly appWindows: FakeAppWindows = new FakeAppWindows();
  public readonly shortcuts: FakeAppShortcuts = new FakeAppShortcuts();
  public readonly getWorkFolderAsync: IRuntimePartContext["getWorkFolderAsync"] = (...args) => this.respondAsync("getWorkFolderAsync", args, this.answers.getWorkFolderAsync);
  public readonly beginWork: IRuntimePartContext["beginWork"] = (...args) => this.ask("beginWork", args, this.answers.beginWork);
  public readonly readEnvironmentAsync: IRuntimePartContext["readEnvironmentAsync"] = (...args) => this.respondAsync("readEnvironmentAsync", args, this.answers.readEnvironmentAsync);
  public readonly startProcessAsync: IRuntimePartContext["startProcessAsync"] = (...args) => this.respondAsync("startProcessAsync", args, this.answers.startProcessAsync);
  public readonly startPseudoTerminalAsync: IRuntimePartContext["startPseudoTerminalAsync"] = (...args) => this.respondAsync("startPseudoTerminalAsync", args, this.answers.startPseudoTerminalAsync);
  public readonly registerMethod: IRuntimePartContext["registerMethod"] = (...args) => this.tell("registerMethod", args, this.answers.registerMethod);
  public readonly declareEvent: IRuntimePartContext["declareEvent"] = (...args) => this.ask("declareEvent", args, this.answers.declareEvent);
  public readonly registerCommand: IRuntimePartContext["registerCommand"] = (...args) => this.tell("registerCommand", args, this.answers.registerCommand);
  public readonly onClientClosed: IRuntimePartContext["onClientClosed"] = listener => {
    this.listen("onClientClosed", [listener], this.clientClosed, listener);
  };
  public readonly postNotification: IRuntimePartContext["postNotification"] = (...args) => this.ask("postNotification", args, this.answers.postNotification);
  public readonly publishService: IRuntimePartContext["publishService"] = (...args) => this.tell("publishService", args, this.answers.publishService);
  public readonly onDependencyChanged: IRuntimePartContext["onDependencyChanged"] = listener => this.listen("onDependencyChanged", [listener], this.dependencyChanged, listener);

  public get moduleId(): string {
    return this.propertyOf("moduleId", this.answers.moduleId);
  }

  public get moduleFolder(): string {
    return this.propertyOf("moduleFolder", this.answers.moduleFolder);
  }

  public getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T {
    return this.answerOf("getService", [name, type], this.answers.getService)<T>(name, type);
  }

  public findService<T extends object>(name: string, guard: (service: object) => service is T): T | null {
    return this.answerOf("findService", [name, guard], this.answers.findService)<T>(name, guard);
  }

  public raiseClientClosedAsync(closure: ClientClosure): Promise<void> {
    return this.raiseLiveAsync(this.clientClosed, t => t(closure));
  }

  public raiseDependencyChanged(moduleId: string, isActive: boolean): void {
    this.raiseLive(this.dependencyChanged, t => t(moduleId, isActive), t => this.log.write(Resources.formatDependencyListenerFailed(moduleId, inspect(t))));
  }

  protected override parts(): readonly Pick<Fake<object>, "beStrict">[] {
    return [this.database, this.settings, this.log, this.tools, this.permissions, this.webViews, this.files, this.secrets, this.appWindows, this.shortcuts];
  }
}
