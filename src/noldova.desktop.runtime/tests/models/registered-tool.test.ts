/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IModuleLog, type IToolHandler, ToolDescriptor, ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { RegisteredTool } from "../../src/models/registered-tool.js";

@TestClass
export class RegisteredToolTests {
  @TestMethod
  public keepsItsModuleDescriptorHandlerAndLog(): void {
    const descriptor = new ToolDescriptor(
      { name: "notes_search", description: "Searches the notes.", inputSchema: { type: "object" }, hints: { isReadOnly: true }, risk: { default: ToolRisk.Low, maximum: ToolRisk.Low }, deadline: { default: 5_000, maximum: 30_000 } },
      ["notes_search"]);
    const handler: IToolHandler = { handleAsync: () => Promise.resolve(new ToolResult([])) };
    const log: IModuleLog = { write: () => undefined };

    const tool = new RegisteredTool("notes", descriptor, handler, ["notes_search"], log);

    Assert.areEqual("notes", tool.moduleId);
    Assert.areEqual(descriptor, tool.descriptor);
    Assert.areEqual(handler, tool.handler);
    Assert.areEqual(log, tool.log);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheModulesTools(): void {
    const tools = ["notes_search"];
    const descriptor = new ToolDescriptor(
      { name: "notes_search", description: "Searches the notes.", inputSchema: { type: "object" }, hints: { isReadOnly: true }, risk: { default: ToolRisk.Low, maximum: ToolRisk.Low }, deadline: { default: 5_000, maximum: 30_000 } }, tools);

    const tool = new RegisteredTool("notes", descriptor, { handleAsync: () => Promise.resolve(new ToolResult([])) }, tools, { write: () => undefined });
    tools.push("notes_append");

    Assert.areEqual("notes_search", tool.moduleTools.join("|"));
  }
}
