/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Dialog, type DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DialogCoverService } from "../../../src/app/services/dialog-cover.service";
import { StartupService } from "../../../src/app/services/startup.service";
import { DomFixture } from "../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

@Component({
  selector: "nol-test-dialog",
  template: "<button type=\"button\" class=\"nol-test-first\">First</button><button type=\"button\" class=\"nol-test-second\">Second</button>"
})
class TestDialogComponent {
}

@Component({
  selector: "nol-test-note-dialog",
  template: "<p>A note</p>"
})
class TestNoteDialogComponent {
}

describe("DialogCoverService", () => {
  let bridge: PreloadBridgeFixture;
  let dialog: Dialog;
  let parent: HTMLElement;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    dialog = TestBed.inject(Dialog);
    parent = document.createElement("div");
    document.body.append(parent);
  });

  afterEach(() => {
    dialog.closeAll();
    parent.remove();
    PreloadBridgeFixture.remove();
  });

  async function startedAsync(): Promise<DialogCoverService> {
    const service = TestBed.inject(DialogCoverService);
    const startup = TestBed.inject(StartupService);
    await vi.waitFor(() => expect(startup.hasStarted()).toBe(true));
    return service;
  }

  function reconnect(): void {
    bridge.publishStartup({ kind: "Connecting", details: [] });
    TestBed.tick();
  }

  function ready(): void {
    bridge.publishStartup({ kind: "Ready", details: [] });
    TestBed.tick();
  }

  function isInert<T>(reference: DialogRef<unknown, T>): boolean {
    return reference.overlayRef.hostElement.hasAttribute("inert");
  }

  function focusOutside(): void {
    const outside = document.createElement("button");
    parent.append(outside);
    outside.focus();
  }

  function container<T>(reference: DialogRef<unknown, T>): HTMLElement {
    return DomFixture.one(reference.overlayRef.overlayElement, ".cdk-dialog-container");
  }

  it("follows the open dialogs, those open before it as well as those opened since, until each closes", async () => {
    const before = dialog.open(TestDialogComponent);
    const service = await startedAsync();

    const after = dialog.open(TestNoteDialogComponent);
    const both = [...service.openDialogs()];
    before.close();
    const one = [...service.openDialogs()];
    after.close();

    expect([both, one, [...service.openDialogs()]]).toEqual([[before, after], [after], []]);
  });

  it("covers only while the runtime starts again and a dialog is open", async () => {
    const service = await startedAsync();
    const states = [service.isCovering()];

    reconnect();
    states.push(service.isCovering());
    const reference = dialog.open(TestDialogComponent);
    states.push(service.isCovering());
    reference.close();
    states.push(service.isCovering());

    expect(states).toEqual([false, false, true, false]);
  });

  it("makes the open dialogs inert and keeps them open while covering, and gives them back as they were once ready", async () => {
    await startedAsync();
    const closable = dialog.open(TestDialogComponent);
    const kept = dialog.open(TestNoteDialogComponent, { disableClose: true });

    reconnect();
    const covered = [isInert(closable), isInert(kept), closable.disableClose, kept.disableClose];
    ready();

    expect(covered).toEqual([true, true, true, true]);
    expect([isInert(closable), isInert(kept), closable.disableClose, kept.disableClose]).toEqual([false, false, false, true]);
  });

  it("covers a dialog that opens while covering at once", async () => {
    await startedAsync();
    dialog.open(TestNoteDialogComponent);
    reconnect();

    const opened = dialog.open(TestDialogComponent);

    expect([isInert(opened), opened.disableClose]).toEqual([true, true]);
  });

  it("gives focus back to what had it in a covered dialog once ready", async () => {
    await startedAsync();
    const reference = dialog.open(TestDialogComponent);
    TestBed.tick();
    const second = DomFixture.one(reference.overlayRef.overlayElement, ".nol-test-second");
    second.focus();

    reconnect();
    second.blur();
    ready();

    expect(document.activeElement).toBe(second);
  });

  it("moves focus to the first field of the topmost covered dialog once ready when focus was outside the dialogs or its element went away", async () => {
    await startedAsync();
    const outside = document.createElement("button");
    parent.append(outside);
    dialog.open(TestNoteDialogComponent);
    const topmost = dialog.open(TestDialogComponent);
    TestBed.tick();
    outside.focus();
    reconnect();
    ready();
    const fromOutside = document.activeElement;
    const second = DomFixture.one(topmost.overlayRef.overlayElement, ".nol-test-second");
    second.focus();
    reconnect();
    second.remove();
    ready();

    expect([fromOutside, document.activeElement]).toEqual([
      DomFixture.one(topmost.overlayRef.overlayElement, ".nol-test-first"),
      DomFixture.one(topmost.overlayRef.overlayElement, ".nol-test-first")
    ]);
  });

  it("moves focus to the topmost covered dialog itself once ready when it has nothing to tab to", async () => {
    await startedAsync();
    dialog.open(TestDialogComponent);
    const note = dialog.open(TestNoteDialogComponent);
    TestBed.tick();
    focusOutside();
    reconnect();
    ready();

    expect(document.activeElement).toBe(container(note));
  });

  it("moves focus to a covered dialog without a container to its overlay pane once ready", async () => {
    await startedAsync();
    const note = dialog.open(TestNoteDialogComponent);
    TestBed.tick();
    const pane = note.overlayRef.overlayElement;
    pane.replaceChildren();
    pane.tabIndex = -1;
    focusOutside();
    reconnect();
    ready();

    expect(document.activeElement).toBe(pane);
  });

  it("moves focus nowhere once ready when no covered dialog is still open", async () => {
    await startedAsync();
    const outside = document.createElement("button");
    parent.append(outside);
    const reference = dialog.open(TestNoteDialogComponent);
    TestBed.tick();
    reconnect();
    outside.focus();
    reference.close();
    TestBed.tick();

    expect(document.activeElement).toBe(outside);
  });

  it("keeps the attached cover last among its siblings when attached and whenever it covers a dialog, until detached", async () => {
    const service = await startedAsync();
    const cover = document.createElement("div");
    parent.append(cover, document.createElement("span"));

    service.attach(cover);
    const attached = parent.lastElementChild === cover;
    parent.append(document.createElement("span"));
    reconnect();
    dialog.open(TestDialogComponent);
    const covering = parent.lastElementChild === cover;
    ready();
    service.detach();
    parent.append(document.createElement("span"));
    reconnect();
    dialog.open(TestNoteDialogComponent);

    expect([attached, covering, parent.lastElementChild === cover]).toEqual([true, true, false]);
  });

  it("raises nothing when attached to a cover outside the page", async () => {
    const service = await startedAsync();
    const cover = document.createElement("div");

    service.attach(cover);

    expect(cover.parentElement).toBeNull();
  });
});
