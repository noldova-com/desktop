/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Dialog } from "@angular/cdk/dialog";
import { OverlayContainer } from "@angular/cdk/overlay";
import { Component, ErrorHandler, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AppearanceService, DefaultTheme, DialogService, ThemeMode, Typography } from "@noldova/ui.components.angular";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { MenuCheck } from "../../../../src/app/enums/menu-check";
import { CommandRow } from "../../../../src/app/models/command-row";
import { MenuSection } from "../../../../src/app/models/menu-section";
import { Toolbar } from "../../../../src/app/models/toolbar";
import { ClosingService } from "../../../../src/app/services/closing.service";
import { LayoutStoreService } from "../../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { ToolbarService } from "../../../../src/app/services/toolbar.service";
import { WindowErrorHandler } from "../../../../src/app/services/window-error-handler";
import { WindowComponent } from "../../../../src/app/components/window/window.component";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { MediaFixture } from "../../../fixtures/media.fixture";

@Component({
  selector: "nol-test-dialog",
  template: "<input class=\"nol-test-name\" aria-label=\"Name\" />"
})
class TestDialogComponent {
}

@Component({
  selector: "nol-test-note-dialog",
  template: "<p>A note</p>"
})
class TestNoteDialogComponent {
}

interface ICovering {
  readonly cover: HTMLElement | null;
  readonly isLast: boolean;
  readonly isInert: boolean;
  readonly isHit: boolean;
}

function find<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (Object.isNull(element))
    throw new Error(`Nothing matches ${selector}.`);
  return element;
}

function readCovering(dialog: HTMLElement): ICovering {
  const container = TestBed.inject(OverlayContainer).getContainerElement();
  const cover = container.querySelector<HTMLElement>(".nol-window-covering");
  const host = [...container.children].find(t => t.contains(dialog));
  const box = dialog.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return { cover, isLast: !Object.isNull(cover) && container.lastElementChild?.contains(cover) === true, isInert: host?.hasAttribute("inert") === true, isHit: !Object.isNull(cover) && cover.contains(hit) };
}

