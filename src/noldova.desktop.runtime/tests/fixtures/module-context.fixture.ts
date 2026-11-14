/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";

import "@noldova/context.core";
import { QualifiedName, SettingDefinition, SettingLocality, SettingType, WebViewDeclaration } from "@noldova/desktop.protocol";
import {
  type AppSurface, ClientClosures, CommandRegistry, DataDirectory, type DependencyStates, DiagnosticRedactor, type EventRegistry, type MethodRegistry, ModuleContext, ModuleDeclaration, NotificationCenter, NotificationPolicy, type ServiceRegistry,
  ToolRegistry, type WebViewCenter, WorkTracker
} from "@noldova/desktop.runtime";

import type { SettingsFixture } from "./settings.fixture.js";
import { TextOutputFixture } from "./text-output.fixture.js";

export class ModuleContextFixture {
  public static readonly ROOT: string = path.resolve("noldova-desktop-data");
  public static readonly HOME: string = path.resolve("home", "person");
  public static readonly NOTES: ModuleDeclaration = new ModuleDeclaration(
    "notes",
    "0.0.1",
    "Notes",
    "Keeps notes.",
    new Map([["tasks", "0.0.1"]]),
    "@noldova/desktop.notes.runtime",
    new Map([
      ["methods", ["notes.list"]], ["events", ["notes.changed"]], ["commands", ["notes.newNote"]], ["notifications", ["notes.saved"]], ["settings", ["notes.sortBy"]],
      ["settingScopes", ["notes.folder"]], ["tools", ["notes_search", "notes_append"]]
    ]), [], null, [], new WebViewDeclaration());
  public static readonly SETTINGS: readonly SettingDefinition[] = ["notes.sortBy", "tasks.size", "clock.speed", "desktop.mode"].map(t => new SettingDefinition(
    QualifiedName.parse(t), t, "A setting.", SettingType.text(20), "a", SettingLocality.Shared, t === "notes.sortBy" ? [QualifiedName.parse("notes.folder")] : [], "Page", "Group"));

  public static create(
    settings: SettingsFixture,
    methods: MethodRegistry,
    events: EventRegistry,
    services: ServiceRegistry,
    commands: CommandRegistry = new CommandRegistry(),
    notifications: NotificationCenter = new NotificationCenter(() => undefined, () => new Date(), randomUUID),
    work: WorkTracker = new WorkTracker(() => undefined),
    diagnostics: TextOutputFixture = new TextOutputFixture(),
    root: string = ModuleContextFixture.ROOT,
    tools: ToolRegistry = new ToolRegistry(),
    closures: ClientClosures = new ClientClosures(diagnostics),
    webViews?: WebViewCenter,
    declaration: ModuleDeclaration = ModuleContextFixture.NOTES,
    dependencyStates?: DependencyStates,
    appSurface?: AppSurface): ModuleContext {
    return new ModuleContext(
      declaration, new DataDirectory(root), methods, events, commands,
      notifications, new NotificationPolicy([declaration], () => true), services, tools,
      settings.service, work, settings.processes, diagnostics, new DiagnosticRedactor(ModuleContextFixture.HOME), undefined, closures, webViews, undefined, dependencyStates, undefined, appSurface);
  }
}
