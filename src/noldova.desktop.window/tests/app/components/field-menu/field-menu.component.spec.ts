/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { FieldMenuComponent } from "../../../../src/app/components/field-menu/field-menu.component";
import { EditTargetService } from "../../../../src/app/services/edit-target.service";
import { SpellingService } from "../../../../src/app/services/spelling.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";

@Component({
  imports: [FieldMenuComponent],
  template: `
    <input class="field" type="text" value="Meetng notes" style="position: fixed; top: 100px; left: 100px; width: 200px;">
    <input class="locked" type="text" value="Read only" readonly style="position: fixed; top: 150px; left: 100px; width: 200px;">
    <textarea class="notes" style="position: fixed; top: 200px; left: 100px; width: 200px; height: 60px;">Week 3</textarea>
    <div class="rich" contenteditable="true" style="position: fixed; top: 300px; left: 100px; width: 200px;"><b class="bold">Rich</b> text</div>
    <div class="plain" style="position: fixed; top: 350px; left: 100px;">Plain text</div>
    <div class="terminal" style="position: fixed; top: 40px; left: 100px; width: 200px; height: 50px;">
      <div class="screen" style="height: 50px;">$ ls -la</div>
      <textarea class="helper" style="position: absolute; top: 0; left: 0; width: 1px; height: 1px; opacity: 0;"></textarea>
    </div>
    <input class="own" type="text" value="Own menu" (contextmenu)="$event.preventDefault()" (keydown)="$event.preventDefault()">
    <div class="cdk-overlay-container"><input class="overlaid" type="text" value="Search"></div>
    <nol-field-menu />
  `
})
class HostComponent {
}

