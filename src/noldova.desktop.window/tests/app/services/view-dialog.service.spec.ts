/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import { DialogService } from "@noldova/ui.components.angular";
import { ArgumentException } from "@noldova/context.exceptions";

import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { ContentPadding } from "../../../src/app/enums/content-padding";
import { ViewDialogException } from "../../../src/app/exceptions/view-dialog.exception";
import { ContributionMatch } from "../../../src/app/models/contribution-match";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { DocumentOpenerService } from "../../../src/app/services/document-opener.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { LiveViewService } from "../../../src/app/services/live-view.service";
import { StartupService } from "../../../src/app/services/startup.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { DomFixture } from "../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { WindowPartHostFixture } from "../../fixtures/window-part-host.fixture";

@Component({
  selector: "nol-test-search",
  template: `
    <p class="nol-test-search">Search</p>
    <input class="nol-test-query" aria-label="Query" (keydown.escape)="$event.preventDefault()" />
  `
})
class TestSearchComponent {
}

@Component({
  selector: "nol-test-note",
  template: "<p class=\"nol-test-note\">Plan</p>"
})
class TestNoteComponent {
}

describe("ViewDialogService", () => {
  const { search, plan } = LayoutFixture;
  let opener: HTMLButtonElement;
  let dialogs: ViewDialogService;
  let bridge: PreloadBridgeFixture;

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    const host = new WindowPartHostFixture();
    host.contributions.set(search.key, new ContributionMatch(() => Promise.resolve(TestSearchComponent), null, ContentPadding.Default));
    for (const note of [new DocumentTab(plan.name, "draft"), plan, LayoutFixture.todo, LayoutFixture.settings])
      host.contributions.set(note.key, new ContributionMatch(() => Promise.resolve(TestNoteComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(plan));
    TestBed.inject(TabLabelService).register(search.name, new TabLabel("Search", "search"));
    dialogs = TestBed.inject(ViewDialogService);
    opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.append(opener);
    opener.focus();
    AppearanceFixture.apply();
  });

  afterEach(async () => {
    dialogs.close();
    await vi.waitFor(() => expect(document.querySelector("nol-view-dialog")).toBeNull());
    opener.remove();
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  function container(): HTMLElement | null {
    return DomFixture.maybe(document, "[role=dialog]");
  }

  it("shows a registered view in a large modal dialog named by its label, focuses its first control and resolves once closed", async () => {
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("nol-test-query")).toBe(true));
    const title = document.getElementById(DomFixture.present(container()).getAttribute("aria-labelledby") ?? String.empty)?.textContent;
    const isLarge = document.querySelector("nol-dialog")?.classList.contains("nol-dialog-large");
    const shownTab = dialogs.shown();

    dialogs.close();
    await shown;

    expect([container(), title, isLarge, shownTab?.key, dialogs.shown()]).toEqual([null, "Search", true, search.key, null]);
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("announces its view's leave before it takes the view from its tab and while the view is still in the window before it closes, and none when no view shows", async () => {
    const left: unknown[][] = [];
    TestBed.inject(LiveViewService).onLeave(tab => left.push([tab.key, !Object.isNull(document.querySelector(".nol-test-query"))]));
    dialogs.close();
    const idle = [...left];
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-query")).not.toBeNull());

    dialogs.close();
    await shown;

    expect([idle, left]).toEqual([[], [[search.key, false], [search.key, true]]]);
  });

  it("shows a document under the given title", async () => {
    void dialogs.showAsync(new DocumentTab(plan.name, "draft"), "Draft plan");
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());

    expect(document.getElementById(DomFixture.present(container()).getAttribute("aria-labelledby") ?? String.empty)?.textContent).toBe("Draft plan");
  });

  it("refuses a second view while one is shown, and a view or document that is not registered", async () => {
    void dialogs.showAsync(search);

    await expect(dialogs.showAsync(plan)).rejects.toThrowError("A dialog is already open.");
    dialogs.close();
    await expect(dialogs.showAsync(new ViewTab("files.missing"))).rejects.toThrowError(new ArgumentException("No view named \"files.missing\" is registered.", "tab"));
    await expect(dialogs.showAsync(new DocumentTab("notes.page", "1"))).rejects.toThrowError(ArgumentException);
    expect([dialogs.canShow(search), dialogs.shown()]).toEqual([true, null]);
  });

  it("lets its view's module run its commands while it is the topmost dialog, but not another module's, the shell's for its own document, or any under another dialog", async () => {
    const before = dialogs.ownsCommand("files.find");
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("nol-test-query")).toBe(true));
    const whileShown = ["files.find", "notes.newNote", "desktop.closeTab"].map(t => dialogs.ownsCommand(t));
    const other = TestBed.inject(DialogService).open(TestSearchComponent, ".nol-test-query");
    const underAnother = dialogs.ownsCommand("files.find");
    other.close();
    dialogs.close();
    await shown;
    const settings = dialogs.showAsync(LayoutFixture.settings);
    await vi.waitFor(() => expect(container()).not.toBeNull());
    const forShellDocument = dialogs.ownsCommand("desktop.closeTab");
    dialogs.close();
    await settings;

    expect([before, ...whileShown, underAnother, forShellDocument]).toEqual([false, true, false, false, false, false]);
  });

  it("refuses a view while another dialog is open", async () => {
    const other = TestBed.inject(DialogService).open(TestSearchComponent, ".nol-test-query");

    const isShowable = dialogs.canShow(search);
    await expect(dialogs.showAsync(search)).rejects.toThrowError(ViewDialogException);
    other.close();

    expect([isShowable, dialogs.canShow(search)]).toEqual([false, true]);
  });

  it("closes while the runtime starts again and shows none until it is ready", async () => {
    const startup = TestBed.inject(StartupService);
    await vi.waitFor(() => expect(startup.hasStarted()).toBe(true));
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-search")).not.toBeNull());

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await shown;
    const isShowable = dialogs.canShow(search);
    await expect(dialogs.showAsync(search)).rejects.toThrowError("A dialog can't open while the window reconnects to the runtime.");
    bridge.publishStartup({ kind: "Ready", details: [] });

    expect([isShowable, dialogs.canShow(search), container()]).toEqual([false, true, null]);
  });

  it("closes when its view's module goes away, or when the tab it came from is closed, but not when a tab it didn't come from closes", async () => {
    const layout = TestBed.inject(LayoutService);
    const registry = layout.registry();
    const fromRegistry = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-search")).not.toBeNull());
    layout.setRegistry(new ViewRegistry([], ["notes.note"]));
    await fromRegistry;
    layout.setRegistry(registry);

    const fromTab = dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());
    layout.close(plan);
    await fromTab;

    layout.openDocument(plan);
    layout.openDocument(LayoutFixture.todo);
    void dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());
    layout.close(LayoutFixture.todo);
    TestBed.tick();

    expect([layout.layout().isOpen(LayoutFixture.todo), layout.layout().isOpen(plan), dialogs.shown()?.key]).toEqual([false, true, plan.key]);
  });

  it("closes when its module closes the document it shows, open as a tab or not", async () => {
    const documents = TestBed.inject(DocumentOpenerService);
    const fromTab = dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());
    documents.close("notes", plan.name, "plan");
    await fromTab;
    const wasOpen = TestBed.inject(LayoutService).layout().isOpen(plan);

    const alone = dialogs.showAsync(new DocumentTab(plan.name, "draft"));
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());
    documents.close("notes", plan.name, "draft");
    await alone;

    expect([wasOpen, dialogs.shown()]).toEqual([false, null]);
  });

  it("closes when a document is opened or activated from it, and focuses that document's tab", async () => {
    const layout = TestBed.inject(LayoutService);
    const tabElements = [LayoutFixture.todo, plan].map(t => {
      const element = document.createElement("button");
      element.dataset["tabKey"] = t.key;
      document.body.append(element);
      return element;
    });
    const opened = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-search")).not.toBeNull());
    layout.openDocument(LayoutFixture.todo);
    TestBed.tick();
    await opened;
    await vi.waitFor(() => expect(document.activeElement).toBe(tabElements[0]));
    const isTodoActive = layout.layout().groupOf(LayoutFixture.todo)?.active?.equals(LayoutFixture.todo);

    const activated = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-search")).not.toBeNull());
    layout.activate(plan);
    TestBed.tick();
    await activated;
    await vi.waitFor(() => expect(document.activeElement).toBe(tabElements[1]));
    tabElements.forEach(t => t.remove());

    expect([isTodoActive, dialogs.shown()]).toEqual([true, null]);
  });

  it("stays open for its own document, a view, a document that is not open and one revealed before it showed", async () => {
    const layout = TestBed.inject(LayoutService);
    layout.openDocument(LayoutFixture.todo);
    void dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());

    TestBed.tick();
    const shownAfter = [plan, LayoutFixture.files, new DocumentTab("notes.note", "gone")].map(t => {
      layout.activate(t);
      TestBed.tick();
      return dialogs.shown()?.key;
    });

    expect(shownAfter).toEqual([plan.key, plan.key, plan.key]);
  });

  it("closes when its module asks to close its view or document, by name or by name and instance, gone from the page with focus back where it came from", async () => {
    const draft = new DocumentTab(plan.name, "draft");
    const view = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("nol-test-query")).toBe(true));
    dialogs.closeShowing(search.name, null);
    await view;
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
    const afterView = [document.querySelector("nol-view-dialog"), container(), dialogs.shown()];

    const note = dialogs.showAsync(draft);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());
    dialogs.closeShowing(draft.name, draft.instance ?? null);
    await note;
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));

    expect([...afterView, document.querySelector("nol-view-dialog"), container(), dialogs.shown()]).toEqual([null, null, null, null, null, null]);
  });

  it("stays open when its module asks to close a view or document in a tab, another one or another instance, and does nothing with no dialog open", async () => {
    const draft = new DocumentTab(plan.name, "draft");
    dialogs.closeShowing(search.name, null);
    const idle = dialogs.shown();
    const shown = dialogs.showAsync(draft);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());

    for (const [name, instance] of [[plan.name, plan.instance ?? null], [search.name, null], [LayoutFixture.files.name, null]] as const)
      dialogs.closeShowing(name, instance);
    TestBed.tick();
    const kept = [dialogs.shown()?.key, Object.isNull(document.querySelector("nol-view-dialog")), Object.isNull(container()), TestBed.inject(LayoutService).layout().isOpen(plan)];
    dialogs.close();
    await shown;

    expect([idle, ...kept]).toEqual([null, draft.key, false, false, true]);
  });

  it("focuses the tab it came from when the control that opened it is gone, and leaves focus where it returned otherwise", async () => {
    const tabElement = document.createElement("button");
    tabElement.dataset["tabKey"] = plan.key;
    document.body.append(tabElement);
    const shown = dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());
    opener.remove();
    dialogs.close();
    await shown;
    await vi.waitFor(() => expect(document.activeElement).toBe(tabElement));

    document.body.append(opener);
    opener.focus();
    const again = dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-note")).not.toBeNull());
    dialogs.close();
    await again;
    TestBed.tick();
    tabElement.remove();

    expect(document.activeElement).toBe(opener);
  });

  it("opens its view in the main window with focus: in the tab it came from, made active, or else as a new tab in the current group, or with the documents when that group can't hold it", async () => {
    const layout = TestBed.inject(LayoutService);
    const draft = new DocumentTab(plan.name, "draft");
    layout.openDocument(LayoutFixture.todo);
    const tabElements = [plan, search, draft].map(t => {
      const element = document.createElement("button");
      element.dataset["tabKey"] = t.key;
      document.body.append(element);
      return element;
    });
    const openAsync = async (tab: DocumentTab | ViewTab, element: HTMLElement): Promise<readonly unknown[]> => {
      const shown = dialogs.showAsync(tab);
      await vi.waitFor(() => expect(container()).not.toBeNull());
      await userEvent.click(page.getByRole("button", { name: "Open in main window" }));
      await shown;
      await vi.waitFor(() => expect(document.activeElement).toBe(element));
      const group = layout.layout().groupOf(tab);
      return [group?.id, group?.tabs.map(t => t.key), group?.active?.key, dialogs.shown()];
    };

    const fromTab = await openAsync(plan, DomFixture.present(tabElements[0]));
    layout.focusGroup(1);
    const intoGroup = await openAsync(search, DomFixture.present(tabElements[1]));
    const intoDocuments = await openAsync(draft, DomFixture.present(tabElements[2]));
    tabElements.forEach(t => t.remove());

    expect(fromTab).toEqual([layout.layout().documents.id, [plan.key, LayoutFixture.todo.key], plan.key, null]);
    expect(intoGroup).toEqual([1, [LayoutFixture.files.key, search.key], search.key, null]);
    expect(intoDocuments).toEqual([layout.layout().documents.id, [plan.key, LayoutFixture.todo.key, draft.key], draft.key, null]);
  });

  it("closes on Escape or the close button but leaves Escape to the view when the view handled it, and the window behind doesn't respond", async () => {
    const shown = dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("nol-test-query")).toBe(true));
    let clicks = 0;
    opener.addEventListener("click", () => clicks++);

    await userEvent.keyboard("{Escape}");
    const isOpenAfterHandledEscape = !Object.isNull(dialogs.shown());
    await userEvent.click(DomFixture.one(document, ".cdk-overlay-backdrop"), { position: { x: 4, y: 4 } });
    const isOpenAfterBackdrop = !Object.isNull(dialogs.shown());
    DomFixture.one(document, ".nol-dialog-close").focus();
    await userEvent.keyboard("{Escape}");
    await shown;

    void dialogs.showAsync(search);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-search")).not.toBeNull());
    await userEvent.click(page.getByRole("button", { name: "Close" }));

    expect([isOpenAfterHandledEscape, isOpenAfterBackdrop, clicks, dialogs.shown()]).toEqual([true, true, 0, null]);
  });
});
