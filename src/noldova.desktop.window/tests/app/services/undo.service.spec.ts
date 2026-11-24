/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import { UndoProviderTakenException } from "../../../src/app/exceptions/undo-provider-taken.exception";
import type { IUndoProvider } from "../../../src/app/interfaces/i-undo-provider";
import { UndoService } from "../../../src/app/services/undo.service";
import { EditTargetFixture } from "../../fixtures/edit-target.fixture";

describe("UndoService", () => {
  let page: EditTargetFixture;
  let elsewhere: HTMLButtonElement;
  let undone: number;
  let undoable: boolean;
  let provider: IUndoProvider;

  beforeEach(() => {
    page = EditTargetFixture.create();
    elsewhere = page.find(".elsewhere", HTMLButtonElement);
    undone = 0;
    undoable = true;
    provider = {
      canUndo: () => undoable,
      undoAsync: () => {
        undone++;
        return Promise.resolve();
      }
    };
    window.dispatchEvent(new FocusEvent("focus"));
  });

  afterEach(() => page.remove());

  it("takes Undo while the window has the focus and nothing editable does, and runs the provider's undo", async () => {
    const undo = TestBed.inject(UndoService);
    elsewhere.focus();
    const before = undo.takesUndo();

    undo.provide(provider);
    const taken = [undo.takesUndo(), undo.canUndo()];
    await undo.undoAsync();

    expect(before).toBe(false);
    expect(taken).toEqual([true, true]);
    expect(undone).toBe(1);
  });

  it("leaves Undo native while a field has the focus or the window doesn't, and runs nothing then", async () => {
    const undo = TestBed.inject(UndoService);
    undo.provide(provider);

    page.find(".field", HTMLInputElement).focus();
    const onField = [undo.takesUndo(), undo.canUndo()];
    await undo.undoAsync();
    elsewhere.focus();
    window.dispatchEvent(new FocusEvent("blur"));
    const blurred = [undo.takesUndo(), undo.canUndo()];
    await undo.undoAsync();

    expect(onField).toEqual([false, false]);
    expect(blurred).toEqual([false, false]);
    expect(undone).toBe(0);
  });

  it("greys Undo and runs nothing while the provider has nothing to undo", async () => {
    const undo = TestBed.inject(UndoService);
    elsewhere.focus();
    undo.provide(provider);
    undoable = false;

    const enabled = undo.canUndo();
    await undo.undoAsync();

    expect([undo.takesUndo(), enabled, undone]).toEqual([true, false, 0]);
  });

  it("refuses a second provider, and takes a new one once the first is withdrawn, which an old disposer leaves in place", () => {
    const undo = TestBed.inject(UndoService);
    elsewhere.focus();
    const withdraw = undo.provide(provider);
    const second: IUndoProvider = { canUndo: () => true, undoAsync: () => Promise.resolve() };

    expect(() => undo.provide(second)).toThrow(UndoProviderTakenException);
    withdraw();
    const afterWithdraw = undo.takesUndo();
    undo.provide(second);
    withdraw();

    expect(afterWithdraw).toBe(false);
    expect(undo.takesUndo()).toBe(true);
  });
});