describe("FieldMenuComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let bridge: PreloadBridgeFixture;

  async function startAsync(platform: string = "win32"): Promise<void> {
    bridge = PreloadBridgeFixture.install(platform);
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: null });
    TestBed.inject(SpellingService);
    fixture = TestBed.createComponent(HostComponent);
    await settledAsync();
  }

  afterEach(() => {
    fixture.destroy();
    PreloadBridgeFixture.remove();
  });

  function find(selector: string): HTMLElement {
    return DomFixture.one(DomFixture.host(fixture), selector);
  }

  function menu(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container nol-menu[data-place=\"desktop.field\"]");
  }

  function row(label: string): HTMLElement | undefined {
    return [...menu()?.querySelectorAll<HTMLElement>(".nol-place-menu-item") ?? []].find(t => t.querySelector(".nol-menu-item-label")?.textContent === label);
  }

  function rows(): string[] {
    return [...menu()?.querySelectorAll<HTMLElement>(".nol-place-menu-item") ?? []]
      .map(t => `${t.dataset["command"] === "desktop.replaceMisspelling" ? t.querySelector(".nol-menu-item-label")?.textContent : t.dataset["command"]}`
        + `${t.getAttribute("aria-disabled") === "true" ? " (disabled)" : String.empty}`);
  }

  async function settledAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function rightClickAsync(element: HTMLElement, x: number, y: number): Promise<boolean> {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 });
    element.dispatchEvent(event);
    const isPrevented = event.defaultPrevented;
    await settledAsync();
    return isPrevented;
  }

  async function keyAsync(element: HTMLElement, init: KeyboardEventInit): Promise<boolean> {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(event);
    const isPrevented = event.defaultPrevented;
    await settledAsync();
    return isPrevented;
  }

  async function answerAsync(x: number, y: number, isKeyboard: boolean, word: string = String.empty, suggestions: string[] = []): Promise<void> {
    bridge.publishFieldMenu({ x, y, isKeyboard, word, suggestions });
    await settledAsync();
  }

  async function closeAsync(): Promise<void> {
    await userEvent.keyboard("{Escape}");
    await settledAsync();
  }

  it("leaves the click to the main process and opens at the pointer with its suggestions when the main process's message arrives", async () => {
    await startAsync();
    const field = DomFixture.oneOf(DomFixture.host(fixture), ".field", HTMLInputElement);
    field.focus();
    field.setSelectionRange(0, 6);
    const isPrevented = await rightClickAsync(field, 150, 110);
    const isOpenBeforeAnswer = !Object.isNull(menu());
    await answerAsync(150, 110, false, "Meetng", ["Meeting", "Meting"]);
    const box = menu()?.getBoundingClientRect();
    const misspelled = rows();
    await userEvent.click(DomFixture.present(row("Meeting")));
    await settledAsync();
    await vi.waitFor(() => expect(bridge.replacements).toEqual(["Meeting"]));
    const focusAfterReplace = document.activeElement;
    field.setSelectionRange(3, 3);
    await rightClickAsync(field, 150, 110);
    await answerAsync(150.5, 109.5, false, "Meetng", []);
    const unknown = rows();
    await closeAsync();
    const locked = DomFixture.oneOf(DomFixture.host(fixture), ".locked", HTMLInputElement);
    locked.focus();
    locked.setSelectionRange(0, 4);
    await rightClickAsync(locked, 150, 160);
    await answerAsync(150, 160, false);
    const readOnly = rows();

    expect([isPrevented, isOpenBeforeAnswer]).toEqual([false, false]);
    expect([box?.left, box?.top]).toEqual([150, 110]);
    expect(misspelled).toEqual(["Meeting", "Meting", "desktop.addToDictionary", "desktop.cut", "desktop.copy", "desktop.paste", "desktop.selectAll"]);
    expect(focusAfterReplace).toBe(field);
    expect(unknown).toEqual(["No suggestions (disabled)", "desktop.addToDictionary", "desktop.cut (disabled)", "desktop.copy (disabled)", "desktop.paste", "desktop.selectAll"]);
    expect(readOnly).toEqual(["desktop.cut (disabled)", "desktop.copy", "desktop.paste (disabled)", "desktop.selectAll"]);
  });

  it("opens only on the main process's message for this click, with its suggestions, and drops a message for another click, a late one or a removed field", async () => {
    await startAsync();
    const field = DomFixture.oneOf(DomFixture.host(fixture), ".field", HTMLInputElement);
    field.focus();
    await rightClickAsync(field, 150, 110);
    await answerAsync(152, 110, false, "Meetng", ["Meeting"]);
    await answerAsync(150, 112, false, "Meetng", ["Meeting"]);
    await answerAsync(150, 110, true, "Meetng", ["Meeting"]);
    const isOpenAfterOthers = !Object.isNull(menu());
    await answerAsync(150, 110, false, "Meetng", ["Meeting"]);
    const first = rows()[0];
    await closeAsync();
    await answerAsync(150, 110, false, "Meetng", ["Meeting"]);
    const isOpenAfterLate = !Object.isNull(menu());
    await rightClickAsync(field, 150, 110);
    field.remove();
    await answerAsync(150, 110, false);
    const isOpenAfterRemoval = !Object.isNull(menu());

    expect([isOpenAfterOthers, first]).toEqual([false, "Meeting"]);
    expect([isOpenAfterLate, isOpenAfterRemoval]).toEqual([false, false]);
  });

  it("opens from the menu key and Shift+F10 below the field's start, ignoring the click those keys make, and a row edits the field", async () => {
    await startAsync();
    const notes = DomFixture.oneOf(DomFixture.host(fixture), ".notes", HTMLTextAreaElement);
    notes.focus();
    notes.setSelectionRange(0, 4);
    const other = await keyAsync(notes, { key: "F10" });
    await answerAsync(0, 0, true);
    const isOpenAfterOther = !Object.isNull(menu());
    const shifted = await keyAsync(notes, { key: "F10", shiftKey: true });
    await rightClickAsync(notes, 0, 0);
    await answerAsync(0, 0, false);
    const isOpenAfterClick = !Object.isNull(menu());
    await answerAsync(0, 0, true);
    const box = menu()?.getBoundingClientRect();
    const bounds = notes.getBoundingClientRect();
    await closeAsync();
    const menuKey = await keyAsync(notes, { key: "ContextMenu" });
    await answerAsync(0, 0, true);
    await userEvent.keyboard("{Enter}");
    await settledAsync();
    await vi.waitFor(() => expect(bridge.edits).toEqual(["Cut"]));

    expect([other, isOpenAfterOther]).toEqual([false, false]);
    expect([shifted, menuKey, isOpenAfterClick]).toEqual([false, false, false]);
    expect([box?.left, box?.top]).toEqual([bounds.left, bounds.bottom]);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(notes);
  });

  it("opens from the keyboard at once on macOS, where those keys bring no message", async () => {
    await startAsync("darwin");
    const notes = DomFixture.oneOf(DomFixture.host(fixture), ".notes", HTMLTextAreaElement);
    notes.focus();

    await keyAsync(notes, { key: "F10", shiftKey: true });

    expect(rows()).toEqual(["desktop.cut (disabled)", "desktop.copy (disabled)", "desktop.paste", "desktop.selectAll"]);
  });

  it("opens inside rich text, but not on plain text, on a field whose own menu took the event, or in an overlay", async () => {
    await startAsync();
    find(".rich").focus();
    await rightClickAsync(find(".bold"), 120, 310);
    await answerAsync(120, 310, false);
    const isOpenInRichText = !Object.isNull(menu());
    await closeAsync();
    const focusAfterRichText = document.activeElement;
    await rightClickAsync(find(".plain"), 120, 360);
    await answerAsync(120, 360, false);
    const own = DomFixture.oneOf(DomFixture.host(fixture), ".own", HTMLInputElement);
    own.focus();
    await rightClickAsync(own, 10, 10);
    await answerAsync(10, 10, false);
    await keyAsync(own, { key: "ContextMenu" });
    await answerAsync(10, 10, true);
    const overlaid = DomFixture.oneOf(DomFixture.host(fixture), ".overlaid", HTMLInputElement);
    overlaid.focus();
    await rightClickAsync(overlaid, 10, 10);
    await answerAsync(10, 10, false);

    expect(isOpenInRichText).toBe(true);
    expect(focusAfterRichText).toBe(find(".rich"));
    expect(menu()).toBeNull();
  });

  it("opens at the pointer over a registered selection source whose field has the focus, copying the source's selection, pasting into that field and giving it the focus back, and not while the focus is outside the source or from a key on the source", async () => {
    await startAsync();
    let selected = "total 8";
    TestBed.inject(EditTargetService).registerSource(find(".terminal"), { hasSelection: () => selected !== String.empty, readSelection: () => selected });
    const helper = DomFixture.oneOf(DomFixture.host(fixture), ".helper", HTMLTextAreaElement);
    const screen = find(".screen");
    helper.focus();
    const isPrevented = await rightClickAsync(screen, 150, 60);
    const isOpenBeforeAnswer = !Object.isNull(menu());
    await answerAsync(150, 60, false);
    const box = menu()?.getBoundingClientRect();
    const withSelection = rows();
    await userEvent.click(DomFixture.present(row("Copy")));
    await settledAsync();
    await vi.waitFor(() => expect(bridge.copied).toEqual(["total 8"]));
    const focusAfterCopy = document.activeElement;
    selected = String.empty;
    await rightClickAsync(screen, 160, 70);
    await answerAsync(160, 70, false);
    const plainBox = menu()?.getBoundingClientRect();
    const withoutSelection = rows();
    await userEvent.click(DomFixture.present(row("Paste")));
    await settledAsync();
    await vi.waitFor(() => expect(bridge.edits).toEqual(["Paste"]));
    const focusAfterPaste = document.activeElement;
    DomFixture.oneOf(DomFixture.host(fixture), ".field", HTMLInputElement).focus();
    await rightClickAsync(screen, 150, 60);
    await answerAsync(150, 60, false);
    const isOpenFromField = !Object.isNull(menu());
    helper.focus();
    await keyAsync(screen, { key: "ContextMenu" });
    await answerAsync(0, 0, true);

    expect([isPrevented, isOpenBeforeAnswer, isOpenFromField]).toEqual([false, false, false]);
    expect([box?.left, box?.top, plainBox?.left, plainBox?.top]).toEqual([150, 60, 160, 70]);
    expect(withSelection).toEqual(["desktop.cut (disabled)", "desktop.copy", "desktop.paste", "desktop.selectAll"]);
    expect(withoutSelection).toEqual(["desktop.cut (disabled)", "desktop.copy (disabled)", "desktop.paste", "desktop.selectAll"]);
    expect([focusAfterCopy, focusAfterPaste]).toEqual([helper, helper]);
    expect(menu()).toBeNull();
  });

  it("stops listening for the main process's messages when it goes", async () => {
    await startAsync();
    const field = DomFixture.oneOf(DomFixture.host(fixture), ".field", HTMLInputElement);
    field.focus();
    await rightClickAsync(field, 150, 110);
    const listening = bridge.fieldMenuListenerCount;

    fixture.destroy();

    expect([listening, bridge.fieldMenuListenerCount]).toEqual([1, 0]);
    expect(menu()).toBeNull();
  });
});
