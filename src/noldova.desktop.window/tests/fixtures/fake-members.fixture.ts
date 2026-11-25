/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Fake, UnansweredCallException } from "@noldova/desktop.protocol/testing";

import { MemberAnsweredException } from "../exceptions/member-answered.exception";
import type { FakeMember } from "../models/fake-member";

export class FakeMembersFixture {
  private static readonly ASYNC_SUFFIX: string = "Async";

  public static check<T extends object>(create: () => Fake<T> & T, members: Readonly<Record<string, FakeMember<T>>>): void {
    for (const [member, entry] of Object.entries(members))
      it(`stands in for ${member} as a member that is ${entry.kind}`, async () => {
        await FakeMembersFixture.checkMemberAsync(create(), member, entry);
      });
  }

  private static async checkMemberAsync<T extends object>(fake: Fake<T> & T, member: string, entry: FakeMember<T>): Promise<void> {
    if (!Object.isNull(entry.track)) {
      const dispose = entry.track(fake);
      const active = FakeMembersFixture.activeOf(fake);
      dispose();
      expect([fake.calls.map(t => t.member), active, FakeMembersFixture.activeOf(fake)]).toEqual([[member], 1, 0]);
      return;
    }
    const call = entry.call;
    switch (entry.kind) {
      case "property":
        expect([FakeMembersFixture.unanswered(() => call(fake)), fake.calls.length]).toEqual([member, 0]);
        break;
      case "fake":
        expect(call(fake)).toBeInstanceOf(Fake);
        break;
      case "answered":
        if (member.endsWith(FakeMembersFixture.ASYNC_SUFFIX)) {
          const result = call(fake);
          expect(result).toBeInstanceOf(Promise);
          await expect(result).rejects.toEqual(new UnansweredCallException(member));
        } else
          expect(FakeMembersFixture.unanswered(() => call(fake))).toBe(member);
        expect(fake.calls.map(t => t.member)).toEqual([member]);
        break;
      case "told":
        expect([call(fake), fake.calls.map(t => t.member), FakeMembersFixture.activeOf(fake)]).toEqual([undefined, [member], 0]);
        break;
    }
  }

  private static activeOf<T extends object>(fake: Fake<T> & T): number {
    return fake.calls.reduce((count, t) => count + fake.activeCallsOf(t.member).length, 0);
  }

  private static unanswered(read: () => unknown): string {
    try {
      read();
    } catch (error) {
      if (error instanceof UnansweredCallException)
        return error.member;
      throw error;
    }
    throw new MemberAnsweredException();
  }
}
