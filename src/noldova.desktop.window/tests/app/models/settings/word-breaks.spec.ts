/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { TextMatch } from "../../../../src/app/models/settings/text-match";
import { WordBreaks } from "../../../../src/app/models/settings/word-breaks";

describe("WordBreaks", () => {
  const split = (text: string, query: string): readonly (readonly string[])[] => WordBreaks.split(TextMatch.split(text, query)).map(t => t.pieces);

  it("breaks an id after each dot and before each capital that follows a letter of another case", () => {
    expect(split("desktop.moveTabToNextGroup", String.empty)).toEqual([["desktop.", "move", "Tab", "To", "Next", "Group"]]);
    expect(split("notes.openURL", String.empty)).toEqual([["notes.", "open", "URL"]]);
    expect(split("Theme", String.empty)).toEqual([["Theme"]]);
  });

  it("breaks each part of a search at the id's own break points, so a match across a break keeps one part", () => {
    expect(split("desktop.splitTabUp", "bu")).toEqual([["desktop.", "split", "Ta"], ["b", "U"], ["p"]]);
    expect(split("desktop.splitTabUp", "desktop.")).toEqual([["desktop."], ["split", "Tab", "Up"]]);
    expect(WordBreaks.split(TextMatch.split("desktop.splitTabUp", "bu")).map(t => [t.text, t.isMatch, t.breaksBefore])).toEqual([["desktop.splitTa", false, false], ["bU", true, false], ["p", false, false]]);
  });

  it("breaks before a part that starts at a word boundary, after a dot or at a capital, but never before the first part", () => {
    const breaks = (text: string, query: string): readonly (readonly [string, boolean])[] => WordBreaks.split(TextMatch.split(text, query)).map(t => [t.text, t.breaksBefore]);

    expect(breaks("desktop.moveTabToNextGroup", "Group")).toEqual([["desktop.moveTabToNext", false], ["Group", true]]);
    expect(split("desktop.moveTabToNextGroup", "Group")).toEqual([["desktop.", "move", "Tab", "To", "Next"], ["Group"]]);
    expect(breaks("desktop.splitTabUp", "desktop.")).toEqual([["desktop.", false], ["splitTabUp", true]]);
    expect(breaks("Theme", "the")).toEqual([["The", false], ["me", false]]);
  });
});
