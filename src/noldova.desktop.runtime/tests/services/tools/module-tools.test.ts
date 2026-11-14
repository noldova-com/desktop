/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ToolRisk } from "../../../src/enums/tool-risk.js";
import { NotContributedException } from "../../../src/exceptions/not-contributed.exception.js";
import type { IToolDescriptor } from "../../../src/interfaces/i-tool-descriptor.js";
import { ModuleDeclaration } from "../../../src/models/module-declaration.js";
import { ModuleTools } from "../../../src/services/tools/module-tools.js";
import { ToolRegistry } from "../../../src/services/tools/tool-registry.js";
import { ModuleLogFixture } from "../../fixtures/module-log.fixture.js";
import { ToolHandlerFixture } from "../../fixtures/tool-handler.fixture.js";

@TestClass
export class ModuleToolsTests {
  private static readonly DECLARATION: ModuleDeclaration =
    new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", new Map(), null, new Map([["tools", ["notes_search"]]]));
  private static readonly SEARCH: IToolDescriptor = {
    name: "notes_search",
    description: "Searches the notes.",
    inputSchema: { type: "object" },
    hints: { isReadOnly: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 2_000, maximum: 5_000 }
  };

  @TestMethod
  public registersOnlyTheToolsItsModuleContributesAndKeepsTheirRegistrations(): void {
    const registry = new ToolRegistry();
    const registrations: Disposable[] = [];
    const tools = ModuleToolsTests.create(registry, registrations);

    const refused = Assert.throws(() => tools.register({ ...ModuleToolsTests.SEARCH, name: "notes_delete" }, new ToolHandlerFixture()), NotContributedException);
    const registration = tools.register(ModuleToolsTests.SEARCH, new ToolHandlerFixture());
    const listed = registry.listTools().map(t => t.name).join(",");
    registration[Symbol.dispose]();

    Assert.isTrue(refused.message.includes("notes_delete"), refused.message);
    Assert.areEqual("notes_search", listed);
    Assert.areEqual(String.empty, registry.listTools().map(t => t.name).join(","));
    Assert.areEqual(1, registrations.length);
    Assert.areEqual(registration, registrations[0]);
  }

  @TestMethod
  public endsTheSessionsItOpenedWhenItsRegistrationsEnd(): void {
    const registry = new ToolRegistry();
    const registrations: Disposable[] = [];
    const tools = ModuleToolsTests.create(registry, registrations);
    const ended: string[] = [];
    registry.onSessionEnded(t => ended.push(t), new ModuleLogFixture());

    const session = tools.openSession("conversation-1", {});
    const isOpen = registry.isOpen(session);
    for (const registration of registrations)
      registration[Symbol.dispose]();

    Assert.isTrue(isOpen);
    Assert.isFalse(registry.isOpen(session));
    Assert.areEqual(session.id, ended.join(","));
    Assert.areEqual(1, registrations.length);
  }

  @TestMethod
  public stopsAndResumesAgentControlAndTellsItsListenersUntilTheirRegistrationsEnd(): void {
    const registry = new ToolRegistry();
    const registrations: Disposable[] = [];
    const tools = ModuleToolsTests.create(registry, registrations);
    const heard: string[] = [];
    tools.onStopped(t => heard.push(`stopped ${t}`));
    tools.onResumed(() => heard.push("resumed"));
    tools.onSessionStopped((session, reason) => heard.push(`session ${session} ${reason}`));
    tools.onSessionEnded(t => heard.push(`ended ${t}`));
    const session = tools.openSession("conversation-1", {});

    tools.stopSession(session.id, "The person stopped it.");
    tools.stopAll("The person stopped everything.");
    const isStopped = tools.isStopped;
    tools.resumeAll();
    const isResumed = !tools.isStopped;
    for (const registration of registrations)
      registration[Symbol.dispose]();
    tools.stopAll("Again.");
    tools.resumeAll();

    Assert.areEqual(`session ${session.id} The person stopped it.,stopped The person stopped everything.,resumed`, heard.join(","));
    Assert.isTrue(isStopped);
    Assert.isTrue(isResumed);
    Assert.areEqual(5, registrations.length);
  }

  private static create(registry: ToolRegistry, registrations: Disposable[]): ModuleTools {
    return new ModuleTools(ModuleToolsTests.DECLARATION, registry, new ModuleLogFixture(), registrations, new AbortController().signal);
  }
}
