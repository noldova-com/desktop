/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocumentHeading } from "../../../src/app/models/document-heading";
import { PendingDocument } from "../../../src/app/models/pending-document";

describe("PendingDocument", () => {
  it("is kept out of preview only when the same document is kept, and stays as it is for another", () => {
    const pending = new PendingDocument("notes", "notes.note", "plan", new DocumentHeading("Plan"), true, "todo", false, true);

    const kept = pending.kept("notes", "notes.note", "plan");

    expect([kept.moduleId, kept.name, kept.instance, kept.heading.text, kept.isPreview, kept.after, kept.activates, kept.isEarly]).toEqual(["notes", "notes.note", "plan", "Plan", false, "todo", false, true]);
    expect(pending.isPreview).toBe(true);
    expect([pending.kept("notes", "notes.note", "todo"), pending.kept("notes", "notes.other", "plan"), pending.kept("tasks", "notes.note", "plan")])
      .toEqual([pending, pending, pending]);
  });

  it("takes a new title and breadcrumb only for the same document, keeping what is left out", () => {
    const pending = new PendingDocument("notes", "notes.note", "plan", new DocumentHeading("Plan", ["Notes"]), true, null, false, true);

    const renamed = pending.updated("notes", "notes.note", "plan", "Launch plan", null);
    const moved = renamed.updated("notes", "notes.note", "plan", null, ["Notes", "Archive"], "folder");
    const retitled = moved.updated("notes", "notes.note", "plan", "Plan", null);

    expect([renamed.heading.text, moved.heading.text, moved.isPreview, moved.after, moved.activates, moved.isEarly]).toEqual(["Notes / Launch plan", "Notes / Archive / Launch plan", true, null, false, true]);
    expect([renamed.heading.icon, moved.heading.icon, retitled.heading.icon]).toEqual([null, "folder", "folder"]);
    expect([pending.updated("notes", "notes.note", "todo", "Todo", null), pending.updated("tasks", "notes.note", "plan", "Todo", null)]).toEqual([pending, pending]);
  });
});
