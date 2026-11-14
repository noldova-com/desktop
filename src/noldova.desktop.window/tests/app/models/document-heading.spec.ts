/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { DocumentHeading } from "../../../src/app/models/document-heading";

describe("DocumentHeading", () => {
  it("joins its breadcrumb and title, names the window after the title, and keeps its own copy of the breadcrumb", () => {
    const breadcrumb = ["Notes", "Drafts"];
    const heading = new DocumentHeading("Plan", breadcrumb);
    breadcrumb.push("Archive");

    expect([heading.text, heading.windowTitle, heading.breadcrumb]).toEqual(["Notes / Drafts / Plan", "Plan — Noldova Desktop Sample", ["Notes", "Drafts"]]);
    expect(new DocumentHeading("Plan").text).toBe("Plan");
  });

  it("changes its title, its breadcrumb or both, and keeps what is left out", () => {
    const heading = new DocumentHeading("Plan", ["Notes"]);

    expect([heading.with("Todo", null), heading.with(null, []), heading.with("Todo", ["Tasks"]), heading.with(null, null)].map(t => t.text))
      .toEqual(["Notes / Todo", "Plan", "Tasks / Todo", "Notes / Plan"]);
  });

  it("keeps the glyph with the breadcrumb it came with, dropping it with a new breadcrumb that has none", () => {
    const heading = new DocumentHeading("Plan", ["Notes"], "folder");

    expect([heading.with("Todo", null), heading.with(null, ["Tasks"]), heading.with(null, ["Tasks"], "task"), new DocumentHeading("Plan")].map(t => [t.text, t.icon]))
      .toEqual([["Notes / Todo", "folder"], ["Tasks / Plan", null], ["Tasks / Plan", "task"], ["Plan", null]]);
  });

  it("refuses a blank title, a blank breadcrumb segment and a blank glyph", () => {
    expect(() => new DocumentHeading(" ")).toThrowError(ArgumentException);
    expect(() => new DocumentHeading("Plan", ["Notes", String.empty])).toThrowError("A breadcrumb is a list of segments that are not blank.");
    expect(() => new DocumentHeading("Plan", ["  "])).toThrowError(ArgumentException);
    expect(() => new DocumentHeading("Plan", [], " ")).toThrowError(ArgumentException);
    expect(() => DocumentHeading.requireIcon(String.empty)).toThrowError(ArgumentException);
    expect(() => DocumentHeading.requireUpdateIcon("folder", null)).toThrowError("A breadcrumb's glyph comes with the breadcrumb it goes before.");
    expect([DocumentHeading.requireUpdateIcon(null, null), DocumentHeading.requireUpdateIcon("folder", []), DocumentHeading.requireUpdateIcon(null, ["Notes"])]).toEqual([null, "folder", null]);
  });
});
