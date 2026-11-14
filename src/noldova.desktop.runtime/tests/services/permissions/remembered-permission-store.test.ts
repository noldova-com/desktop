/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionDecision, type RememberedPermission, RememberedPermissionStore } from "@noldova/desktop.runtime";

import { SettingsFixture } from "../../fixtures/settings.fixture.js";

@TestClass
export class RememberedPermissionStoreTests {
  @TestMethod
  public async findsAnAnswerOnlyByTheSameModuleActionSubjectAndScope(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const store = RememberedPermissionStoreTests.create(settings);
    store.remember("notes", "notes.deleteItem", "item-1", "conversation-1", PermissionDecision.AllowedAlways);
    store.remember("notes", "notes.deleteItem", null, "conversation-1", PermissionDecision.DeniedAlways);

    const found = [
      store.find("notes", "notes.deleteItem", "item-1", "conversation-1"),
      store.find("notes", "notes.deleteItem", null, "conversation-1"),
      store.find("tasks", "notes.deleteItem", "item-1", "conversation-1"),
      store.find("notes", "notes.archiveItem", "item-1", "conversation-1"),
      store.find("notes", "notes.deleteItem", "item-2", "conversation-1"),
      store.find("notes", "notes.deleteItem", "item-1", "conversation-2"),
      store.find("notes", "notes.deleteItem", String.empty, "conversation-1")
    ];

    Assert.areEqual(`${PermissionDecision.AllowedAlways},${PermissionDecision.DeniedAlways},null,null,null,null,null`, found.map(t => String(t)).join(","));
  }

  @TestMethod
  public replacesTheAnswerForTheSameFourAndListsAnswersInTheOrderTheyWereKept(): Promise<void> {
    return RememberedPermissionStoreTests.withStoreAsync((store, settings) => {
      store.remember("notes", "notes.deleteItem", null, "conversation-1", PermissionDecision.AllowedAlways);
      store.remember("notes", "notes.archiveItem", "item-1", "conversation-1", PermissionDecision.AllowedAlways);
      store.remember("notes", "notes.deleteItem", null, "conversation-1", PermissionDecision.DeniedAlways);

      const listed = store.list();

      Assert.areEqual(
        "answer-2|notes|notes.archiveItem|item-1|conversation-1|AllowedAlways|2026-10-21T12:00:02.000Z," +
          "answer-3|notes|notes.deleteItem|null|conversation-1|DeniedAlways|2026-10-21T12:00:03.000Z",
        listed.map(t => RememberedPermissionStoreTests.describe(t)).join(","));
      Assert.areEqual(2, settings.database.readAll("SELECT id FROM remembered_permissions").length);
    });
  }

  @TestMethod
  public forgetsAnAnswerByItsIdAndGivesItBack(): Promise<void> {
    return RememberedPermissionStoreTests.withStoreAsync(store => {
      store.remember("notes", "notes.deleteItem", "item-1", "conversation-1", PermissionDecision.AllowedAlways);

      const forgotten = store.forget("answer-1");
      const again = store.forget("answer-1");

      Assert.isNotNull(forgotten);
      Assert.areEqual("answer-1|notes|notes.deleteItem|item-1|conversation-1|AllowedAlways|2026-10-21T12:00:01.000Z", RememberedPermissionStoreTests.describe(forgotten));
      Assert.isNull(again);
      Assert.isNull(store.find("notes", "notes.deleteItem", "item-1", "conversation-1"));
      Assert.areEqual(0, store.list().length);
    });
  }

  @TestMethod
  public letsNoAnswerItCannotReadDecideAndStillForgetsIt(): Promise<void> {
    return RememberedPermissionStoreTests.withStoreAsync((store, settings) => {
      settings.database.run(
        "INSERT INTO remembered_permissions (id, module, action, subject, scope, decision, remembered) VALUES ('odd', 'notes', 'notes.deleteItem', NULL, 'conversation-1', 'AllowedOnce', 1)");

      const found = store.find("notes", "notes.deleteItem", null, "conversation-1");
      const listed = store.list();
      const forgotten = store.forget("odd");

      Assert.isNull(found);
      Assert.areEqual(0, listed.length);
      Assert.isNull(forgotten);
      Assert.areEqual(0, settings.database.readAll("SELECT id FROM remembered_permissions").length);
    });
  }

  private static async withStoreAsync(test: (store: RememberedPermissionStore, settings: SettingsFixture) => void): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    test(RememberedPermissionStoreTests.create(settings), settings);
  }

  private static create(settings: SettingsFixture): RememberedPermissionStore {
    let count = 0;
    let seconds = 0;
    return new RememberedPermissionStore(settings.database, () => `answer-${++count}`, () => new Date(Date.UTC(2026, 9, 21, 12, 0, ++seconds)));
  }

  private static describe(answer: RememberedPermission): string {
    return `${answer.id}|${answer.module}|${answer.action}|${String(answer.subject)}|${answer.scope}|${answer.decision}|${answer.remembered.toISOString()}`;
  }
}
