/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";

import { HighlightedTextComponent } from "../../../../src/app/components/highlighted-text/highlighted-text.component";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("HighlightedTextComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  it("marks each match of the query in the highlight color with an underline, and shows plain text without one", () => {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    const fixture = TestBed.createComponent(HighlightedTextComponent);
    fixture.componentRef.setInput("text", "Code text size");
    fixture.componentRef.setInput("query", "TEXT");
    fixture.detectChanges();
    const marks = [...DomFixture.host(fixture).querySelectorAll("mark")];
    const style = getComputedStyle(DomFixture.present(marks[0]));
    const look = [style.color, style.textDecorationLine];
    fixture.componentRef.setInput("query", String.empty);
    fixture.detectChanges();

    expect(marks.map(t => t.textContent)).toEqual(["text"]);
    expect(look).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "list-highlight"), "underline"]);
    expect([DomFixture.host(fixture).textContent, DomFixture.host(fixture).querySelectorAll("mark").length]).toEqual(["Code text size", 0]);
  });

  it("gives an id break opportunities at its word boundaries without adding characters, inside a match too, and only when asked", () => {
    const fixture = TestBed.createComponent(HighlightedTextComponent);
    const element = DomFixture.host(fixture);
    fixture.componentRef.setInput("text", "desktop.splitTabUp");
    fixture.componentRef.setInput("query", "bu");
    fixture.detectChanges();
    const plain = [element.querySelectorAll("wbr").length, element.textContent];
    fixture.componentRef.setInput("breaksWords", true);
    fixture.detectChanges();
    document.getSelection()?.selectAllChildren(element);
    const copied = document.getSelection()?.toString();
    document.getSelection()?.removeAllRanges();

    expect(plain).toEqual([0, "desktop.splitTabUp"]);
    expect([element.querySelectorAll("wbr").length, element.textContent, copied]).toEqual([3, "desktop.splitTabUp", "desktop.splitTabUp"]);
    expect([...element.querySelectorAll("mark")].map(t => [t.textContent, t.querySelectorAll("wbr").length])).toEqual([["bU", 1]]);
  });

  it("puts a break opportunity just before a match that starts at a word boundary", () => {
    const fixture = TestBed.createComponent(HighlightedTextComponent);
    const element = DomFixture.host(fixture);
    fixture.componentRef.setInput("text", "desktop.moveTabToNextGroup");
    fixture.componentRef.setInput("query", "Group");
    fixture.componentRef.setInput("breaksWords", true);
    fixture.detectChanges();
    const mark = DomFixture.one(element, "mark");

    expect([mark.textContent, mark.querySelectorAll("wbr").length, mark.previousElementSibling?.tagName, element.querySelectorAll("wbr").length, element.textContent])
      .toEqual(["Group", 0, "WBR", 5, "desktop.moveTabToNextGroup"]);
  });
});
