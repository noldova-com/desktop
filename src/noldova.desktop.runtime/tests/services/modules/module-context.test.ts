/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppShortcut, AppShortcutList, AppWindow, AppWindowList, CommandRun, type Event, FailureCode, KeyChord, ModuleState, ModuleStatus, NotificationAction, NotificationPost, NotificationSeverity,
  QualifiedName, ShellEvents, WebViewAction, WebViewEvent, WebViewEventKind, WebViewEvents } from "@noldova/desktop.protocol";
import {
  AgentControlException,
  AppSurface,
  ClientClosure,
  ClientClosures,
  CommandRegistry,
  DependencyStates,
  EventRegistry,
  EventWithdrawnException,
  type IToolDescriptor,
  MethodFailureException,
  MethodRegistry,
  type ModuleContext,
  ModuleDeactivatedException,
  ModuleDeclaration,
  NotContributedException,
  NotificationCenter,
  NotificationCommandNotAllowedException,
  PermissionCenter,
  PermissionDecision,
  PermissionsModuleOnlyException,
  PseudoTerminalRequest,
  PseudoTerminalsUndeclaredException,
  RememberedPermissionStore,
  RuntimeCommand,
  SecretNotOwnedException,
  ServiceMissingException,
  ServiceNotAllowedException,
  ServiceNotOwnedException,
  ServicePublishedException,
  ServiceRegistry,
  ServiceTypeMismatchException,
  SettingNotReadableException,
  ToolFailureCode,
  ToolRegistry,
  ToolRisk,
  WebViewCenter,
  WorkTracker
} from "@noldova/desktop.runtime";

import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { ModuleContextFixture } from "../../fixtures/module-context.fixture.js";
import { PermissionAnswererFixture } from "../../fixtures/permission-answerer.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { PseudoTerminalLibraryFixture } from "../../fixtures/pseudo-terminal-library.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { ToolHandlerFixture } from "../../fixtures/tool-handler.fixture.js";

@TestClass
export class ModuleContextTests {
  private static readonly OPTIONAL: ModuleDeclaration = new ModuleDeclaration(
    "notes", "0.0.1", "Notes", "Keeps notes.", new Map([["tasks", "0.0.1"]]), null, new Map(), [], null, [], null, false, new Map([["clock", "0.0.1"], ["theme", "0.0.1"]]));

  @TestMethod
  public async namesTheModuleAndItsFolder(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());

