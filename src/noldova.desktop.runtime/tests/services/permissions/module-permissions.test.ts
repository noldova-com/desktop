/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PermissionDecision } from "../../../src/enums/permission-decision.js";
import { AnswererRegisteredException } from "../../../src/exceptions/answerer-registered.exception.js";
import { PermissionsModuleOnlyException } from "../../../src/exceptions/permissions-module-only.exception.js";
import type { PermissionRevocation } from "../../../src/models/permission-revocation.js";
import { DataDirectory } from "../../../src/services/data-directory/data-directory.js";
import { ShellDatabase } from "../../../src/services/database/shell-database.js";
import { ShellMigrations } from "../../../src/services/database/shell-migrations.js";
import { OwnershipLock } from "../../../src/services/ownership/ownership-lock.js";
import { ModulePermissions } from "../../../src/services/permissions/module-permissions.js";
import { PermissionCenter } from "../../../src/services/permissions/permission-center.js";
import { RememberedPermissionStore } from "../../../src/services/permissions/remembered-permission-store.js";
import { ModuleLogFixture } from "../../fixtures/module-log.fixture.js";
import { PermissionAnswererFixture } from "../../fixtures/permission-answerer.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ModulePermissionsTests {
  private static readonly APP: string = "app";
  private static readonly NOTES: string = "notes";

  @TestMethod
  public registersTheAnswererForItsModuleAndKeepsTheRegistrationForTheModulesEnd(): void {
    const center = new PermissionCenter(ModulePermissionsTests.APP);
    const registrations: Disposable[] = [];
    const permissions = new ModulePermissions(ModulePermissionsTests.APP, center, new ModuleLogFixture(), registrations);

    const registration = permissions.registerAnswerer(new PermissionAnswererFixture());
    const second = Assert.throws(() => permissions.registerAnswerer(new PermissionAnswererFixture()), AnswererRegisteredException);
    for (const kept of registrations)
      kept[Symbol.dispose]();
    using again = permissions.registerAnswerer(new PermissionAnswererFixture());

    Assert.areEqual(2, registrations.length);
    Assert.areEqual(registration, registrations[0]);
    Assert.areEqual(again, registrations[1]);
    Assert.isTrue(second.message.length > 0);
  }

  @TestMethod
  public async refusesAnotherModuleTheAnswererTheListAndRevokingAndKeepsNoRegistration(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const center = new PermissionCenter(ModulePermissionsTests.APP);
    center.open(new RememberedPermissionStore(database));
    const registrations: Disposable[] = [];
    const permissions = new ModulePermissions(ModulePermissionsTests.NOTES, center, new ModuleLogFixture(), registrations);

    Assert.throws(() => permissions.registerAnswerer(new PermissionAnswererFixture()), PermissionsModuleOnlyException);
    Assert.throws(() => permissions.listRemembered(), PermissionsModuleOnlyException);
    Assert.throws(() => permissions.revoke("any"), PermissionsModuleOnlyException);
    Assert.areEqual(0, registrations.length);
  }

  @TestMethod
  public async listsAndRevokesTheRememberedAnswersAndTellsTheirModulesListenerUntilItsRegistrationEnds(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    const store = new RememberedPermissionStore(database);
    const center = new PermissionCenter(ModulePermissionsTests.APP);
    center.open(store);
    store.remember(ModulePermissionsTests.NOTES, "notes.deleteItem", "item-1", "conversation-1", PermissionDecision.AllowedAlways);
    store.remember(ModulePermissionsTests.NOTES, "notes.deleteItem", "item-2", "conversation-1", PermissionDecision.DeniedAlways);
    const app = new ModulePermissions(ModulePermissionsTests.APP, center, new ModuleLogFixture(), []);
    const notesRegistrations: Disposable[] = [];
    const notes = new ModulePermissions(ModulePermissionsTests.NOTES, center, new ModuleLogFixture(), notesRegistrations);
    const revocations: PermissionRevocation[] = [];
    notes.onRevoked(t => revocations.push(t));

    const listed = app.listRemembered();
    const [first, second] = listed;
    Assert.isDefined(first);
    Assert.isDefined(second);
    const isFirstRevoked = app.revoke(first.id);
    const isFirstRevokedAgain = app.revoke(first.id);
    for (const registration of notesRegistrations)
      registration[Symbol.dispose]();
    const isSecondRevoked = app.revoke(second.id);

    Assert.areEqual(2, listed.length);
    Assert.areEqual(1, notesRegistrations.length);
    Assert.isTrue(isFirstRevoked);
    Assert.isFalse(isFirstRevokedAgain);
    Assert.isTrue(isSecondRevoked);
    Assert.areEqual(`notes.deleteItem|${String(first.subject)}|conversation-1`, revocations.map(t => `${t.action}|${String(t.subject)}|${t.scope}`).join(","));
    Assert.areEqual(0, app.listRemembered().length);
  }
}
