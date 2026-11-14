/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { NotContributedException } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ModuleDeclaration } from "../../src/models/module-declaration.js";
import { ShownNotificationsFixture } from "./shown-notifications.fixture.js";

@TestClass
export class ShownNotificationsFixtureTests {
  private static readonly NOTES: ModuleDeclaration =
    new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", new Map(), null, new Map([["notifications", ["notes.sync", "notes.alarm"]]]));

  @TestMethod
  public showsEachPostAndWhatItsHandleChanges(): void {
    const notifications = new ShownNotificationsFixture(ShownNotificationsFixtureTests.NOTES);

    const sync = notifications.postNotification(ShownNotificationsFixtureTests.post("notes.sync", "Syncing"));
    const alarm = notifications.postNotification(ShownNotificationsFixtureTests.post("notes.alarm", "Alarm"));
    const isUpdated = sync.update(ShownNotificationsFixtureTests.post("notes.sync", "Synced"));
    alarm.dismiss();

    Assert.isTrue(isUpdated);
    Assert.areEqual("Synced", notifications.shown.map(t => t.title).join(","));
  }

  @TestMethod
  public replacesAPostWithTheSameKindAndKey(): void {
    const notifications = new ShownNotificationsFixture(ShownNotificationsFixtureTests.NOTES);

    const first = notifications.postNotification(ShownNotificationsFixtureTests.post("notes.sync", "Syncing", "inbox"));
    const second = notifications.postNotification(ShownNotificationsFixtureTests.post("notes.sync", "Synced", "inbox"));

    Assert.areEqual(first.id, second.id);
    Assert.areEqual("Synced", notifications.shown.map(t => t.title).join(","));
  }

  @TestMethod
  public refusesAKindTheModuleDidNotDeclareAsTheRuntimeDoes(): void {
    const notifications = new ShownNotificationsFixture(ShownNotificationsFixtureTests.NOTES);
    const sync = notifications.postNotification(ShownNotificationsFixtureTests.post("notes.sync", "Syncing"));

    const posted = Assert.throws(() => notifications.postNotification(ShownNotificationsFixtureTests.post("notes.backup", "Backing up")), NotContributedException);
    const updated = Assert.throws(() => sync.update(ShownNotificationsFixtureTests.post("notes.backup", "Backing up")), NotContributedException);

    Assert.areEqual(posted.message, updated.message);
    Assert.areEqual("Syncing", notifications.shown.map(t => t.title).join(","));
  }

  private static post(kind: string, title: string, key: string | null = null): NotificationPost {
    return new NotificationPost(QualifiedName.parse(kind), key, title, null, NotificationSeverity.Info, null, [], null);
  }
}
