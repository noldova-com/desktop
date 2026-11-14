/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionRevocation } from "@noldova/desktop.runtime";
import type { IPermissionsContext } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakePermissionsContext } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";
import { PermissionAnswererFixture } from "../../fixtures/permission-answerer.fixture.js";

@TestClass
export class FakePermissionsContextTests {
  private static readonly MEMBERS: Readonly<Record<keyof IPermissionsContext, FakeMember<IPermissionsContext>>> = {
    registerAnswerer: ["registered", t => t.registerAnswerer(new PermissionAnswererFixture())],
    listRemembered: ["answered", t => t.listRemembered()],
    revoke: ["answered", t => t.revoke("permission-1")],
    onRevoked: ["registered", t => t.onRevoked(() => undefined)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakePermissionsContextTests.MEMBERS), await FakeMembersFixture.observeAsync<IPermissionsContext>(() => new FakePermissionsContext(), FakePermissionsContextTests.MEMBERS));
  }

  @TestMethod
  public raisesARevocationUntilTheRegistrationIsDisposed(): void {
    const permissions = new FakePermissionsContext();
    const heard: string[] = [];
    const registration = permissions.onRevoked(t => heard.push(t.action));

    permissions.raiseRevoked(new PermissionRevocation("git.push", null, "folder"));
    registration[Symbol.dispose]();
    permissions.raiseRevoked(new PermissionRevocation("git.pull", null, "folder"));

    Assert.areEqual("git.push", heard.join("|"));
  }

  @TestMethod
  public stillCallsARemovedListenerAndWritesAThrownErrorToTheLogWithoutStoppingTheRest(): void {
    const log = new FakeModuleLog();
    const permissions = new FakePermissionsContext(log);

    const heard = FakeRaisersFixture.heard(listener => {
      const registration = permissions.onRevoked(listener);
      return () => registration[Symbol.dispose]();
    }, () => permissions.raiseRevoked(new PermissionRevocation("git.push", null, "folder")));

    Assert.areEqual("removed|third|fourth", heard);
    Assert.areEqual(0, permissions.errors.length);
    Assert.isTrue(FakeRaisersFixture.logged(log, "A listener for revoked permission answers failed: "));
  }
}
