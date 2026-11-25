/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { EditAction } from "@noldova/desktop.protocol";
import { Component, signal, untracked } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { ISelectionSource } from "../../../src/app/interfaces/i-selection-source";
import { EditTargetService } from "../../../src/app/services/edit-target.service";
import { DomFixture } from "../../fixtures/dom.fixture";
import { EditTargetFixture } from "../../fixtures/edit-target.fixture";

@Component({
  selector: "nol-test-update-step",
  template: "{{ run() }}"
})
class UpdateStepComponent {
  public readonly step = signal<(() => void) | null>(null);

  public run(): string {
    this.step()?.();
    return "";
  }
}

describe("EditTargetService", () => {
  let page: EditTargetFixture;
  let overlay: HTMLButtonElement;
  let elsewhere: HTMLButtonElement;

  beforeEach(() => {
    page = EditTargetFixture.create();
    overlay = page.find(".row", HTMLButtonElement);
    elsewhere = page.find(".elsewhere", HTMLButtonElement);
  });

  afterEach(() => page.remove());

  function actions(edits: EditTargetService): readonly EditAction[] {
    return Object.values(EditAction).filter(t => edits.canRun(t));
  }

  it("keeps the field and its selection while focus is in a menu, and restores both", async () => {
    const edits = TestBed.inject(EditTargetService);
    const field = page.find(".field", HTMLInputElement);
    field.focus();
    field.setSelectionRange(0, 7, "backward");

    overlay.focus();
    const enabled = actions(edits);
    const restored = await edits.restoreAsync();

    expect(enabled).toEqual(Object.values(EditAction));
    expect(restored).toBe(true);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd, field.selectionDirection]).toEqual([0, 7, "backward"]);
  });

  it("allows only what a field can do: no copy or cut without a selection, and nothing that writes into a read-only field", () => {
    const edits = TestBed.inject(EditTargetService);
    const field = page.find(".field", HTMLInputElement);
    const locked = page.find(".locked", HTMLInputElement);

    field.focus();
    field.setSelectionRange(3, 3);
    overlay.focus();
    const collapsed = actions(edits);
    locked.focus();
    locked.setSelectionRange(0, 4);
    overlay.focus();
    const readOnly = actions(edits);

    expect(collapsed).toEqual([EditAction.Undo, EditAction.Redo, EditAction.Paste, EditAction.SelectAll]);
    expect(readOnly).toEqual([EditAction.Copy, EditAction.SelectAll]);
  });

  it("forgets the field when focus moves to something that is not editable outside the menus, or the field leaves the page", async () => {
    const edits = TestBed.inject(EditTargetService);
    const field = page.find(".field", HTMLInputElement);

    field.focus();
    elsewhere.focus();
    const afterElsewhere = [actions(edits), await edits.restoreAsync()];
    field.focus();
    overlay.focus();
    field.remove();

    expect(afterElsewhere).toEqual([[], false]);
    expect([actions(edits), await edits.restoreAsync()]).toEqual([[], false]);
  });

  it("restores a selection in editable rich text and in a text area, and treats a field without a selection range as selected", async () => {
    const edits = TestBed.inject(EditTargetService);
    const rich = page.find(".rich", HTMLElement);
    const notes = page.find(".notes", HTMLTextAreaElement);
    const count = page.find(".count", HTMLInputElement);
    rich.focus();
    const range = document.createRange();
    range.setStart(DomFixture.present(rich.firstChild), 0);
    range.setEnd(DomFixture.present(rich.firstChild), 4);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    overlay.focus();
    await edits.restoreAsync();
    const richSelection = document.getSelection()?.toString();
    notes.focus();
    notes.setSelectionRange(0, 4);
    overlay.focus();
    await edits.restoreAsync();
    const notesRestored = [document.activeElement === notes, notes.selectionStart, notes.selectionEnd];
    count.focus();
    overlay.focus();

    expect(richSelection).toBe("Rich");
    expect(notesRestored).toEqual([true, 0, 4]);
    expect(actions(edits)).toEqual(Object.values(EditAction));
  });

  it("treats rich text without a selection inside it as unselected, and ignores focus on an element that is not HTML", async () => {
    const edits = TestBed.inject(EditTargetService);
    const rich = page.find(".rich", HTMLElement);
    document.getSelection()?.removeAllRanges();

    rich.focus();
    document.getSelection()?.removeAllRanges();
    overlay.focus();
    const unselected = actions(edits);
    page.find(".drawing", SVGElement).focus();

    expect(unselected).toEqual([EditAction.Undo, EditAction.Redo, EditAction.Paste, EditAction.SelectAll]);
    expect(actions(edits)).toEqual(unselected);
    expect(await edits.restoreAsync()).toBe(true);
  });

  it("follows a part's own selection for Copy while focus is in its element, from before or after it registers, and the field there for the other edits", () => {
    const edits = TestBed.inject(EditTargetService);
    const terminal = page.find(".terminal", HTMLElement);
    const helper = page.find(".helper", HTMLTextAreaElement);
    let selected = true;
    const source: ISelectionSource = { hasSelection: () => selected, readSelection: () => "total 8" };

    helper.focus();
    edits.registerSource(terminal, source);
    overlay.focus();
    const whileSelected = [actions(edits), edits.readSelection()];
    selected = false;
    const unselected = [edits.canRun(EditAction.Copy), edits.readSelection()];
    terminal.focus();
    selected = true;
    const onElement = [actions(edits), edits.readSelection()];
    elsewhere.focus();

    expect(whileSelected).toEqual([Object.values(EditAction).filter(t => t !== EditAction.Cut), "total 8"]);
    expect(unselected).toEqual([false, null]);
    expect(onElement).toEqual([[EditAction.Copy], "total 8"]);
    expect([actions(edits), edits.readSelection()]).toEqual([[], null]);
  });

  it("follows the innermost source around the focus, whichever registered first", () => {
    const edits = TestBed.inject(EditTargetService);
    const panel = page.find(".panel", HTMLElement);
    const terminal = page.find(".terminal", HTMLElement);
    const helper = page.find(".helper", HTMLTextAreaElement);

    const removeInner = edits.registerSource(terminal, { hasSelection: () => true, readSelection: () => "inner" });
    const removeOuter = edits.registerSource(panel, { hasSelection: () => true, readSelection: () => "outer" });
    helper.focus();
    const innerFirst = edits.readSelection();
    removeInner();
    removeOuter();
    elsewhere.focus();
    edits.registerSource(panel, { hasSelection: () => true, readSelection: () => "outer" });
    edits.registerSource(terminal, { hasSelection: () => true, readSelection: () => "inner" });
    helper.focus();

    expect([innerFirst, edits.readSelection()]).toEqual(["inner", "inner"]);
  });

  it("names the innermost source holding an element, and none outside every source or once it unregisters", () => {
    const edits = TestBed.inject(EditTargetService);
    const panel = page.find(".panel", HTMLElement);
    const terminal = page.find(".terminal", HTMLElement);
    const helper = page.find(".helper", HTMLTextAreaElement);
    const removeInner = edits.registerSource(terminal, { hasSelection: () => false, readSelection: () => String.empty });
    edits.registerSource(panel, { hasSelection: () => false, readSelection: () => String.empty });

    const found = [edits.sourceOf(helper), edits.sourceOf(terminal), edits.sourceOf(elsewhere)];
    removeInner();

    expect(found).toEqual([terminal, terminal, null]);
    expect(edits.sourceOf(helper)).toBe(panel);
  });

  it("copies from a field inside a source while the source has nothing selected, and the source's selection once it has one", () => {
    const edits = TestBed.inject(EditTargetService);
    const helper = page.find(".helper", HTMLTextAreaElement);
    let selected = false;
    edits.registerSource(page.find(".terminal", HTMLElement), { hasSelection: () => selected, readSelection: () => "total 8" });
    helper.value = "ls -la";

    helper.focus();
    helper.setSelectionRange(0, 2);
    overlay.focus();
    const fromField = [edits.canRun(EditAction.Copy), edits.readSelection()];
    selected = true;

    expect(fromField).toEqual([true, null]);
    expect([edits.canRun(EditAction.Copy), edits.readSelection()]).toEqual([true, "total 8"]);
  });

  it("knows whether a field, editable text or an element inside a source has the focus, past a menu that takes it, until the focus leaves", () => {
    const edits = TestBed.inject(EditTargetService);
    const field = page.find(".field", HTMLInputElement);
    const terminal = page.find(".terminal", HTMLElement);

    field.focus();
    overlay.focus();
    const pastMenu = edits.isEditFocused();
    elsewhere.focus();
    const onButton = edits.isEditFocused();
    page.find(".rich", HTMLElement).focus();
    const onRich = edits.isEditFocused();
    field.focus();
    field.blur();
    const left = edits.isEditFocused();
    terminal.focus();
    const beforeSource = edits.isEditFocused();
    const remove = edits.registerSource(terminal, { hasSelection: () => false, readSelection: () => String.empty });
    const inSource = edits.isEditFocused();
    remove();

    expect([pastMenu, onButton, onRich, left, beforeSource, inSource]).toEqual([true, false, true, false, false, true]);
    expect(edits.isEditFocused()).toBe(false);
  });

  it("counts a field in a dialog over the page and a web view as edit focus, and a field that left the page without a focusout as none", () => {
    const edits = TestBed.inject(EditTargetService);
    const field = page.find(".field", HTMLInputElement);

    page.find(".dialog-field", HTMLInputElement).focus();
    const inDialog = edits.isEditFocused();
    elsewhere.focus();
    const onButton = edits.isEditFocused();
    page.find(".guest", HTMLElement).focus();
    const inWebView = edits.isEditFocused();
    field.focus();
    const onField = edits.isEditFocused();
    window.addEventListener("focusout", event => event.stopImmediatePropagation(), { capture: true, once: true });
    field.remove();

    expect([inDialog, onButton, inWebView, onField]).toEqual([true, false, true, true]);
    expect(edits.isEditFocused()).toBe(false);
  });

  it("knows whether the window's own page has the focus, as the window's focus and blur say", () => {
    const edits = TestBed.inject(EditTargetService);

    window.dispatchEvent(new FocusEvent("focus"));
    const focused = edits.hasFocus();
    window.dispatchEvent(new FocusEvent("blur"));

    expect([focused, edits.hasFocus()]).toEqual([true, false]);
  });

  it("stops following a source once it is removed, replaced or off the page, and a removal after a replacement keeps the new one", () => {
    const edits = TestBed.inject(EditTargetService);
    const terminal = page.find(".terminal", HTMLElement);
    const helper = page.find(".helper", HTMLTextAreaElement);
    const first = edits.registerSource(terminal, { hasSelection: () => true, readSelection: () => "first" });

    helper.focus();
    const followed = edits.readSelection();
    first();
    const removed = [edits.canRun(EditAction.Copy), edits.readSelection()];
    const second = edits.registerSource(terminal, { hasSelection: () => true, readSelection: () => "second" });
    first();
    const replaced = edits.readSelection();
    terminal.remove();
    const offPage = [edits.canRun(EditAction.Copy), edits.readSelection()];
    second();

    expect(followed).toBe("first");
    expect(removed).toEqual([false, null]);
    expect(replaced).toBe("second");
    expect(offPage).toEqual([false, null]);
  });

  function errorsDuring(step: () => void): unknown[] {
    const errors: unknown[] = [];
    const record = (event: ErrorEvent): void => {
      errors.push(event.error);
      event.preventDefault();
    };
    const fixture = TestBed.createComponent(UpdateStepComponent);
    fixture.detectChanges();
    window.addEventListener("error", record);
    try {
      fixture.componentInstance.step.set(step);
      fixture.detectChanges();
    }
    finally {
      window.removeEventListener("error", record);
      fixture.destroy();
    }
    return errors;
  }

  it("follows a focus change made inside a template update without writing a signal inside it", () => {
    const edits = TestBed.inject(EditTargetService);
    page.find(".field", HTMLInputElement).focus();

    const errors = errorsDuring(() => elsewhere.focus());

    expect(errors).toEqual([]);
    expect(document.activeElement).toBe(elsewhere);
    expect([edits.isEditFocused(), actions(edits)]).toEqual([false, []]);
  });

  it("follows the window's blur and focus fired inside a template update without writing a signal inside it", () => {
    const edits = TestBed.inject(EditTargetService);
    const seen: boolean[] = [];

    const errors = errorsDuring(() => {
      window.dispatchEvent(new Event("blur"));
      seen.push(untracked(edits.hasFocus));
      window.dispatchEvent(new Event("focus"));
      seen.push(untracked(edits.hasFocus));
    });

    expect(errors).toEqual([]);
    expect(seen).toEqual([false, true]);
  });

  it("stops following the focus and the window's focus once it is destroyed", () => {
    const edits = TestBed.inject(EditTargetService);
    page.find(".field", HTMLInputElement).focus();
    const hasFocus = edits.hasFocus();

    TestBed.resetTestingModule();
    elsewhere.focus();
    window.dispatchEvent(new Event(hasFocus ? "blur" : "focus"));

    expect([edits.isEditFocused(), edits.hasFocus()]).toEqual([true, hasFocus]);
  });
});
