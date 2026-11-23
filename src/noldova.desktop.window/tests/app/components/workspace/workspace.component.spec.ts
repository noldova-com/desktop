/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FocusTrapFactory } from "@angular/cdk/a11y";
import { Component, EnvironmentInjector, type Signal, type WritableSignal, afterNextRender, inject, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { AppearanceService, DefaultTheme, ThemeMode, Typography } from "@noldova/ui.components.angular";

import { WorkspaceComponent } from "../../../../src/app/components/workspace/workspace.component";
import { ContentPadding } from "../../../../src/app/enums/content-padding";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { DockGrowthService } from "../../../../src/app/services/dock-growth.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { ShellCommandsService } from "../../../../src/app/services/shell-commands.service";
import { ViewDialogService } from "../../../../src/app/services/view-dialog.service";
import { ViewInstancesService } from "../../../../src/app/services/view-instances.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";

@Component({
  selector: "nol-test-fields",
  template: "<input class=\"first\" /><input class=\"second\" /><svg class=\"mark\"></svg>"
})
class TestFieldsComponent {
}

@Component({
  selector: "nol-test-note",
  template: "<p>todo</p>"
})
class TestNoteComponent {
}

@Component({
  selector: "nol-test-late",
  template: "<p>later</p>@if (ready()) {<input class=\"late\" />}"
})
class TestLateComponent {
  public static readonly isReady: WritableSignal<boolean> = signal(false);

  protected readonly ready: WritableSignal<boolean> = TestLateComponent.isReady;
}

const activeDocuments: Map<string, Signal<boolean>> = new Map();

@Component({
  selector: "nol-test-plan-page",
  template: "<input class=\"plan\" />"
})
class TestPlanPageComponent {
  public constructor() {
    activeDocuments.set("plan", inject(WindowPartTokens.activeDocument));
  }
}

@Component({
  selector: "nol-test-todo-page",
  template: "<input class=\"todo\" />"
})
class TestTodoPageComponent {
  public constructor() {
    activeDocuments.set("todo", inject(WindowPartTokens.activeDocument));
  }
}

@Component({
  selector: "nol-test-shell",
  template: "<input class=\"shell\" />"
})
class TestShellComponent {
}

@Component({
  imports: [WorkspaceComponent],
  template: `<nol-workspace [style.width.px]="width()" [style.height.px]="height()" />`
})
class WorkspaceHostComponent {
  public readonly width = signal(1000);
  public readonly height = signal(600);
}

describe("WorkspaceComponent", () => {
  let bridge: PreloadBridgeFixture;
  let parts: WindowPartHostFixture;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  beforeEach(() => {
    parts = new WindowPartHostFixture();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: parts }] });
  });

  afterEach(() => AppearanceFixture.reset());

  async function renderAsync(registry: ViewRegistry, layout: Layout = Layout.createDefault(registry)): Promise<ComponentFixture<WorkspaceHostComponent>> {
    AppearanceFixture.apply();
    await LayoutServiceFixture.prepareAsync(registry, layout, 0, 0, null);
    const fixture = TestBed.createComponent(WorkspaceHostComponent);
    await settleAsync(fixture);
    return fixture;
  }

  async function settleAsync(fixture: ComponentFixture<WorkspaceHostComponent>): Promise<void> {
    fixture.detectChanges();
    await new Promise(t => requestAnimationFrame(() => requestAnimationFrame(t)));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function groupsOf(fixture: ComponentFixture<WorkspaceHostComponent>): HTMLElement[] {
    return [...DomFixture.host(fixture).querySelectorAll<HTMLElement>("nol-panel-card")];
  }

  function boundsOf(element: HTMLElement): readonly number[] {
    const workspace = element.closest("nol-workspace")?.getBoundingClientRect() ?? new DOMRect();
    const bounds = element.getBoundingClientRect();
    return [bounds.x - workspace.x, bounds.y - workspace.y, bounds.width, bounds.height];
  }

  it("is inert while the runtime starts again and gives the focus back where it was once it is ready", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const workspace = DomFixture.one(DomFixture.host(fixture), "nol-workspace");
    const focused = workspace.appendChild(document.createElement("button"));
    focused.focus();

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    const whileStarting = [workspace.hasAttribute("inert"), document.activeElement === focused];
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);

    expect(whileStarting).toEqual([true, false]);
    expect(workspace.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(focused);
  });

  it("remembers the focus only from an HTML element, so a focus that moves in an SVG element does not take its place", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const workspace = DomFixture.one(DomFixture.host(fixture), "nol-workspace");
    const focused = workspace.appendChild(document.createElement("button"));
    focused.focus();
    const graphic = workspace.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));

    graphic.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);

    expect(document.activeElement).toBe(focused);
  });

  it("focuses the active tab of the group that held the focus when its place is gone once the parts load again", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    const host = DomFixture.host(fixture);
    const tab = DomFixture.one(host, `[data-tab-key="${LayoutFixture.plan.key}"]`);
    const focused = DomFixture.closest(tab, "nol-tab-group").appendChild(document.createElement("button"));
    focused.focus();

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);
    const whileLoading = document.activeElement === focused;
    focused.remove();
    parts.generation.update(t => t + 1);
    await settleAsync(fixture);

    expect(whileLoading).toBe(true);
    expect(document.activeElement).toBe(tab);
  });

  it("leaves the focus where the person moved it before the next render, rather than giving it back to the active tab it was restoring", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    const host = DomFixture.host(fixture);
    const tab = DomFixture.one(host, `[data-tab-key="${LayoutFixture.plan.key}"]`);
    const focused = DomFixture.closest(tab, "nol-tab-group").appendChild(document.createElement("button"));
    const field = document.body.appendChild(document.createElement("input"));
    try {
      focused.focus();
      focused.remove();
      let asked: Element | null = null;
      parts.generation.update(t => t + 1);
      afterNextRender(() => {
        asked = document.activeElement;
        field.focus();
      }, { injector: TestBed.inject(EnvironmentInjector) });
      await settleAsync(fixture);

      expect([asked, document.activeElement]).toEqual([document.body, field]);
    }
    finally {
      field.remove();
    }
  });

  it("moves the focus into a document or view whose tab the pointer chooses, back to where it was in it, and leaves it on a tab chosen by keyboard and on a document with nothing to focus", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo, terminal } = LayoutFixture;
    const shell = new ViewTab("terminal.shell");
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestNoteComponent), null, ContentPadding.Default));
    parts.contributions.set(shell.key, new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    parts.contributions.set(terminal.key, new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openView(shell, registry).openView(terminal, registry).openDocument(plan)
      .openDocument(todo));
    const host = DomFixture.host(fixture);
    const tabOf = (tab: Tab): HTMLElement => DomFixture.one(host, `nol-tab[data-tab-key="${tab.key}"]`);
    const focused = (): string | null => document.activeElement?.getAttribute("data-tab-key") ?? document.activeElement?.getAttribute("class") ?? null;
    const pickAsync = async (tab: Tab, detail: number): Promise<string | null> => {
      tabOf(tab).focus();
      tabOf(tab).dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
      await settleAsync(fixture);
      return focused();
    };
    const pressAsync = async (tab: Tab, key: string): Promise<string | null> => {
      tabOf(tab).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      await settleAsync(fixture);
      return focused();
    };

    const first = await pickAsync(plan, 1);
    host.querySelector<HTMLElement>(".second")?.focus();
    host.querySelector(".mark")?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const empty = await pickAsync(todo, 1);
    const back = await pickAsync(plan, 1);
    const unpointed = await pickAsync(plan, 0);
    const arrowed = [await pressAsync(plan, "ArrowRight"), await pressAsync(todo, "ArrowLeft"), await pressAsync(plan, "Enter")];
    const view = [await pickAsync(shell, 1), await pickAsync(shell, 0), await pressAsync(shell, "Enter")];
    const instance = [await pickAsync(terminal, 1), await pickAsync(terminal, 0), await pressAsync(terminal, "ArrowLeft"), await pressAsync(shell, "ArrowRight")];

    expect([first, empty, back, unpointed]).toEqual(["first", todo.key, "second", plan.key]);
    expect(arrowed).toEqual([todo.key, plan.key, plan.key]);
    expect(view).toEqual(["shell", shell.key, shell.key]);
    expect(instance).toEqual(["shell", terminal.key, shell.key, terminal.key]);
    expect(TestBed.inject(LayoutService).layout().documents.active).toEqual(plan);
  });

  it("tells two documents side by side which one is the window's active document as a saved split restores, and as the person moves between groups by pointer and by keyboard", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    activeDocuments.clear();
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestPlanPageComponent), null, ContentPadding.Default));
    parts.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestTodoPageComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(plan).openDocument(todo).splitGroup(todo, 0, PanelEdge.Right));
    const host = DomFixture.host(fixture);
    const states = (): readonly (boolean | null)[] => ["plan", "todo"].map(t => activeDocuments.get(t)?.() ?? null);
    const restored = states();

    const tab = DomFixture.one(host, `nol-tab[data-tab-key="${plan.key}"]`);
    tab.focus();
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await settleAsync(fixture);
    const pointed = states();
    expect(await TestBed.inject(ShellCommandsService).commands.find(t => t.name === "desktop.focusNextGroup")?.runAsync(null)).toBeNull();
    await settleAsync(fixture);

    expect([restored, pointed, states()]).toEqual([[false, true], [true, false], [false, true]]);
    expect(TestBed.inject(LayoutService).layout().documents.has(todo)).toBe(true);
  });

  it("leaves the focus in the active document and its tab selected when a part opens another document without activating it", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    const readme = new DocumentTab("notes.note", "readme");
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.contributions.set(readme.key, new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(todo).openDocument(plan));
    const host = DomFixture.host(fixture);
    const selected = (tab: Tab): string | null => DomFixture.one(host, `nol-tab[data-tab-key="${tab.key}"]`).getAttribute("aria-selected");
    const field = DomFixture.one(host, ".first");
    field.focus();

    TestBed.inject(LayoutService).openDocument(readme, false, null, false);
    await settleAsync(fixture);

    expect(document.activeElement).toBe(field);
    expect([selected(plan), selected(readme)]).toEqual(["true", "false"]);
  });

  it("leaves the focus in a dock's view when a part opens a document without activating it into an empty group, which shows it as its active tab", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan } = LayoutFixture;
    const shell = new ViewTab("terminal.shell");
    parts.contributions.set(shell.key, new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openView(shell, registry));
    const host = DomFixture.host(fixture);
    const field = DomFixture.one(host, ".shell");
    field.focus();

    TestBed.inject(LayoutService).openDocument(plan, false, null, false);
    await settleAsync(fixture);

    expect(document.activeElement).toBe(field);
    expect(DomFixture.one(host, `nol-tab[data-tab-key="${plan.key}"]`).getAttribute("aria-selected")).toBe("true");
    expect(host.querySelectorAll(".first")).toHaveLength(1);
  });

  it("keeps a pointer's request for the focus until the document shows a field, once its part activates or its view adds the field later", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    TestLateComponent.isReady.set(false);
    parts.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestLateComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(plan).openDocument(todo));
    const host = DomFixture.host(fixture);
    const tabOf = (tab: Tab): HTMLElement => DomFixture.one(host, `nol-tab[data-tab-key="${tab.key}"]`);
    const focused = (): string | null => document.activeElement?.getAttribute("data-tab-key") ?? document.activeElement?.getAttribute("class") ?? null;
    const pickAsync = async (tab: Tab): Promise<string | null> => {
      tabOf(tab).focus();
      tabOf(tab).dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      await settleAsync(fixture);
      return focused();
    };

    const inactive = await pickAsync(plan);
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.revisions.set(new Map([[plan.key, 1]]));
    await settleAsync(fixture);
    const activated = focused();
    const early = await pickAsync(todo);
    TestLateComponent.isReady.set(true);
    await settleAsync(fixture);

    expect([inactive, activated, early, focused()]).toEqual([plan.key, "first", todo.key, "late"]);
  });

  it("drops a pointer's request for the focus once the focus moves elsewhere or another tab is chosen, so a field shown later never takes the focus", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    TestLateComponent.isReady.set(false);
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestLateComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(plan).openDocument(todo));
    const host = DomFixture.host(fixture);
    const layout = TestBed.inject(LayoutService);
    const tab = DomFixture.one(host, `nol-tab[data-tab-key="${todo.key}"]`);
    const elsewhere = document.body.appendChild(document.createElement("input"));
    const pickAsync = async (): Promise<void> => {
      tab.focus();
      tab.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      await settleAsync(fixture);
    };
    try {
      await pickAsync();
      elsewhere.focus();
      const stray = host.querySelector("nol-test-late")?.appendChild(document.createElement("input"));
      await Promise.resolve();
      TestLateComponent.isReady.set(true);
      await settleAsync(fixture);
      const typing = document.activeElement === elsewhere;
      stray?.remove();
      TestLateComponent.isReady.set(false);
      await settleAsync(fixture);
      await pickAsync();
      layout.activate(plan);
      await settleAsync(fixture);
      layout.activate(todo);
      TestLateComponent.isReady.set(true);
      await settleAsync(fixture);

      expect(typing).toBe(true);
      expect(document.activeElement).toBe(tab);
    }
    finally {
      elsewhere.remove();
    }
  });

  it.each([
    ["document", LayoutFixture.todo],
    ["view with an instance", LayoutFixture.terminal],
    ["view without one", new ViewTab("terminal.shell")]
  ])("keeps a pointer's request for the focus, for a %s, until its field shows, and drops it once the person clicks a spot with nothing to focus or presses a key elsewhere, keeping their focus", async (_, waiting) => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo, terminal } = LayoutFixture;
    TestLateComponent.isReady.set(false);
    parts.contributions.set(waiting.key, new ContributionMatch(() => Promise.resolve(TestLateComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openView(terminal, registry).openView(new ViewTab("terminal.shell"), registry)
      .openDocument(plan).openDocument(todo));
    const host = DomFixture.host(fixture);
    const tab = DomFixture.one(host, `nol-tab[data-tab-key="${waiting.key}"]`);
    const text = document.body.appendChild(document.createElement("p"));
    const waitAsync = async (press: () => void): Promise<string | null> => {
      TestLateComponent.isReady.set(false);
      await settleAsync(fixture);
      tab.focus();
      tab.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      await settleAsync(fixture);
      press();
      TestLateComponent.isReady.set(true);
      await settleAsync(fixture);
      return document.activeElement === tab ? waiting.key : document.activeElement?.getAttribute("class") ?? null;
    };
    try {
      const shown = await waitAsync(() => undefined);
      const clicked = await waitAsync(() => text.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
      const pressed = await waitAsync(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true })));

      expect([shown, clicked, pressed]).toEqual(["late", waiting.key, waiting.key]);
    }
    finally {
      text.remove();
    }
  });

  it.each([
    ["view with an instance", LayoutFixture.terminal],
    ["view without one", new ViewTab("terminal.shell")]
  ])("moves the focus into a %s whose dock strip button the pointer presses, once its field shows, leaves it on the button for a keyboard press and a press that hides the dock, and moves it into the view again when a press shows the hidden dock", async (_, view) => {
    const registry = LayoutFixture.createRegistry();
    const { files } = LayoutFixture;
    TestLateComponent.isReady.set(false);
    parts.contributions.set(view.key, new ContributionMatch(() => Promise.resolve(TestLateComponent), null, ContentPadding.Default));
    const opened = Layout.createDefault(registry).openView(view, registry);
    const left = opened.dock(DockSide.Left).root?.groups[0]?.id ?? 0;
    const fixture = await renderAsync(registry, opened.moveTab(view, left, 1).activate(files));
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    await settleAsync(fixture);
    const layout = TestBed.inject(LayoutService);
    const button = DomFixture.one(document, `nol-dock[data-side="Left"] .nol-dock-strip-view[data-view="${view.key}"]`);
    const focused = (): string | null => document.activeElement === button ? view.key : document.activeElement?.getAttribute("class") ?? null;
    const pressAsync = async (detail: number): Promise<string | null> => {
      button.focus();
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
      await settleAsync(fixture);
      return focused();
    };

    const waiting = await pressAsync(1);
    TestLateComponent.isReady.set(true);
    await settleAsync(fixture);
    const shown = focused();
    layout.activate(files);
    await settleAsync(fixture);
    const keyed = await pressAsync(0);
    const keyedActive = layout.layout().groupOf(view)?.active;
    const hidden = await pressAsync(1);
    const hiddenCollapsed = layout.geometry().isCollapsed(DockSide.Left);
    const reshown = await pressAsync(1);

    expect([waiting, shown, keyed, hidden, reshown]).toEqual([view.key, "late", view.key, view.key, "late"]);
    expect(keyedActive).toEqual(view);
    expect(hiddenCollapsed).toBe(true);
    expect(layout.geometry().isCollapsed(DockSide.Left)).toBe(false);
  });

  it("moves the focus to the view's tab when a keyboard press on a collapsed dock's strip opens a dock with no rail, which removes the strip", async () => {
    const registry = LayoutFixture.createRegistry();
    const { files, terminal } = LayoutFixture;
    const opened = Layout.createDefault(registry).openView(terminal, registry);
    const left = opened.dock(DockSide.Left).root?.groups[0]?.id ?? 0;
    const fixture = await renderAsync(registry, opened.moveTab(terminal, left, 1).activate(files));
    const layout = TestBed.inject(LayoutService);
    layout.toggleDock(DockSide.Left);
    await settleAsync(fixture);
    const button = DomFixture.one(document, `nol-dock[data-side="Left"] .nol-dock-strip-view[data-view="${terminal.key}"]`);

    button.focus();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    await settleAsync(fixture);

    expect(layout.geometry().isCollapsed(DockSide.Left)).toBe(false);
    expect(button.isConnected).toBe(false);
    expect(document.activeElement).toBe(DomFixture.one(document, `nol-tab[data-tab-key="${terminal.key}"]`));
  });

  it.each([
    ["disabled", (field: HTMLInputElement): void => { field.disabled = true; }],
    ["hidden", (field: HTMLInputElement): void => { field.hidden = true; }],
    ["removed", (field: HTMLInputElement): void => field.remove()]
  ])("moves the focus to a document's first field when the field it last held is %s by the time its tab is clicked again", async (_, change) => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestNoteComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(plan).openDocument(todo));
    const host = DomFixture.host(fixture);
    const tabOf = (tab: Tab): HTMLElement => DomFixture.one(host, `nol-tab[data-tab-key="${tab.key}"]`);
    const pickAsync = async (tab: Tab): Promise<void> => {
      tabOf(tab).focus();
      tabOf(tab).dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      await settleAsync(fixture);
    };

    await pickAsync(plan);
    const second = DomFixture.oneOf(host, ".second", HTMLInputElement);
    second.focus();
    change(second);
    await pickAsync(todo);
    await pickAsync(plan);

    expect(document.activeElement?.getAttribute("class")).toBe("first");
  });

  it("tries a waiting pointer's request again at most once a frame, however often the document changes meanwhile", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    parts.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestNoteComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(todo).openDocument(plan));
    const host = DomFixture.host(fixture);
    const tab = DomFixture.one(host, `nol-tab[data-tab-key="${todo.key}"]`);
    const traps = vi.spyOn(TestBed.inject(FocusTrapFactory), "create");
    tab.focus();
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await settleAsync(fixture);
    const asked = traps.mock.calls.length;

    const note = DomFixture.one(host, "nol-test-note");
    for (let index = 0; index < 10; index++) {
      note.appendChild(document.createElement("span"));
      await Promise.resolve();
    }
    await settleAsync(fixture);

    expect([asked, traps.mock.calls.length - asked]).toEqual([1, 1]);
    expect(document.activeElement).toBe(tab);
  });

  it("leaves the focus where it is when a tab's close button is clicked, and moves it into the document a tab in a second group shows", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    const notes = new DocumentTab("notes.note", "ideas");
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.contributions.set(notes.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    const opened = Layout.createDefault(registry).openDocument(plan).openDocument(notes).openDocument(todo);
    const fixture = await renderAsync(registry, opened.splitGroup(todo, opened.documents.id, PanelEdge.Right));
    const host = DomFixture.host(fixture);
    const tabOf = (tab: Tab): HTMLElement => DomFixture.one(host, `nol-tab[data-tab-key="${tab.key}"]`);
    const holder = (): string | null => document.activeElement?.closest("[data-tab-content]")?.getAttribute("data-tab-content") ?? document.activeElement?.getAttribute("data-tab-key") ?? null;

    tabOf(todo).focus();
    tabOf(todo).dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await settleAsync(fixture);
    const second = [holder(), document.activeElement?.getAttribute("class")];
    tabOf(plan).focus();
    tabOf(notes).querySelector<HTMLElement>(".nol-tab-close")?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await settleAsync(fixture);

    expect(second).toEqual([todo.key, "first"]);
    expect([holder(), DomFixture.maybe(host, `nol-tab[data-tab-key="${notes.key}"]`)]).toEqual([plan.key, null]);
  });

  it("moves the focus to the dock's strip when a narrower window closes the dock that holds it", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry);
    const host = DomFixture.host(fixture);
    const group = DomFixture.closest(DomFixture.one(host, `[data-tab-key="${LayoutFixture.files.key}"]`), "nol-tab-group");
    const focused = group.appendChild(document.createElement("button"));
    focused.focus();
    fixture.componentInstance.height.set(590);
    await settleAsync(fixture);
    const whileFocused = document.activeElement === focused;
    focused.blur();
    fixture.componentInstance.height.set(600);
    await settleAsync(fixture);
    const whileOpen = document.activeElement;
    focused.focus();

    fixture.componentInstance.width.set(AppearanceFixture.toPixels(40));
    await settleAsync(fixture);

    expect([whileFocused, whileOpen === document.body]).toEqual([true, true]);
    expect(document.activeElement).toBe(host.querySelector(`nol-dock[data-side="Left"] .nol-dock-strip-view[data-view="${LayoutFixture.files.key}"]`));
  });

  it("keeps a dock opened from its strip open beside a dock the person hid while the window resizes", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry, Layout.createDefault(registry).toggleDock(DockSide.Right));
    const host = DomFixture.host(fixture);
    fixture.componentInstance.width.set(AppearanceFixture.toPixels(40));
    await settleAsync(fixture);
    const layout = TestBed.inject(LayoutService);
    const closed = layout.geometry().isCollapsed(DockSide.Left);

    host.querySelector<HTMLElement>("nol-dock[data-side=\"Left\"] .nol-dock-strip-view")?.click();
    await settleAsync(fixture);
    fixture.componentInstance.width.set(AppearanceFixture.toPixels(40) + 1);
    await settleAsync(fixture);

    expect(closed).toBe(true);
    expect(layout.geometry().isCollapsed(DockSide.Left)).toBe(false);
    expect(host.querySelector("nol-dock[data-side=\"Left\"] nol-sash")).not.toBeNull();
  });

  it("leaves the focus where it is when the person moved it while the runtime started again", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const workspace = DomFixture.one(DomFixture.host(fixture), "nol-workspace");
    workspace.appendChild(document.createElement("button")).focus();
    const outside = document.body.appendChild(document.createElement("input"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    outside.focus();
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);
    const active = document.activeElement;
    outside.remove();

    expect(active).toBe(outside);
  });

  it("shows only the middle, with the empty-window card, when there are no modules", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const groups = groupsOf(fixture);
    const margin = AppearanceFixture.toPixels(0.25);

    expect(groups.length).toBe(1);
    expect(groups[0]?.classList.contains("nol-panel-card-shell")).toBe(false);
    expect(groups[0]?.querySelector("nol-empty-window")).not.toBeNull();
    const [x, y, width, height] = boundsOf(groups[0] ?? fixture.nativeElement);
    AppearanceFixture.expectPixels(x ?? 0, margin);
    AppearanceFixture.expectPixels(y ?? 0, 0);
    AppearanceFixture.expectPixels(width ?? 0, 1000 - 2 * margin);
    AppearanceFixture.expectPixels(height ?? 0, 600 - margin);
  });

  it("shows a registered placeholder in the documents group while no document is open, where a document's page shows, and the document once one opens", async () => {
    const { plan } = LayoutFixture;
    parts.placeholder.set(new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestNoteComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const host = DomFixture.host(fixture);
    const layout = TestBed.inject(LayoutService);
    const placeholder = DomFixture.one(host, "nol-placeholder-content");
    const before = [placeholder.closest("nol-panel-card")?.classList.contains("nol-panel-card-shell"), !Object.isNull(placeholder.querySelector(".shell")), host.querySelector("nol-empty-window")];
    const placed = boundsOf(placeholder);

    layout.openDocument(plan);
    await settleAsync(fixture);
    const page = boundsOf(DomFixture.one(host, `[data-tab-content="${plan.key}"]`));
    const opened = host.querySelector("nol-placeholder-content");
    layout.close(plan);
    await settleAsync(fixture);

    expect(before).toEqual([false, true, null]);
    expect(opened).toBeNull();
    for (const [index, value] of placed.entries())
      AppearanceFixture.expectPixels(value, page[index] ?? Number.NaN);
    expect(host.querySelector("nol-placeholder-content .shell")).not.toBeNull();
  });

  it("shows a registered placeholder instead of the empty-window card when there are no views", async () => {
    parts.placeholder.set(new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const host = DomFixture.host(fixture);

    expect([!Object.isNull(host.querySelector("nol-placeholder-content .shell")), host.querySelector("nol-empty-window")]).toEqual([true, null]);
  });

  it("moves the focus to the placeholder's first field when the last document closes with the focus in it, and leaves it where it is otherwise and at the start", async () => {
    const { plan } = LayoutFixture;
    parts.placeholder.set(new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    parts.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const host = DomFixture.host(fixture);
    const layout = TestBed.inject(LayoutService);
    const atStart = document.activeElement;

    layout.openDocument(plan);
    await settleAsync(fixture);
    host.querySelector<HTMLElement>(".shell")?.focus();
    layout.close(plan);
    await settleAsync(fixture);
    const returned = document.activeElement?.className;
    layout.openDocument(plan);
    await settleAsync(fixture);
    const docked = DomFixture.one(host, ".nol-panel-card-shell nol-tab");
    docked.focus();
    layout.close(plan);
    await settleAsync(fixture);

    expect([atStart, returned, document.activeElement]).toEqual([document.body, "first", docked]);
  });

  it("follows the size of its region", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());

    fixture.componentInstance.width.set(800);
    fixture.componentInstance.height.set(500);
    await settleAsync(fixture);

    const [, , width, height] = boundsOf(groupsOf(fixture)[0] ?? fixture.nativeElement);
    AppearanceFixture.expectPixels(width ?? 0, 800 - 2 * AppearanceFixture.toPixels(0.25));
    AppearanceFixture.expectPixels(height ?? 0, 500 - AppearanceFixture.toPixels(0.25));
  });

  it("lays out nothing until the appearance is painted, and then lays out with the painted looks", async () => {
    const painted = signal(0);
    TestBed.overrideProvider(AppearanceService, { useValue: { painted, typography: signal(new Typography()), theme: signal(DefaultTheme.theme) } });
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const layout = TestBed.inject(LayoutService);
    const before = [layout.isMeasured(), groupsOf(fixture).length];

    painted.set(1);
    await settleAsync(fixture);

    expect(before).toEqual([false, 0]);
    expect(layout.isMeasured()).toBe(true);
    expect(groupsOf(fixture).length).toBeGreaterThan(1);
    expect(layout.geometry().dock(DockSide.Left).x).toBe(0.25);
  });

  it("takes its dock sizes, minimums, strip and gaps from the theme's look and lays out again in the same turn as the theme changes", async () => {
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const appearance = TestBed.inject(AppearanceService);
    const layout = TestBed.inject(LayoutService);
    fixture.componentInstance.width.set(2000);
    await settleAsync(fixture);
    const shown = (): readonly number[] => {
      const geometry = layout.geometry();
      const metrics = geometry.metrics;
      return [geometry.dock(DockSide.Left).x, geometry.dock(DockSide.Left).width, geometry.dock(DockSide.Right).width, metrics.gap, metrics.dockMinimum, metrics.strip,
        metrics.documentMinimum, metrics.groupMinimums[SplitAxis.Horizontal], metrics.groupMinimums[SplitAxis.Vertical], metrics.dockSizes[DockSide.Bottom]];
    };
    const standard = shown();

    appearance.setTheme(FixtureTheme.theme);
    fixture.detectChanges();
    const themed = shown();
    await settleAsync(fixture);
    const [x, , width] = boundsOf(groupsOf(fixture).find(t => t.classList.contains("nol-panel-card-shell")) ?? fixture.nativeElement);
    appearance.setTheme(DefaultTheme.theme);
    await settleAsync(fixture);

    expect(standard).toEqual([0.25, 26, 25, 0.25, 10, 2.75, 13.75, 10, 6.25, 12.5]);
    expect(themed).toEqual([0.375, 20, 18, 0.375, 8, 3, 11, 8.5, 5, 12]);
    AppearanceFixture.expectPixels(x ?? 0, AppearanceFixture.toPixels(0.375));
    AppearanceFixture.expectPixels(width ?? 0, AppearanceFixture.toPixels(20));
    expect(shown()).toEqual(standard);
  });

  it("keeps the bottom dock at its default height in the default window, and gives it way in proportion in a shorter one down to its minimum, leaving the rest to the documents", async () => {
    const registry = LayoutFixture.createRegistry();
    const { terminal } = LayoutFixture;
    parts.contributions.set(terminal.key, new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openView(terminal, registry));
    const host: HTMLElement = DomFixture.host(fixture);
    const measureAsync = async (width: number, height: number): Promise<readonly number[]> => {
      fixture.componentInstance.width.set(width);
      fixture.componentInstance.height.set(height);
      await settleAsync(fixture);
      const dock = host.querySelector<HTMLElement>(`[data-tab-content="${terminal.key}"]`)?.closest<HTMLElement>("nol-panel-card") ?? host;
      const documents = groupsOf(fixture).find(t => !t.classList.contains("nol-panel-card-shell")) ?? host;
      return [boundsOf(dock)[3] ?? 0, boundsOf(documents)[3] ?? 0];
    };

    const [wide, short] = [await measureAsync(1280, 744), await measureAsync(905, 560)];

    AppearanceFixture.expectPixels(wide[0] ?? 0, AppearanceFixture.toPixels(12.5));
    AppearanceFixture.expectPixels(wide[1] ?? 0, 744 - AppearanceFixture.toPixels(12.5 + 2 * 0.25));
    AppearanceFixture.expectPixels(short[0] ?? 0, AppearanceFixture.toPixels(10));
    AppearanceFixture.expectPixels(short[1] ?? 0, 560 - AppearanceFixture.toPixels(10 + 2 * 0.25));
  });

  it("grows a dock on screen until its tab's page shows the asked rem inside its padding, and puts the dock's rendered size back at the release", async () => {
    const registry = LayoutFixture.createRegistry();
    const { terminal } = LayoutFixture;
    parts.contributions.set(terminal.key, new ContributionMatch(() => Promise.resolve(TestShellComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openView(terminal, registry));
    const host: HTMLElement = DomFixture.host(fixture);
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const page = (): HTMLElement => host.querySelector<HTMLElement>(`[data-tab-content="${terminal.key}"]`) ?? host;
    const shown = (): number => {
      const style = getComputedStyle(page());
      return (page().clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)) / rem;
    };
    const dock = (): number => page().closest("nol-tab-group")?.getBoundingClientRect().height ?? 0;
    const before = [shown(), dock()] as const;

    const release = TestBed.inject(DockGrowthService).grow(terminal, before[0] + 6);
    await settleAsync(fixture);
    const grown = [shown(), dock()] as const;
    release();
    await settleAsync(fixture);

    expect(page()).not.toBe(host);
    expect(before[1]).toBeGreaterThan(0);
    expect(grown[0]).toBeGreaterThanOrEqual(before[0] + 6 - 0.05);
    expect(grown[1] - before[1]).toBeCloseTo((grown[0] - before[0]) * rem, 0);
    expect(dock()).toBeCloseTo(before[1], 0);
  });

  it("shows docked groups on the shell surface and leaves the documents without the empty-window card", async () => {
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const groups = groupsOf(fixture);
    const docked = groups.filter(t => t.classList.contains("nol-panel-card-shell"));

    expect(docked.length).toBe(groups.length - 1);
    expect(docked.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector("nol-empty-window")).toBeNull();
    expect(fixture.nativeElement.querySelector("nol-placeholder-content")).toBeNull();
    expect(getComputedStyle(docked[0] ?? fixture.nativeElement).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "window"));
  });

  it("moves an open tab's view into a dialog that shows it, takes the tab out of its strip for the group's next tab without changing the saved layout, and puts both back once the dialog closes", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(todo).openDocument(plan));
    const host: HTMLElement = DomFixture.host(fixture);
    const layout = TestBed.inject(LayoutService);
    const dialogs = TestBed.inject(ViewDialogService);
    const saved = layout.layout();
    const documents = (): HTMLElement => DomFixture.one(host, `nol-tab-group[data-group="${saved.documents.id}"]`);
    const strip = (): readonly (string | null)[] => [...documents().querySelectorAll(".nol-tab")].map(t => t.getAttribute("data-tab-key"));
    const selected = (): string | null => documents().querySelector(".nol-tab-selected")?.getAttribute("data-tab-key") ?? null;
    const shownView = (): Element | null => documents().querySelector("nol-tab-content:not([inert])");
    const before = [...host.querySelectorAll("nol-tab-content")];
    const planView = shownView();

    const shown = dialogs.showAsync(plan);
    await settleAsync(fixture);
    const whileShown = [strip(), selected(), layout.layout() === saved];
    const inDialog = [...document.querySelectorAll("nol-view-dialog nol-tab-content")];
    const nextView = shownView();
    dialogs.close();
    await shown;
    await settleAsync(fixture);

    expect([strip(), selected()]).toEqual([[todo.key, plan.key], plan.key]);
    expect(whileShown).toEqual([[todo.key], todo.key, true]);
    expect([inDialog.length, inDialog[0] === planView, before.some(t => t === nextView)]).toEqual([1, true, false]);
    expect([shownView() === planView, layout.layout() === saved]).toEqual([true, true]);
    expect(new Set(host.querySelectorAll("nol-tab-content"))).toEqual(new Set([...before, nextView]));
    expect(nextView?.hasAttribute("inert")).toBe(true);
  });

  it("renders the docks with their sashes, the groups, the split sashes and the docking guides", async () => {
    const registry = LayoutFixture.createRegistry();
    const layout = Layout.createDefault(registry).openView(LayoutFixture.search, registry).splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom);
    const fixture = await renderAsync(registry, layout);
    const host: HTMLElement = DomFixture.host(fixture);

    expect([...host.querySelectorAll("nol-tab-group")].map(t => t.getAttribute("data-group"))).toEqual(["2", "3", "4", "0"]);
    expect([...host.querySelectorAll("nol-dock nol-sash")].map(t => t.getAttribute("aria-label"))).toEqual(["Resize the left dock", "Resize the right dock"]);
    expect(host.querySelectorAll("nol-split-sash").length).toBe(1);
    expect(host.querySelector("nol-docking-guides")).not.toBeNull();
  });

  it("moves the focus into a view a part shows once the view shows a field, keeping it on the view's tab while the view's part still loads", async () => {
    const registry = LayoutFixture.createRegistry();
    const { search } = LayoutFixture;
    TestLateComponent.isReady.set(false);
    parts.contributions.set(search.key, new ContributionMatch(() => Promise.resolve(TestLateComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry);
    const focused = (): string | null => document.activeElement?.getAttribute("data-tab-key") ?? document.activeElement?.getAttribute("class") ?? null;

    TestBed.inject(ViewInstancesService).show(search);
    await settleAsync(fixture);
    const loading = focused();
    TestLateComponent.isReady.set(true);
    await settleAsync(fixture);

    expect([loading, focused()]).toEqual([search.key, "late"]);
  });

  it("moves the focus to the strip of a dock a part hides when the dock held it, and leaves it where it is otherwise", async () => {
    const registry = LayoutFixture.createRegistry();
    const { files, plan } = LayoutFixture;
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(plan));
    const host = DomFixture.host(fixture);
    const instances = TestBed.inject(ViewInstancesService);
    const layout = TestBed.inject(LayoutService);
    const tabOf = (tab: Tab): HTMLElement => DomFixture.one(host, `nol-tab[data-tab-key="${tab.key}"]`);

    tabOf(plan).focus();
    instances.hideDock(files);
    await settleAsync(fixture);
    const outside = document.activeElement === tabOf(plan);
    layout.toggleDock(DockSide.Left);
    await settleAsync(fixture);
    tabOf(files).focus();
    instances.hideDock(files);
    await settleAsync(fixture);

    expect(outside).toBe(true);
    expect(document.activeElement).toBe(host.querySelector(`nol-dock[data-side="Left"] .nol-dock-strip-view[data-view="${files.key}"]`));
  });

  it("keeps a part's request for the focus in a view it shows through a held shortcut's repeated keydown on the view's tab, and drops it on a key pressed elsewhere, keeping the person's focus", async () => {
    const registry = LayoutFixture.createRegistry();
    const { search } = LayoutFixture;
    parts.contributions.set(search.key, new ContributionMatch(() => Promise.resolve(TestLateComponent), null, ContentPadding.Default));
    const fixture = await renderAsync(registry);
    const instances = TestBed.inject(ViewInstancesService);
    const text = document.body.appendChild(document.createElement("p"));
    const focused = (): string | null => document.activeElement?.getAttribute("data-tab-key") ?? document.activeElement?.getAttribute("class") ?? null;
    const waitAsync = async (press: () => void): Promise<string | null> => {
      TestLateComponent.isReady.set(false);
      await settleAsync(fixture);
      instances.show(search);
      await settleAsync(fixture);
      press();
      TestLateComponent.isReady.set(true);
      await settleAsync(fixture);
      return focused();
    };

    try {
      const repeated = await waitAsync(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true, repeat: true, bubbles: true })));
      const elsewhere = await waitAsync(() => text.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true })));

      expect([repeated, elsewhere]).toEqual(["late", search.key]);
    }
    finally {
      text.remove();
    }
  });
});