describe("WindowComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  it("stacks the window row, the workspace and the status bar over the whole window", async () => {
    PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = DomFixture.host(fixture);

    expect([...root.children].map(t => t.tagName.toLowerCase())).toEqual(["nol-window-row", "nol-toolbar-band", "nol-workspace", "nol-status-bar", "nol-toasts", "nol-field-menu", "nol-link-menu"]);
    expect(root.getBoundingClientRect().height).toBe(innerHeight);
    expect(root.querySelector("nol-empty-window")).not.toBeNull();
  });

  for (const [scheme, mode] of [["light", ThemeMode.Light], ["dark", ThemeMode.Dark]] as const)
    it(`applies the default theme and reports the painted appearance once after the first render, when the system prefers ${scheme}`, async () => {
      await MediaFixture.emulateAsync([["prefers-color-scheme", scheme]]);
      try {
        const bridge = PreloadBridgeFixture.install();
        const fixture = TestBed.createComponent(WindowComponent);
        await fixture.whenStable();
        fixture.detectChanges();
        const theme = DefaultTheme.theme;

        expect(bridge.appearances).toEqual([{
          background: AppearanceFixture.readColor(theme, mode, "window"),
          titleBar: AppearanceFixture.readColor(theme, mode, "title-bar"),
          titleBarText: AppearanceFixture.readColor(theme, mode, "title-bar-text"),
          titleBarHeight: AppearanceFixture.toPixels(2)
        }]);
      }
      finally {
        await MediaFixture.emulateAsync([]);
      }
    });

  for (const panelSize of [12, 13, 18])
    for (const platform of ["win32", "darwin"])
      for (const count of [0, 2])
        it(`stands the window row's controls, ${count} toolbar rows and the panels 0.25rem apart at panel size ${panelSize} on ${platform}`, async () => {
          const toolbar = new Toolbar("notes.main", "Main", [new MenuSection("notes.create", [new CommandRow("notes.newNote", {}, "New note", "note", null, true, MenuCheck.None, false)])]);
          const rows = Array.from({ length: count }, () => [toolbar]);
          PreloadBridgeFixture.install(platform);
          TestBed.configureTestingModule({ providers: [{ provide: ToolbarService, useValue: { rows: signal(rows), hasContent: signal(count > 0) } }] });
          AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
          TestBed.inject(AppearanceService).setTypography(new Typography(panelSize));
          const fixture = TestBed.createComponent(WindowComponent);
          await fixture.whenStable();
          const root: HTMLElement = DomFixture.host(fixture);
          const row = DomFixture.one(root, "nol-window-row");
          const controls = [...row.querySelectorAll<HTMLElement>("button")].filter(t => t.checkVisibility({ visibilityProperty: true })).map(t => t.getBoundingClientRect().bottom);
          const bands = [...root.querySelectorAll<HTMLElement>(".nol-toolbar-row")].map(t => t.getBoundingClientRect());
          const panel = DomFixture.one(root, "nol-tab-group").getBoundingClientRect();
          const edges = [{ top: Number.NaN, bottom: Math.max(...controls) }, ...bands, { top: panel.top, bottom: Number.NaN }];
          const gaps = edges.slice(1).map((t, index) => t.top - (edges[index]?.bottom ?? Number.NaN));

          expect(gaps).toHaveLength(count + 1);
          for (const gap of gaps)
            AppearanceFixture.expectPixels(gap, AppearanceFixture.toPixels(0.25, panelSize));
        });

  it("shows the startup card instead of the workspace until the runtime is ready", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.startup = { kind: "PreShellData", details: ["/data/old"] };
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = DomFixture.host(fixture);

    expect([...root.children].map(t => t.tagName.toLowerCase())).toEqual(["nol-window-row", "nol-toolbar-band", "nol-startup", "nol-status-bar", "nol-toasts", "nol-field-menu", "nol-link-menu"]);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect(root.querySelector("nol-workspace")).not.toBeNull();
    expect(root.querySelector("nol-startup")).toBeNull();
  });

  it("keeps the workspace under the startup card while the runtime starts again", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = DomFixture.host(fixture);
    const workspace = root.querySelector("nol-workspace");

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await fixture.whenStable();
    const card = DomFixture.one(root, "nol-startup");
    const tags = [...root.children].map(t => t.tagName.toLowerCase());
    const [cardBox, workspaceBox] = [card, DomFixture.present(workspace)].map(t => t.getBoundingClientRect().toJSON());
    const announced = [card.querySelector("[role=status]")?.textContent?.trim(), card.classList.contains("nol-window-reconnecting")];
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect(tags).toEqual(["nol-window-row", "nol-toolbar-band", "nol-workspace", "nol-startup", "nol-status-bar", "nol-toasts", "nol-field-menu", "nol-link-menu"]);
    expect(cardBox).toEqual(workspaceBox);
    expect(announced).toEqual(["Starting Noldova Desktop Sample…", true]);
    expect(root.querySelector("nol-workspace")).toBe(workspace);
    expect(root.querySelector("nol-startup")).toBeNull();
  });

  it("moves the startup card over a dialog open while the runtime starts again, keeps the dialog inert beneath it and gives it back with its focus and text once ready", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = DomFixture.host(fixture);
    TestBed.inject(DialogService).open(TestDialogComponent);
    await fixture.whenStable();
    const name = find<HTMLInputElement>(".nol-test-name");
    name.value = "A name not saved yet";
    name.focus();

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await fixture.whenStable();
    const workspace = find("nol-workspace", root).getBoundingClientRect().toJSON();
    await vi.waitFor(() => expect(readCovering(name).cover?.getBoundingClientRect().toJSON()).toEqual(workspace));
    const covered = readCovering(name);
    const tags = [...root.children].map(t => t.tagName.toLowerCase());
    const announced = covered.cover?.querySelector("[role=status]")?.textContent?.trim();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
    await fixture.whenStable();
    const isKept = readCovering(name).cover === covered.cover;
    Object.assign(root.style, { boxSizing: "border-box", paddingTop: "2rem" });
    const moved = find("nol-workspace", root).getBoundingClientRect().toJSON();
    await vi.waitFor(() => expect(readCovering(name).cover?.getBoundingClientRect().toJSON()).toEqual(moved));
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect([covered.isLast, covered.isInert, covered.isHit, announced, isKept]).toEqual([true, true, true, "Starting Noldova Desktop Sample…", true]);
    expect(moved.top).toBeGreaterThan(workspace.top);
    expect(tags).toEqual(["nol-window-row", "nol-toolbar-band", "nol-workspace", "nol-status-bar", "nol-toasts", "nol-field-menu", "nol-link-menu"]);
    expect([readCovering(name).cover, readCovering(name).isInert]).toEqual([null, false]);
    expect(document.activeElement).toBe(name);
    expect(name.value).toBe("A name not saved yet");
    expect(root.querySelector("nol-startup")).toBeNull();
  });

  it("puts a dialog that opens while the runtime starts again inert under the startup card at once, and moves focus to its first field once ready", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    bridge.publishStartup({ kind: "Connecting", details: [] });
    await fixture.whenStable();

    TestBed.inject(DialogService).open(TestDialogComponent);
    await fixture.whenStable();
    const name = find(".nol-test-name");
    const opened = readCovering(name);
    const workspace = find("nol-workspace").getBoundingClientRect().toJSON();
    await vi.waitFor(() => expect(readCovering(name).cover?.getBoundingClientRect().toJSON()).toEqual(workspace));
    const isHit = readCovering(name).isHit;
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect([opened.isLast, opened.isInert, isHit]).toEqual([true, true, true]);
    expect([readCovering(name).cover, readCovering(name).isInert]).toEqual([null, false]);
    expect(document.activeElement).toBe(name);
  });

  it("moves focus to the topmost of the dialogs that opened while the runtime started again once ready, to the dialog itself when it has nothing to tab to", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    bridge.publishStartup({ kind: "Connecting", details: [] });
    await fixture.whenStable();
    const dialogs = TestBed.inject(DialogService);

    dialogs.open(TestDialogComponent);
    const note = dialogs.open(TestNoteDialogComponent);
    await fixture.whenStable();
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect(document.activeElement).toBe(note.overlayRef.overlayElement.querySelector(".cdk-dialog-container"));
    expect(document.activeElement?.getAttribute("role")).toBe("dialog");
  });

  it("moves focus into a dialog without the kit's container once ready, and keeps a plain dialog open on Escape while covered", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    bridge.publishStartup({ kind: "Connecting", details: [] });
    await fixture.whenStable();

    const dialog = TestBed.inject(Dialog).open(TestDialogComponent);
    await fixture.whenStable();
    find(".cdk-dialog-container", dialog.overlayRef.overlayElement).classList.remove("cdk-dialog-container");
    const name = find(".nol-test-name");
    const covered = dialog.disableClose;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
    await fixture.whenStable();
    const isOpen = TestBed.inject(Dialog).openDialogs.includes(dialog);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect([covered, isOpen]).toEqual([true, true]);
    expect(dialog.disableClose).toBe(false);
    expect(readCovering(name).isInert).toBe(false);
    expect(document.activeElement).toBe(name);
  });

  it("keeps focus on the startup card's Try again when a dialog opening or closing while the runtime starts again moves the card", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = DomFixture.host(fixture);
    bridge.publishStartup({ kind: "Failed", details: ["The runtime ended."] });
    await fixture.whenStable();
    find(".nol-startup-actions button", root).focus();

    const dialog = TestBed.inject(DialogService).open(TestDialogComponent);
    await fixture.whenStable();
    const covering = document.activeElement?.closest(".nol-window-covering") ?? null;
    const coveringText = document.activeElement?.textContent?.trim();
    dialog.close();
    await fixture.whenStable();

    expect([Object.isNull(covering), coveringText]).toEqual([false, "Try again"]);
    expect(document.activeElement).toBe(find(".nol-startup-actions button", root));
  });

  it("keeps focus on the startup card's Try again when focus leaves it, inert under an opening dialog, before the card moves", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = DomFixture.host(fixture);
    bridge.publishStartup({ kind: "Failed", details: ["The runtime ended."] });
    await fixture.whenStable();
    const tryAgain = find(".nol-startup-actions button", root);
    tryAgain.focus();

    TestBed.inject(DialogService).open(TestDialogComponent);
    const isInert = !Object.isNull(tryAgain.closest("[inert]"));
    tryAgain.blur();
    const isLeft = document.activeElement === document.body;
    await fixture.whenStable();

    expect([isInert, isLeft]).toEqual([true, true]);
    expect(document.activeElement?.closest(".nol-window-covering")).not.toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe("Try again");
  });

  it("covers a dialog open before the window, and puts the startup card back over the workspace when that dialog closes while the runtime starts again", async () => {
    const bridge = PreloadBridgeFixture.install();
    const dialog = TestBed.inject(DialogService).open(TestDialogComponent);
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = DomFixture.host(fixture);
    bridge.publishStartup({ kind: "Connecting", details: [] });
    await fixture.whenStable();
    const name = find(".nol-test-name");
    const wasCovering = !Object.isNull(readCovering(name).cover);

    dialog.close();
    await fixture.whenStable();

    expect(wasCovering).toBe(true);
    expect(TestBed.inject(OverlayContainer).getContainerElement().querySelector(".nol-window-covering")).toBeNull();
    expect([...root.children].map(t => t.tagName.toLowerCase())).toEqual(["nol-window-row", "nol-toolbar-band", "nol-workspace", "nol-startup", "nol-status-bar", "nol-toasts", "nol-field-menu", "nol-link-menu"]);
  });

  it("answers an update's save request with what did not save and stops listening when destroyed", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();

    bridge.requestUpdateSave("request");
    await vi.waitFor(() => expect(bridge.updateSaveAnswers).toEqual(["request:"]));
    fixture.destroy();

    expect(bridge.updateSaveListenerCount).toBe(0);
  });

  it("answers close requests as saved and stops listening when destroyed", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();

    bridge.requestClose("request");
    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:true"]));
    fixture.destroy();

    expect(bridge.layout).toBeNull();
    expect(bridge.closeListenerCount).toBe(0);
  });

  it("answers a close request as not saved when a window part's save failed", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    vi.spyOn(TestBed.inject(ClosingService), "saveAsync").mockResolvedValue(false);

    bridge.requestClose("request");

    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:false"]));
    fixture.destroy();
  });

  it("saves a changed layout before it answers a close request", async () => {
    const bridge = PreloadBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const layout = TestBed.inject(LayoutService);
    await vi.waitFor(() => expect(bridge.layout).toBeNull());
    await layout.loadAsync();
    layout.toggleDock(DockSide.Left);

    bridge.requestClose("request");

    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:true"]));
    expect(bridge.layout).toEqual(layout.layout().toJson());
    fixture.destroy();
  });

  it("writes a failed layout save to the main process's log and still lets Noldova Desktop Sample close", async () => {
    const bridge = PreloadBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useClass: WindowErrorHandler }] });
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const layout = TestBed.inject(LayoutService);
    await layout.loadAsync();
    layout.toggleDock(DockSide.Left);
    const failure = new Error("This device has no identity, so the window's layout is not kept.");
    vi.spyOn(TestBed.inject(LayoutStoreService), "writeAsync").mockRejectedValue(failure);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    bridge.requestClose("request");

    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:true"]));
    expect(bridge.errorsLogged).toEqual([[null, failure.stack]]);
    fixture.destroy();
  });
});