    Assert.areEqual("notes", context.moduleId);
    Assert.areEqual(path.join(ModuleContextFixture.ROOT, "modules", "notes"), context.moduleFolder);
  }

  @TestMethod
  public async refusesItsSecretsWithoutTheShellsStoreAndAnotherModulesSecretBeforeAsking(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());

    for (const call of [() => context.secrets.saveAsync("notes.syncToken", "s3cret"), () => context.secrets.readAsync("notes.syncToken"),
      () => context.secrets.removeAsync("notes.syncToken"), () => context.secrets.isSetAsync("notes.syncToken")])
      Assert.areEqual(FailureCode.Unavailable, (await Assert.throwsAsync(call, MethodFailureException)).failure.code);
    for (const call of [() => context.secrets.saveAsync("tasks.token", "s3cret"), () => context.secrets.readAsync("tasks.token"),
      () => context.secrets.removeAsync("tasks.token"), () => context.secrets.isSetAsync("tasks.token")])
      Assert.areEqual("The module notes may only use its own secrets, not tasks.token.", (await Assert.throwsAsync(call, SecretNotOwnedException)).message);
  }

  @TestMethod
  public async createsTheModulesWorkFolderWhenFirstAskedForIt(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, folder.path);
    const expected = path.join(folder.path, "work", "notes");
    const before = existsSync(expected);

    const first = await context.getWorkFolderAsync();
    await writeFile(path.join(first, "draft.txt"), "kept");
    const second = await context.getWorkFolderAsync();

    Assert.isFalse(before);
    Assert.areEqual(expected, first);
    Assert.areEqual(expected, second);
    Assert.areEqual("kept", await readFile(path.join(second, "draft.txt"), "utf8"));
  }

  @TestMethod
  public async reportsTheModulesWorkAndAbortsAndEndsWhatIsStillOpenWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const work = new WorkTracker(() => undefined);
    const shell = work.begin("Backing up");
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, work);

    const saving = context.beginWork("Saving the notes");
    const indexing = context.beginWork("Indexing the notes");
    indexing[Symbol.dispose]();
    const reported = work.descriptions.join(",");
    Assert.throws(() => context.beginWork(" "), ArgumentException);
    context[Symbol.dispose]();

    Assert.areEqual("Backing up,Saving the notes", reported);
    Assert.isTrue(saving.signal.aborted);
    Assert.isFalse(indexing.signal.aborted);
    Assert.isFalse(shell.signal.aborted);
    Assert.areEqual("Backing up", work.descriptions.join(","));
  }

  @TestMethod
  public async startsTheModulesProgramsInTheRuntimesName(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());

    const owned = await context.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    const owners = settings.processes.programs.map(t => t.moduleId).join(",");
    await owned.exited;

    Assert.areEqual("notes", owners);
    Assert.areEqual(process.execPath, owned.program);
  }

  @TestMethod
  public async readsThePersonsCurrentEnvironmentForTheModulesPrograms(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());

    const environment = await context.readEnvironmentAsync();
    await settings.processes.stopAllAsync();

    Assert.isTrue(Object.keys(environment).length > 0);
    Assert.isUndefined(environment["ELECTRON_RUN_AS_NODE"]);
  }

  @TestMethod
  public async startsPseudoTerminalsOnlyForAModuleThatDeclaresThem(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const library = new PseudoTerminalLibraryFixture();
    const declared = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", new Map(), "@noldova/desktop.notes.runtime", new Map(), [], null, [], null, true);
    const request = new PseudoTerminalRequest(library, process.execPath, [ProgramFixture.file, ProgramFixture.EXIT, "0"], folder.path, 80, 24, {});
    const undeclaredContext = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry());
    const declaredContext = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, declared);

    const refused = await Assert.throwsAsync(() => undeclaredContext.startPseudoTerminalAsync(request), PseudoTerminalsUndeclaredException);
    const started = library.started.length;
    const terminal = await declaredContext.startPseudoTerminalAsync(request);
    const owners = settings.processes.programs.map(t => t.moduleId).join(",");
    await terminal.exited;

    Assert.areEqual(`${process.execPath} was not started, because the module notes does not declare pseudoTerminals.`, refused.message);
    Assert.areEqual(0, started);
    Assert.areEqual("notes", owners);
    Assert.areEqual(process.execPath, terminal.program);
  }

  @TestMethod
  public async registersOnlyTheMethodsAndEventsItsDeclarationContributes(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const events: Event[] = [];
    const context = ModuleContextFixture.create(settings, methods, new EventRegistry({ broadcast: t => events.push(t), send: () => undefined }), new ServiceRegistry());

    context.registerMethod("notes.list", { handleAsync: async () => [] });
    context.declareEvent("notes.changed").publish(1);
    const method = Assert.throws(() => context.registerMethod("notes.open", { handleAsync: async () => null }), NotContributedException);
    const event = Assert.throws(() => context.declareEvent("tasks.changed"), NotContributedException);

    Assert.isDefined(methods.find(new QualifiedName("notes", "list")));
    Assert.areEqual("notes.changed", events[0]?.name.text);
    Assert.areEqual("The module notes does not declare notes.open among its methods.", method.message);
    Assert.areEqual("The module notes does not declare tasks.changed among its events.", event.message);
  }

  @TestMethod
  public async registersOnlyTheCommandsItsDeclarationContributes(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const commands = new CommandRegistry();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), commands);

    context.registerCommand(new RuntimeCommand("notes.newNote", "New note", "note_add", "Mod+Alt+N", { handleAsync: async () => null }));
    const undeclared = Assert.throws(() => context.registerCommand(new RuntimeCommand("notes.delete", "Delete note", null, null, { handleAsync: async () => null })), NotContributedException);
    const foreign = Assert.throws(() => context.registerCommand(new RuntimeCommand("tasks.add", "Add task", null, null, { handleAsync: async () => null })), NotContributedException);

    Assert.areEqual("notes.newNote", commands.list.commands.map(t => t.name.text).join(","));
    Assert.areEqual("The module notes does not declare notes.delete among its commands.", undeclared.message);
    Assert.areEqual("The module notes does not declare tasks.add among its commands.", foreign.message);
  }

  @TestMethod
  public async publishesServicesOnlyUnderItsOwnId(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const services = new ServiceRegistry();
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), services);
    const store = new Map<string, string>();

    context.publishService("notes.store", store);
    const foreign = Assert.throws(() => context.publishService("tasks.store", new Map()), ServiceNotOwnedException);
    const twice = Assert.throws(() => context.publishService("notes.store", new Map()), ServicePublishedException);

    Assert.areEqual<unknown>(store, services.find(new QualifiedName("notes", "store")));
    Assert.areEqual("The module notes may publish services only under its own id, not tasks.store.", foreign.message);
    Assert.areEqual("The service notes.store is already published.", twice.message);
  }

  @TestMethod
  public async findsTheServicesOfTheShellAndItsDependenciesByType(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const services = new ServiceRegistry();
    const tasks = new Map<string, string>([["first", "Write the plan"]]);
    const clock = new Set<string>();
    services.publish(new QualifiedName("tasks", "store"), tasks);
    services.publish(new QualifiedName("desktop", "clock"), clock);
    services.publish(new QualifiedName("calendar", "store"), new Map());
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), services);

    const found = context.getService("tasks.store", Map);
    const shell = context.getService("desktop.clock", Set);
    const notAllowed = Assert.throws(() => context.getService("calendar.store", Map), ServiceNotAllowedException);
    const missing = Assert.throws(() => context.getService("tasks.index", Map), ServiceMissingException);
    const wrongType = Assert.throws(() => context.getService("tasks.store", Set), ServiceTypeMismatchException);

    Assert.areEqual("Write the plan", found.get("first"));
    Assert.areEqual<unknown>(clock, shell);
    Assert.areEqual("The module notes may use only the shell's services and those of the modules it depends on, not calendar.store.", notAllowed.message);
    Assert.areEqual("No service tasks.index is published.", missing.message);
    Assert.areEqual("The service tasks.store is not a Set.", wrongType.message);
  }

  @TestMethod
  public async findsAnOptionalDependencysServicesOnlyWhileItIsAvailableAndWhatTheGuardAccepts(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const services = new ServiceRegistry();
    const zones = new Map<string, string>([["home", "Europe/Paris"]]);
    const tasks = new Map<string, string>();
    const clock = new Set<string>();
    services.publish(new QualifiedName("clock", "zones"), zones);
    services.publish(new QualifiedName("theme", "colors"), new Map());
    services.publish(new QualifiedName("tasks", "store"), tasks);
    services.publish(new QualifiedName("desktop", "clock"), clock);
    services.publish(new QualifiedName("calendar", "store"), new Map());
    const statuses = new Map([["clock", new ModuleStatus("clock", "0.0.1", "Clock", "Tells the time.", [], new Map(), ModuleState.Active, null)]]);
    const diagnostics = new TextOutputFixture();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), services, undefined, undefined, undefined, diagnostics, undefined, undefined, undefined, undefined,
      ModuleContextTests.OPTIONAL, new DependencyStates(t => statuses.get(t)));
    const isMap = (t: object): t is Map<unknown, unknown> => t instanceof Map;
    const isSet = (t: object): t is Set<unknown> => t instanceof Set;

    const found = context.findService("clock.zones", isMap);
    const inactive = context.findService("theme.colors", isMap);
    const unpublished = context.findService("clock.index", isMap);
    const required = context.findService("tasks.store", isMap);
    const shell = context.findService("desktop.clock", isSet);
    const refused = [context.findService("tasks.store", isSet), context.findService("tasks.store", isSet)];
    const notAllowed = Assert.throws(() => context.findService("calendar.store", isMap), ServiceNotAllowedException);
    statuses.delete("clock");
    const gone = context.findService("clock.zones", isMap);
    const unknown = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), services, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      ModuleContextTests.OPTIONAL).findService("clock.zones", isMap);

    Assert.areEqual<unknown>(zones, found);
    Assert.isNull(inactive);
    Assert.isNull(unpublished);
    Assert.areEqual<unknown>(tasks, required);
    Assert.areEqual<unknown>(clock, shell);
    Assert.areEqual("null,null", refused.map(String).join(","));
    Assert.areEqual(1, diagnostics.text.split("The service tasks.store is not what its check expects, so the module goes without it.").length - 1, diagnostics.text);
    Assert.areEqual("The module notes may use only the shell's services and those of the modules it depends on, not calendar.store.", notAllowed.message);
    Assert.isNull(gone);
    Assert.isNull(unknown);
  }

  @TestMethod
  public async tellsListenersOfAnOptionalDependencysChangeAndLogsOneThatFailsUntilStoppedOrDisposedAndRegistersNoneOnceDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const statuses = new Map<string, ModuleStatus>();
    const states = new DependencyStates(t => statuses.get(t));
    const diagnostics = new TextOutputFixture();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, diagnostics, undefined, undefined, undefined,
      undefined, ModuleContextTests.OPTIONAL, states);
    const heard: string[] = [];
    const stop = context.onDependencyChanged((moduleId, isActive) => heard.push(`first ${moduleId} ${isActive}`));
    context.onDependencyChanged(() => {
      throw new Error("The zones are closed.");
    });
    context.onDependencyChanged((moduleId, isActive) => heard.push(`last ${moduleId} ${isActive}`));

    statuses.set("clock", new ModuleStatus("clock", "0.0.1", "Clock", "Tells the time.", [], new Map(), ModuleState.Active, null));
    states.announce("clock");
    stop();
    statuses.delete("clock");
    states.announce("clock");
    context[Symbol.dispose]();
    const late = context.onDependencyChanged((moduleId, isActive) => heard.push(`late ${moduleId} ${isActive}`));
    states.announce("clock");
    late();

    Assert.areEqual("first clock true,last clock true,last clock false", heard.join(","));
    Assert.isTrue(diagnostics.text.includes("Its listener for a change of clock failed:"), diagnostics.text);
    Assert.areEqual(2, diagnostics.text.split("Error: The zones are closed.").length - 1, diagnostics.text);
  }

  @TestMethod
  public async hearsClosuresUntilDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const closures = new ClientClosures(new TextOutputFixture());
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, closures);
    const heard: string[] = [];
    context.onClientClosed(t => {
      heard.push(`${t.connection}:${t.window}`);
    });

    closures.report(new ClientClosure(1, 3));
    context[Symbol.dispose]();
    closures.report(new ClientClosure(1, null));

    Assert.areEqual("1:3", heard.join("|"));
  }

  @TestMethod
  public async withdrawsEverythingItRegisteredWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const events: Event[] = [];
    const eventRegistry = new EventRegistry({ broadcast: t => events.push(t), send: () => undefined });
    const services = new ServiceRegistry();
    const commands = new CommandRegistry();
    const context = ModuleContextFixture.create(settings, methods, eventRegistry, services, commands);
    context.registerMethod("notes.list", { handleAsync: async () => [] });
    context.registerCommand(new RuntimeCommand("notes.newNote", "New note", null, null, { handleAsync: async () => null }));
    const channel = context.declareEvent("notes.changed");
    context.publishService("notes.store", new Map());

    context[Symbol.dispose]();
    context[Symbol.dispose]();

    Assert.isUndefined(methods.find(new QualifiedName("notes", "list")));
    Assert.isUndefined(services.find(new QualifiedName("notes", "store")));
    Assert.isUndefined(commands.find(new QualifiedName("notes", "newNote")));
    Assert.throws(() => channel.publish(null), EventWithdrawnException);
    eventRegistry.declare(new QualifiedName("notes", "changed")).publish(null);
    Assert.areEqual(1, events.length);
  }

  @TestMethod
  public async postsUpdatesAndDismissesItsNotificationsAndDismissesThemAllWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    let ids = 0;
    const notifications = new NotificationCenter(() => undefined, () => new Date(), () => String(++ids));
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), new CommandRegistry(), notifications);
    notifications.post(ModuleContextTests.post("tasks.due", "Due", "tasks.show"));

    const saved = context.postNotification(ModuleContextTests.post("notes.saved", "Saved", "tasks.show"));
    const second = context.postNotification(ModuleContextTests.post("notes.saved", "Second", "notes.newNote"));
    saved.update(ModuleContextTests.post("notes.saved", "Saved again", null));
    second.dismiss();
    second.dismiss();
    const isBack = second.update(ModuleContextTests.post("notes.saved", "Back", null));
    const listed = notifications.list.notifications.map(t => `${t.id}:${t.post.title}`).join(",");
    context[Symbol.dispose]();

    Assert.isFalse(isBack);
    Assert.areEqual("2:Saved again,1:Due", listed);
    Assert.areEqual("Due", notifications.list.notifications.map(t => t.post.title).join(","));
  }

  @TestMethod
  public async refusesAnUndeclaredKindOrAnotherModulesCommandOnPostAndOnUpdate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const notifications = new NotificationCenter(() => undefined, () => new Date(), randomUUID);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), new CommandRegistry(), notifications);
    const saved = context.postNotification(ModuleContextTests.post("notes.saved", "Saved", null));

    const undeclared = Assert.throws(() => context.postNotification(ModuleContextTests.post("notes.deleted", "Deleted", null)), NotContributedException);
    const foreign = Assert.throws(() => saved.update(ModuleContextTests.post("notes.saved", "Saved", "calendar.show")), NotificationCommandNotAllowedException);

    Assert.areEqual("The module notes does not declare notes.deleted among its notifications.", undeclared.message);
    Assert.areEqual("The module notes may not offer the command calendar.show in a notification; it must be its own or a dependency's.", foreign.message);
    Assert.areEqual("Saved", notifications.list.notifications.map(t => t.post.title).join(","));
  }

  @TestMethod
  public async registersOnlyTheToolsItsDeclarationContributesAndLogsTheirFailures(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const tools = new ToolRegistry();
    const diagnostics = new TextOutputFixture();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, diagnostics, undefined, tools);
    const failing = new ToolHandlerFixture(() => Promise.reject(new Error("The index is corrupt.")));

    context.tools.register(ModuleContextTests.toolDescriptor("notes_search"), failing);
    const undeclared = Assert.throws(() => context.tools.register(ModuleContextTests.toolDescriptor("notes_delete"), new ToolHandlerFixture()), NotContributedException);
    const outcome = await context.tools.openSession("conversation-1", {}).callAsync("notes_search", {});

    Assert.areEqual("notes_search", tools.listTools().map(t => t.name).join(","));
    Assert.areEqual("The module notes does not declare notes_delete among its tools.", undeclared.message);
    Assert.areEqual("notes.internal", outcome.isFailure ? outcome.moduleCode : null);
    Assert.isTrue(diagnostics.text.includes("The tool notes_search failed: Error: The index is corrupt."), diagnostics.text);
    context[Symbol.dispose]();
  }

  @TestMethod
  public async withdrawsItsToolsEndsItsSessionsAndStopsListeningWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const tools = new ToolRegistry();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, tools);
    const ended: string[] = [];
    context.tools.onSessionEnded(t => ended.push(t));
    const own = context.tools.openSession("conversation-1", {});
    const handler = new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t));
    context.tools.register(ModuleContextTests.toolDescriptor("notes_search"), handler);
    const app = tools.openSession("conversation-2", {});
    const running = app.callAsync("notes_search", {});
    await handler.waitForCallAsync(1);

    context[Symbol.dispose]();
    app.end();

    const outcome = await running;
    Assert.areEqual(ToolFailureCode.Unavailable, outcome.isFailure ? outcome.code : null);
    Assert.areEqual(0, tools.listTools().length);
    Assert.areEqual(own.id, ended.join(","));
    const late = await own.callAsync("notes_search", {});
    Assert.areEqual("The agent session has ended.", late.isFailure ? late.message : null);
  }

  @TestMethod
  public async writesASessionListenerThatThrowsToItsLogAndStillWithdrawsItsToolsWhenDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const tools = new ToolRegistry();
    const diagnostics = new TextOutputFixture();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, diagnostics, undefined, tools);
    context.tools.register(ModuleContextTests.toolDescriptor("notes_search"), new ToolHandlerFixture());
    context.tools.onSessionEnded(() => {
      throw new Error("The index is closed.");
    });
    context.tools.openSession("conversation-1", {});

    context[Symbol.dispose]();

    Assert.areEqual(0, tools.listTools().length);
    Assert.isTrue(diagnostics.text.includes("A listener for ended agent sessions failed: Error: The index is closed."), diagnostics.text);
  }

  @TestMethod
  public async letsOnlyThePermissionsModuleAnswerAndManageRememberedAnswers(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const center = new PermissionCenter("notes");
    const store = new RememberedPermissionStore(settings.database);
    center.open(store);
    const named = ModuleContextTests.contextWithPermissions(settings, center);
    const other = ModuleContextTests.contextWithPermissions(settings, new PermissionCenter("app"));
    store.remember("notes", "notes.deleteItem", null, "conversation-1", PermissionDecision.AllowedAlways);
    const revoked: string[] = [];
    named.permissions.onRevoked(t => revoked.push(t.action));

    named.permissions.registerAnswerer(new PermissionAnswererFixture());
    const [remembered] = named.permissions.listRemembered();
    Assert.isDefined(remembered);
    const isRevoked = named.permissions.revoke(remembered.id);
    const refused = Assert.throws(() => other.permissions.registerAnswerer(new PermissionAnswererFixture()), PermissionsModuleOnlyException);
    Assert.throws(() => other.permissions.listRemembered(), PermissionsModuleOnlyException);
    Assert.throws(() => other.permissions.revoke(remembered.id), PermissionsModuleOnlyException);
    named[Symbol.dispose]();
    center.registerAnswerer("notes", new PermissionAnswererFixture(), named.log);
    store.remember("notes", "notes.deleteItem", null, "conversation-1", PermissionDecision.AllowedAlways);
    center.revoke("notes", center.listRemembered("notes")[0]?.id ?? String.empty);

    Assert.isTrue(isRevoked);
    Assert.areEqual("notes.deleteItem", revoked.join(","));
    Assert.isTrue(refused.message.startsWith("The module notes cannot answer permission requests"), refused.message);
    other[Symbol.dispose]();
  }

  @TestMethod
  public async stopsAgentControlAndRefusesToResumeItDuringItsOwnCall(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const tools = new ToolRegistry();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, tools);
    const heard: string[] = [];
    context.tools.onStopped(t => heard.push(`stopped: ${t}`));
    context.tools.onResumed(() => heard.push("resumed"));
    const handler = new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t));
    context.tools.register(ModuleContextTests.toolDescriptor("notes_search"), handler);

    const running = context.tools.openSession("conversation-1", {}).callAsync("notes_search", {});
    await handler.waitForCallAsync(1);
    const refused = Assert.throws(() => context.tools.resumeAll(), AgentControlException);
    context.tools.stopAll("The person took over.");
    const outcome = await running;
    await setImmediate();
    context.tools.resumeAll();
    context[Symbol.dispose]();
    tools.stopAll("A part missed its heartbeat.");

    Assert.isTrue(refused.message.startsWith("The module notes can't resume agent control"), refused.message);
    Assert.areEqual("Stopped", outcome.isFailure ? outcome.code : null);
    Assert.areEqual("stopped: The person took over.,resumed", heard.join(","));
  }

  @TestMethod
  public async stopsOneSessionsTurnAndStopsHearingItOnceThePartDeactivates(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const tools = new ToolRegistry();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, tools);
    const heard: string[] = [];
    context.tools.onSessionStopped((session, reason) => heard.push(`${session}: ${reason}`));
    const handler = new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t));
    context.tools.register(ModuleContextTests.toolDescriptor("notes_search"), handler);
    const session = context.tools.openSession("conversation-1", {});

    const running = session.callAsync("notes_search", {});
    await handler.waitForCallAsync(1);
    context.tools.stopSession(session.id, "The person took over the page.");
    const outcome = await running;
    const kept = tools.openSession("conversation-2", {});
    context[Symbol.dispose]();
    tools.stopSession("notes", kept.id, "The person took over the page.");

    Assert.areEqual("Stopped", outcome.isFailure ? outcome.code : null);
    Assert.areEqual(`${session.id}: The person took over the page.`, heard.join(","));
    Assert.isFalse(tools.isStopped);
  }

  @TestMethod
  public async readsWhetherAgentControlIsStoppedAlsoFromAPartSwitchedOnAfterTheStopAndInItsListeners(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const tools = new ToolRegistry();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, tools);
    const read = [context.tools.isStopped];
    context.tools.onStopped(() => read.push(context.tools.isStopped));
    context.tools.onResumed(() => read.push(context.tools.isStopped));

    tools.stopAll("The person took over.");
    read.push(context.tools.isStopped);
    const later = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, tools);
    read.push(later.tools.isStopped);
    context.tools.resumeAll();
    read.push(context.tools.isStopped, later.tools.isStopped);
    context[Symbol.dispose]();
    later[Symbol.dispose]();

    Assert.areEqual("false,true,true,true,false,false,false", read.join(","));
  }

  private static contextWithPermissions(settings: SettingsFixture, center: PermissionCenter): ModuleContext {
    return ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined,
      new ToolRegistry(undefined, undefined, center));
  }

  private static toolDescriptor(name: string): IToolDescriptor {
    return {
      name,
      description: "Searches the notes.",
      inputSchema: { type: "object" },
      hints: { isReadOnly: true },
      risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
      deadline: { default: 2_000, maximum: 5_000 }
    };
  }

  @TestMethod
  public async registersNoMethodCommandEventOrServiceOnceDisposedSoItsNextActivationRegistersThemAgain(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const events = new EventRegistry(new EventSinkFixture());
    const services = new ServiceRegistry();
    const commands = new CommandRegistry();
    const late = ModuleContextFixture.create(settings, methods, events, services, commands);
    late[Symbol.dispose]();

    late.registerMethod("notes.list", { handleAsync: async () => [] });
    late.registerCommand(new RuntimeCommand("notes.newNote", "New note", null, null, { handleAsync: async () => null }));
    const lateChannel = late.declareEvent("notes.changed");
    late.publishService("notes.store", new Map());
    const left = [methods.find(new QualifiedName("notes", "list")), commands.find(new QualifiedName("notes", "newNote")), services.find(new QualifiedName("notes", "store"))];
    const refused = [() => lateChannel.publish(null), () => lateChannel.publishTo(1, null, null)].map(t => Assert.throws(t, EventWithdrawnException).message);
    lateChannel[Symbol.dispose]();
    Assert.throws(() => late.registerMethod("notes.other", { handleAsync: async () => [] }), NotContributedException);
    const next = ModuleContextFixture.create(settings, methods, events, services, commands);
    next.registerMethod("notes.list", { handleAsync: async () => [] });
    next.registerCommand(new RuntimeCommand("notes.newNote", "New note", null, null, { handleAsync: async () => null }));
    next.declareEvent("notes.changed").publish(null);
    next.publishService("notes.store", new Map());

    Assert.areEqual("undefined,undefined,undefined", left.map(String).join(","));
    Assert.areEqual(2, refused.filter(t => t.includes("notes.changed")).length);
    Assert.isDefined(methods.find(new QualifiedName("notes", "list")));
    Assert.isDefined(commands.find(new QualifiedName("notes", "newNote")));
    Assert.isDefined(services.find(new QualifiedName("notes", "store")));
  }

  @TestMethod
  public async hearsNoClosureSettingWindowOrShortcutChangeOnceDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync(ModuleContextFixture.SETTINGS);
    const diagnostics = new TextOutputFixture();
    const closures = new ClientClosures(diagnostics);
    const surface = new AppSurface(closures, "linux", diagnostics);
    const late = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(),
      undefined, undefined, undefined, diagnostics, undefined, undefined, closures, undefined, undefined, undefined, surface);
    const heard: string[] = [];
    late[Symbol.dispose]();

    late.onClientClosed(() => {
      heard.push("closed");
    });
    late.settings.onChanged("notes.sortBy", () => heard.push("setting"));
    const stopWindows = late.appWindows.onChanged(() => heard.push("windows"));
    const stopShortcuts = late.shortcuts.onChanged(() => heard.push("shortcuts"));
    closures.report(new ClientClosure(1, 3));
    late.settings.write("notes.sortBy", "b");
    surface.receiveWindows(1, new AppWindowList([new AppWindow(132_406, 4210)]));
    surface.receiveShortcuts(1, new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true)]));
    stopWindows();
    stopShortcuts();

    Assert.areEqual(String.empty, heard.join(","));
    Assert.areEqual("b", String(late.settings.read("notes.sortBy")));
    Assert.throws(() => late.settings.onChanged("clock.speed", () => undefined), SettingNotReadableException);
  }

  @TestMethod
  public async readsTheAppsWindowsAndShortcutsAndWithdrawsItsListenersWhenThePartDeactivates(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    const closures = new ClientClosures(diagnostics);
    const surface = new AppSurface(closures, "linux", diagnostics);
    const context = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(),
      undefined, undefined, undefined, diagnostics, undefined, undefined, closures, undefined, undefined, undefined, surface);
    const heard: string[] = [];
    context.appWindows.onChanged(() => {
      heard.push(`windows ${context.appWindows.list().length}`);
    });
    context.shortcuts.onChanged(() => {
      heard.push(`shortcuts ${context.shortcuts.list().length}`);
    });
    const stopped = context.appWindows.onChanged(() => {
      heard.push("stopped");
    });
    const stoppedKeys = context.shortcuts.onChanged(() => {
      heard.push("stopped keys");
    });
    stopped();
    stoppedKeys();

    surface.receiveWindows(1, new AppWindowList([new AppWindow(132_406, 4210)]));
    surface.receiveShortcuts(1, new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true)]));
    const read = [context.appWindows.list()[0]?.handle, context.shortcuts.list()[0]?.command, context.shortcuts.has(KeyChord.parse("Ctrl+Shift+Period")), context.shortcuts.has(KeyChord.parse("Mod+Q"))].join(" ");
    context[Symbol.dispose]();
    surface.receiveWindows(1, new AppWindowList([]));
    surface.receiveShortcuts(1, new AppShortcutList([]));

    Assert.areEqual("132406 desktop.stopAgentControl true false", read);
    Assert.areEqual("windows 1|shortcuts 1", heard.join("|"));
  }

  @TestMethod
  public async postsNoNotificationBeginsNoWorkAndStartsNoProgramOnceDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const notifications = new NotificationCenter(() => undefined, () => new Date(), randomUUID);
    const work = new WorkTracker(() => undefined);
    const library = new PseudoTerminalLibraryFixture();
    const declared = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", new Map(), "@noldova/desktop.notes.runtime", new Map(), [], null, [], null, true);
    const late = ModuleContextFixture.create(settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), new CommandRegistry(), notifications, work);
    const lateTerminals = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, declared);
    late[Symbol.dispose]();
    lateTerminals[Symbol.dispose]();

    const handle = late.postNotification(ModuleContextTests.post("notes.saved", "Saved", null));
    const updated = handle.update(ModuleContextTests.post("notes.saved", "Saved again", null));
    handle.dismiss();
    Assert.throws(() => late.postNotification(ModuleContextTests.post("notes.deleted", "Deleted", null)), NotContributedException);
    Assert.throws(() => handle.update(ModuleContextTests.post("notes.saved", "Saved", "calendar.show")), NotificationCommandNotAllowedException);
    const item = late.beginWork("Saving the notes");
    const reported = work.descriptions.join(",");
    const ended = item.signal.aborted;
    item[Symbol.dispose]();
    Assert.throws(() => late.beginWork(" "), ArgumentException);
    const program = await Assert.throwsAsync(() => late.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"])), ModuleDeactivatedException);
    const terminal = await Assert.throwsAsync(
      () => lateTerminals.startPseudoTerminalAsync(new PseudoTerminalRequest(library, process.execPath, [ProgramFixture.file, ProgramFixture.EXIT, "0"], folder.path, 80, 24, {})), ModuleDeactivatedException);

    Assert.areEqual(0, notifications.list.notifications.length);
    Assert.areEqual(String.empty, handle.id);
    Assert.isFalse(updated);
    Assert.areEqual(String.empty, reported);
    Assert.isTrue(ended);
    Assert.areEqual("notes,notes", [program.moduleId, terminal.moduleId].join(","));
    Assert.areEqual(0, settings.processes.programs.length);
    Assert.areEqual(0, library.started.length);
  }

  @TestMethod
  public async hearsNoViewOrProtocolEventOnceDisposedThoughItsNextActivationHearsItsOwn(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const center = new WebViewCenter(new TextOutputFixture(), new EventRegistry(new EventSinkFixture()).declare(ShellEvents.webViewCommand));
    center.check(7);
    const late = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, center);
    late[Symbol.dispose]();
    const next = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, center);
    const heard: string[] = [];

    const stopView = late.webViews.onViewEvent(t => heard.push(`late ${t.kind}`));
    const stopProtocol = late.webViews.relay.onProtocolEvent("1", t => heard.push(`late ${t.method}`));
    next.webViews.onViewEvent(t => heard.push(`next ${t.kind}`));
    center.receive(7, new WebViewEvents([
      new WebViewEvent("notes", "1", WebViewEventKind.Protocol, { method: "Page.loadEventFired", params: { timestamp: 1 }, isCut: false }),
      new WebViewEvent("notes", "1", WebViewEventKind.Crashed)
    ]));
    stopView();
    stopProtocol();

    Assert.areEqual("next Crashed", heard.join(","));
  }

  @TestMethod
  public async drivesNoWebViewOnceDisposedThoughItStillRefusesAnInvalidMove(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const sink = new EventSinkFixture();
    const center = new WebViewCenter(new TextOutputFixture(), new EventRegistry(sink).declare(ShellEvents.webViewCommand));
    center.check(7);
    const late = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, center);
    late[Symbol.dispose]();
    const sent = sink.sent.length;

    await Assert.throwsAsync(() => late.webViews.actAsync("1", WebViewAction.Navigate), ArgumentException);
    const refused = [
      await Assert.throwsAsync(() => late.webViews.navigateAsync("1", "https://example.com/"), ModuleDeactivatedException),
      await Assert.throwsAsync(() => late.webViews.actAsync("1", WebViewAction.Reload), ModuleDeactivatedException),
      await Assert.throwsAsync(() => late.webViews.setAllowedOriginsAsync("1", ["https://example.com"]), ModuleDeactivatedException),
      await Assert.throwsAsync(() => late.webViews.setControlledAsync("1", true), ModuleDeactivatedException),
      await Assert.throwsAsync(() => late.webViews.clearProfileAsync("notes.main"), ModuleDeactivatedException),
      await Assert.throwsAsync(() => late.webViews.relay.sendAsync("1", "Page.reload", {}, 2_000), ModuleDeactivatedException)
    ];

    Assert.areEqual("notes,notes,notes,notes,notes,notes", refused.map(t => t.moduleId).join(","));
    Assert.areEqual(sent, sink.sent.length);
  }

  private static post(kind: string, title: string, action: string | null): NotificationPost {
    const actions = Object.isNull(action) ? [] : [new NotificationAction("Show", new CommandRun(QualifiedName.parse(action), null))];
    return new NotificationPost(QualifiedName.parse(kind), null, title, null, NotificationSeverity.Info, null, actions, null);
  }
}
