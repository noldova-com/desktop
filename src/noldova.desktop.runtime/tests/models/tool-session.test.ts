/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IToolCallOptions, type IToolSessionHost, ToolDescriptor, ToolFailure, ToolFailureCode, ToolResult, ToolRisk, ToolSession } from "@noldova/desktop.runtime";

@TestClass
export class ToolSessionTests {
  @TestMethod
  public keepsItsIdScopeAndBindings(): void {
    const bindings = { notebook: "Work" };

    const session = new ToolSession("session-1", "conversation-1", bindings, ToolSessionTests.host([], []));

    Assert.areEqual("session-1", session.id);
    Assert.areEqual("conversation-1", session.scope);
    Assert.areEqual(bindings, session.bindings);
  }

  @TestMethod
  public listsTheHostsTools(): void {
    const descriptor = new ToolDescriptor(
      { name: "notes_search", description: "Searches the notes.", inputSchema: { type: "object" }, hints: { isReadOnly: true }, risk: { default: ToolRisk.Low, maximum: ToolRisk.Low }, deadline: { default: 5_000, maximum: 30_000 } },
      ["notes_search"]);

    const session = new ToolSession("session-1", "conversation-1", {}, ToolSessionTests.host([descriptor], []));

    Assert.areEqual(descriptor, session.listTools()[0]);
    Assert.areEqual(1, session.listTools().length);
  }

  @TestMethod
  public async callsThroughTheHostWithItselfAndNoOptionsByDefault(): Promise<void> {
    const calls: string[] = [];
    const host = ToolSessionTests.host([], calls);
    const session = new ToolSession("session-1", "conversation-1", {}, host);
    const options: IToolCallOptions = { deadlineMilliseconds: 2_000 };

    const first = await session.callAsync("notes_search", { text: "plans" });
    await session.callAsync("notes_search", { text: "dates" }, options);

    Assert.isTrue(first instanceof ToolResult);
    Assert.areEqual("session-1 notes_search {\"text\":\"plans\"} {}|session-1 notes_search {\"text\":\"dates\"} {\"deadlineMilliseconds\":2000}", calls.join("|"));
  }

  @TestMethod
  public endsThroughTheHost(): void {
    const calls: string[] = [];
    const session = new ToolSession("session-1", "conversation-1", {}, ToolSessionTests.host([], calls));

    session.end();

    Assert.areEqual("end session-1", calls.join("|"));
  }

  @TestMethod
  public async passesOnTheHostsFailure(): Promise<void> {
    const failure = new ToolFailure(ToolFailureCode.Refused, "The note is outside the notebook.");
    const host: IToolSessionHost = { listTools: () => [], callAsync: () => Promise.resolve(failure), end: () => undefined };

    const outcome = await new ToolSession("session-1", "conversation-1", {}, host).callAsync("notes_append", {});

    Assert.areEqual(failure, outcome);
  }

  private static host(tools: readonly ToolDescriptor[], calls: string[]): IToolSessionHost {
    return {
      listTools: () => tools,
      callAsync: (session: ToolSession, name: string, input: JsonObject, options: IToolCallOptions) => {
        calls.push(`${session.id} ${name} ${JSON.stringify(input)} ${JSON.stringify(options)}`);
        return Promise.resolve(new ToolResult([]));
      },
      end: (session: ToolSession) => {
        calls.push(`end ${session.id}`);
      }
    };
  }
}
