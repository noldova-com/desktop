/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Fake, UnansweredCallException } from "@noldova/desktop.protocol/testing";

export type FakeMember<T extends object> =
  | readonly ["answered" | "told" | "kept" | "property" | "fake", (fake: Fake<T> & T) => unknown]
  | readonly ["registered", (fake: Fake<T> & T) => Disposable | (() => void)];

export class FakeMembersFixture {
  private static readonly SEPARATOR: string = "\n";
  private static readonly ASYNC_SUFFIX: string = "Async";

  public static expected<T extends object>(members: Readonly<Record<string, FakeMember<T>>>): string {
    return Object.entries(members).map(([member, [kind]]) => `${member} ${kind}`).join(FakeMembersFixture.SEPARATOR);
  }

  public static async observeAsync<T extends object>(create: () => Fake<T> & T, members: Readonly<Record<string, FakeMember<T>>>): Promise<string> {
    const lines: string[] = [];
    for (const [member, entry] of Object.entries(members))
      lines.push(`${member} ${await FakeMembersFixture.kindOfAsync(create(), member, entry)}`);
    return lines.join(FakeMembersFixture.SEPARATOR);
  }

  private static async kindOfAsync<T extends object>(fake: Fake<T> & T, member: string, entry: FakeMember<T>): Promise<string> {
    if (entry[0] === "registered")
      return FakeMembersFixture.registeredOf(fake, member, entry[1](fake));
    const [kind, call] = entry;
    const result = FakeMembersFixture.attempt(() => call(fake));
    const recorded = fake.calls.map(t => t.member).join(FakeMembersFixture.SEPARATOR);
    switch (kind) {
      case "fake":
        return result.value instanceof Fake ? kind : "unexpected value";
      case "property":
        return result.unanswered === member && recorded === String.empty ? kind : `unexpected property ${result.unanswered}`;
      case "answered":
        return await FakeMembersFixture.unansweredOfAsync(member, result) === member && recorded === member ? kind : `unexpected answer ${recorded}`;
      case "told":
        return Object.isNull(result.unanswered) && Object.isUndefined(result.value) && recorded === member && FakeMembersFixture.activeOf(fake) === 0 ? kind : `unexpected call ${recorded}`;
      case "kept":
        return Object.isNull(result.unanswered) && Object.isUndefined(result.value) && recorded === member && FakeMembersFixture.activeOf(fake) === 1 ? kind : `unexpected call ${recorded}`;
    }
  }

  private static async unansweredOfAsync(member: string, result: { readonly value: unknown; readonly unanswered: string | null }): Promise<string | null> {
    if (!member.endsWith(FakeMembersFixture.ASYNC_SUFFIX))
      return result.unanswered;
    if (!(result.value instanceof Promise))
      return null;
    try {
      await result.value;
    } catch (error) {
      return error instanceof UnansweredCallException ? error.member : null;
    }
    return null;
  }

  private static registeredOf<T extends object>(fake: Fake<T> & T, member: string, ending: Disposable | (() => void)): string {
    const active = FakeMembersFixture.activeOf(fake);
    if (Object.isFunction(ending))
      ending();
    else
      ending[Symbol.dispose]();
    const facts = JSON.stringify([fake.calls.map(t => t.member), active, FakeMembersFixture.activeOf(fake)]);
    return facts === JSON.stringify([[member], 1, 0]) ? "registered" : `unexpected registration ${facts}`;
  }

  private static activeOf<T extends object>(fake: Fake<T> & T): number {
    return fake.calls.reduce((count, t) => count + fake.activeCallsOf(t.member).length, 0);
  }

  private static attempt(action: () => unknown): { readonly value: unknown; readonly unanswered: string | null } {
    try {
      return { value: action(), unanswered: null };
    } catch (error) {
      if (error instanceof UnansweredCallException)
        return { value: undefined, unanswered: error.member };
      throw error;
    }
  }
}
