/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, ErrorHandler, type Signal, computed, inject } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { TooltipDirective } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { TabGroupComponent } from "../../../../src/app/components/tab-group/tab-group.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { BuildTokens } from "../../../../src/app/models/build-tokens";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { Layout } from "../../../../src/app/models/layout/layout";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { MenuItem } from "../../../../src/app/models/menu-item";
import { CommandService } from "../../../../src/app/services/command.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { TabLabelService } from "../../../../src/app/services/tab-label.service";
import { TabStripService } from "../../../../src/app/services/tab-strip.service";
import { ToolbarService } from "../../../../src/app/services/toolbar.service";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

@Component({
  imports: [TabGroupComponent],
  template: `
    <div class="workspace">
      @for (frame of frames(); track frame.group.id) {
        <nol-tab-group [frame]="frame" />
      }
    </div>
  `,
  styles: [".workspace { position: relative; width: 1920px; height: 960px; }"]
})
class TabGroupHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  public readonly frames: Signal<readonly GroupFrame[]> = computed(() => this.layout.geometry().frames);
}

describe("TabRowActionsComponent", () => {
  const first = new ViewTab("terminal.shell", "1");
  const second = new ViewTab("terminal.shell", "2");
  const registry = new ViewRegistry([
    new ViewType("files.tree", DockSide.Left, true),
    new ViewType("git.changes", DockSide.Right, true),
    new ViewType("terminal.shell", DockSide.Bottom, false, true, "terminal.tabRow")
  ], ["notes.note"]);
  const base = Layout.createDefault(registry).openView(second, registry);
  const prepared = new TabDropTarget(base.dock(DockSide.Left).root?.cornerGroup.id ?? -1, 1).place(base, first);
  let bridge: PreloadBridgeFixture;
  let runs: string[];
  let fixture: ComponentFixture<TabGroupHostComponent>;
  let layout: LayoutService;

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    runs = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BuildTokens.menus, useValue: [MenuDeclarations.fromJson("ssh", {
            places: [],
            groups: [
              { name: "ssh.tabRowActions", place: "terminal.tabRow", exclusive: false, items: [{ command: "ssh.connect", arguments: { host: "build" }, label: "Connect to build" }] },
              { name: "ssh.shellList", place: "terminal.shells", exclusive: false, items: [{ command: "ssh.connect", arguments: { host: "build" }, label: "ssh build" }] }
            ]
          }), MenuDeclarations.fromJson("terminal", {
            places: [{ name: "terminal.tabRow", title: "Terminal tabs", shows: "menu" }, { name: "terminal.shells", title: "Choose a shell", shows: "menu" }],
            groups: [
              { name: "terminal.tabRowActions", place: "terminal.tabRow", exclusive: false, items: [{ command: "terminal.new", arguments: {} }, { command: "terminal.split", arguments: {} }] },
              { name: "terminal.tabRowShells", place: "terminal.tabRow", exclusive: false, items: [{ submenu: "terminal.shells" }] },
              { name: "terminal.shellList", place: "terminal.shells", exclusive: false, items: [{ command: "terminal.new", arguments: { shell: "bash" }, label: "bash" }] },
              { name: "terminal.tabRowProfiles", place: "terminal.tabRow", exclusive: false, dynamic: true }
            ]
          })]
        }
      ]
    });
    const run = async (name: string, value: unknown): Promise<null> => {
      runs.push(`${name} ${JSON.stringify(value)}`);
      return null;
    };
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("terminal.new", "New terminal", "add", null, t => run("terminal.new", t)),
      new CommandContribution("terminal.split", "Split terminal", null, null, t => run("terminal.split", t), () => false),
      new CommandContribution("ssh.connect", "Connect", "lan", null, t => run("ssh.connect", t))
    ]);
    TestBed.inject(MenuService).setActiveModules(["terminal"]);
    layout = await LayoutServiceFixture.prepareAsync(registry, prepared);
    fixture = TestBed.createComponent(TabGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
    document.querySelector(".cdk-overlay-container")?.replaceChildren();
  });

  function group(tab: ViewTab): HTMLElement {
    const id = layout.layout().groupOf(tab)?.id;
    const root: HTMLElement = DomFixture.host(fixture);
    const found = root.querySelector<HTMLElement>(`nol-tab-group[data-group="${id}"]`);
    if (Object.isNull(found))
      throw new Error(`No group holds ${tab.key}.`);
    return found;
  }

  function actions(tab: ViewTab): HTMLButtonElement[] {
    return [...group(tab).querySelectorAll<HTMLButtonElement>(".nol-tab-group-actions button")];
  }

  function button(tab: ViewTab, label: string): HTMLButtonElement {
    const found = actions(tab).find(t => t.getAttribute("aria-label") === label);
    if (Object.isUndefined(found))
      throw new Error(`No button is named ${label}.`);
    return found;
  }

  function part(tab: ViewTab, selector: string): HTMLElement {
    const found = group(tab).querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing in ${tab.key}'s group matches ${selector}.`);
    return found;
  }

  async function settleAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function addDependentAsync(): Promise<void> {
    TestBed.inject(MenuService).setActiveModules(["terminal", "ssh"]);
    await settleAsync();
  }

  it("shows the place's rows as named buttons in every group holding the view's tabs, after the tabs and before the group's own buttons", () => {
    const changes = layout.layout().dock(DockSide.Right).root?.cornerGroup.id;
    const root: HTMLElement = DomFixture.host(fixture);
    const others = root.querySelector(`nol-tab-group[data-group="${changes}"]`);

    for (const tab of [first, second]) {
      const names = actions(tab).map(t => t.getAttribute("aria-label"));
      expect(names.slice(0, 4)).toEqual(["New terminal", "Split terminal", "Choose a shell", "Panel actions"]);
      expect(group(tab).querySelector("nol-tab:last-of-type")?.compareDocumentPosition(button(tab, "New terminal"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect([button(first, "New terminal").textContent?.trim(), button(first, "Split terminal").textContent?.trim(), button(first, "Choose a shell").textContent?.trim()])
      .toEqual(["add", "play_arrow", "keyboard_arrow_down"]);
    expect(others?.querySelectorAll(".nol-tab-group-actions button").length).toBe(2);
    expect(others?.querySelectorAll("nol-tab-row-actions button").length).toBe(0);
  });

  it("keeps a long selected tab that isn't first ending where the folded buttons start as its row's commands go and come back", async () => {
    TestBed.inject(TabLabelService).setTitle(first, "Terminal of a project with a long name");
    layout.resizeDock(DockSide.Left, 16);
    layout.activate(first);
    await settleAsync();
    const scroller = (): HTMLElement => part(first, ".nol-tab-group-scroller");
    const bar = (): HTMLElement => part(first, ".nol-tab-group-scroller > .nol-tab-group-actions");
    const scrollTolerance = 1 / devicePixelRatio;
    const settledWidthAsync = async (): Promise<number> => {
      await vi.waitFor(() => {
        const width = bar().getBoundingClientRect().width;
        const tab = part(first, `nol-tab[data-tab-key="${first.key}"]`).getBoundingClientRect();
        expect(scroller().style.getPropertyValue("--nol-tab-group-actions-width")).toBe(`${width}px`);
        expect(Math.abs(bar().getBoundingClientRect().left - tab.right)).toBeLessThan(scrollTolerance);
      });
      return bar().getBoundingClientRect().width;
    };
    const before = actions(first).length;
    const widest = await settledWidthAsync();

    TestBed.inject(MenuService).setActiveModules([]);
    await settleAsync();
    const narrower = await settledWidthAsync();
    const without = actions(first).length;
    TestBed.inject(MenuService).setActiveModules(["terminal"]);
    await settleAsync();

    expect(await settledWidthAsync()).toBe(widest);
    expect(narrower).toBe(widest);
    expect([before, without, actions(first).length]).toEqual([2, 2, 2]);
  });

  it("follows its row's buttons in the strip's actions width as they go and come back while its row fits", async () => {
    TestBed.inject(TabLabelService).setTitle(first, "Terminal of a project with a long name");
    layout.resizeDock(DockSide.Left, 40);
    layout.activate(first);
    await settleAsync();
    const scroller = (): HTMLElement => part(first, ".nol-tab-group-scroller");
    const bar = (): HTMLElement => part(first, ".nol-tab-group-scroller > .nol-tab-group-actions");
    const settledWidthAsync = async (): Promise<number> => {
      await vi.waitFor(() => {
        const width = bar().getBoundingClientRect().width;
        const tab = part(first, `nol-tab[data-tab-key="${first.key}"]`).getBoundingClientRect();
        expect(scroller().style.getPropertyValue("--nol-tab-group-actions-width")).toBe(`${width}px`);
        expect(tab.right).toBeLessThanOrEqual(bar().getBoundingClientRect().left);
      });
      return bar().getBoundingClientRect().width;
    };
    const before = actions(first).length;
    const widest = await settledWidthAsync();

    TestBed.inject(MenuService).setActiveModules([]);
    await settleAsync();
    const narrower = await settledWidthAsync();
    const without = actions(first).length;
    TestBed.inject(MenuService).setActiveModules(["terminal"]);
    await settleAsync();

    expect(await settledWidthAsync()).toBe(widest);
    expect(narrower).toBeLessThan(widest);
    expect([group(first).querySelector(".nol-tab-group-overflow"), without, actions(first).length]).toEqual([null, before - 3, before]);
  });

  it("folds its rows and the panel actions into the overflow list while its row overflows, runs them from there, and shows them as buttons again once the row fits", async () => {
    const id = layout.layout().groupOf(first)?.id;
    TestBed.inject(TabLabelService).setTitle(first, "Terminal of a project with a long name");
    layout.resizeDock(DockSide.Left, 10);
    layout.activate(first);
    await settleAsync();
    await vi.waitFor(() => expect(group(first).querySelector(".nol-tab-group-overflow")).not.toBeNull());
    const folded = actions(first).map(t => t.getAttribute("aria-label"));
    part(first, ".nol-tab-group-overflow").click();
    await settleAsync();
    const menu = DomFixture.one(document, ".cdk-overlay-container .nol-tab-group-overflow-menu");
    const listed = [...menu.querySelectorAll(".nol-menu-item-label")].map(t => t.textContent?.trim()).slice(0, 5);
    DomFixture.oneOf(menu, "[data-command='terminal.split']", HTMLButtonElement).click();
    DomFixture.oneOf(menu, "[data-command='terminal.new']", HTMLButtonElement).click();
    await settleAsync();
    layout.resizeDock(DockSide.Left, 40);
    await settleAsync();
    await vi.waitFor(() => expect(group(first).querySelector(".nol-tab-group-overflow")).toBeNull());

    expect(folded).toEqual(["Show all tabs", "Hide the left dock"]);
    expect(listed).toEqual(["New terminal", "Split terminal", "Choose a shell", "Panel actions", "Close all"]);
    expect(runs).toEqual([`terminal.new {"tabGroup":"${id}"}`]);
    expect(actions(first).map(t => t.getAttribute("aria-label"))).toEqual(["New terminal", "Split terminal", "Choose a shell", "Panel actions", "Hide the left dock"]);
  });

  it("walks the folded rows in the overflow list by keyboard, with the arrows, Home, End and typeahead, a disabled one included", async () => {
    TestBed.inject(TabLabelService).setTitle(first, "Terminal of a project with a long name");
    layout.resizeDock(DockSide.Left, 10);
    layout.activate(first);
    await settleAsync();
    await vi.waitFor(() => expect(group(first).querySelector(".nol-tab-group-overflow")).not.toBeNull());
    TestBed.inject(TabStripService).showList(layout.layout().groupOf(first)?.id ?? -1);
    await settleAsync();
    const label = (): string | undefined => document.activeElement?.querySelector(".nol-menu-item-label")?.textContent?.trim();
    const press = (key: string, keyCode: number): void => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, keyCode, bubbles: true, cancelable: true }));
    };
    const walked = [label(), ...Array.from({ length: 3 }, () => {
      press("ArrowDown", 40);
      return label();
    })];
    press("End", 35);
    const last = document.activeElement;
    press("Home", 36);
    const home = label();
    press("p", 80);
    await vi.waitFor(() => expect(label()).toBe("Panel actions"));

    expect(walked).toEqual(["New terminal", "Split terminal", "Choose a shell", "Panel actions"]);
    expect(last).toBe([...document.querySelectorAll(".cdk-overlay-container .nol-tab-group-overflow-tab")].at(-1));
    expect(home).toBe("New terminal");
  });

  it("unfolds once its row's commands go while it is folded and its row fits without them", async () => {
    layout.resizeDock(DockSide.Left, 40);
    layout.activate(first);
    await settleAsync();
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const scroller = part(first, ".nol-tab-group-scroller");
    const rows = [...group(first).querySelectorAll<HTMLElement>("nol-tab-row-actions button")].map(t => t.getBoundingClientRect());
    const lastTab = [...group(first).querySelectorAll<HTMLElement>("nol-tab")].map(t => t.getBoundingClientRect()).at(-1);
    const content = (lastTab?.right ?? Number.NaN) - scroller.getBoundingClientRect().left + part(first, ".nol-tab-group-scroller > .nol-tab-group-actions").getBoundingClientRect().width;
    const rowsWidth = (rows.at(-1)?.right ?? Number.NaN) - (rows[0]?.left ?? Number.NaN);
    layout.resizeDock(DockSide.Left, 40 - (scroller.clientWidth - content + rowsWidth / 2) / rem);
    await settleAsync();
    await vi.waitFor(() => expect(group(first).querySelector(".nol-tab-group-overflow")).not.toBeNull());

    TestBed.inject(MenuService).setActiveModules([]);
    await settleAsync();
    await vi.waitFor(() => expect(group(first).querySelector(".nol-tab-group-overflow")).toBeNull());

    expect([rows.length, actions(first).map(t => t.getAttribute("aria-label"))]).toEqual([3, ["Panel actions", "Hide the left dock"]]);
  });

  it("shows a row's own icon on its button in place of its command's, and its command's on a row without one", async () => {
    TestBed.inject(MenuService).provideGroup("terminal.tabRowProfiles", () => [MenuItem.ofCommand("terminal.new", { shell: "zsh" }, "zsh", "terminal")]);
    await settleAsync();

    expect([button(second, "zsh"), button(second, "New terminal")].map(t => t.querySelector(".material-symbols-rounded")?.textContent?.trim())).toEqual(["terminal", "add"]);
  });

  it("shows a dependent module's group in its dependency's tab-row place after the dependency's own groups, and runs the dependent's command with the row's group id", async () => {
    const id = layout.layout().groupOf(second)?.id;
    await addDependentAsync();
    const names = actions(second).map(t => t.getAttribute("aria-label"));
    const connect = button(second, "Connect to build");
    const panel = button(second, "Panel actions");
    connect.click();
    await settleAsync();

    expect(names.slice(0, 5)).toEqual(["New terminal", "Split terminal", "Choose a shell", "Connect to build", "Panel actions"]);
    expect(button(second, "Choose a shell").compareDocumentPosition(connect)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(connect.compareDocumentPosition(panel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(connect.querySelector(".material-symbols-rounded")?.textContent?.trim()).toBe("lan");
    expect(runs).toEqual([`ssh.connect {"tabGroup":"${id}","host":"build"}`]);
  });

  it("shows a dependent module's group in its dependency's submenu that a tab-row button opens, after the dependency's own rows, and runs the dependent's command with the row's group id", async () => {
    const id = layout.layout().groupOf(second)?.id;
    await addDependentAsync();
    button(second, "Choose a shell").click();
    await settleAsync();
    const shells = DomFixture.one(document, ".cdk-overlay-container nol-menu[data-place='terminal.shells']");
    const labels = [...shells.querySelectorAll(".nol-menu-item-label")].map(t => t.textContent?.trim());
    DomFixture.oneOf(shells, "[data-command='ssh.connect']", HTMLButtonElement).click();
    await settleAsync();

    expect(labels).toEqual(["bash", "ssh build"]);
    expect(runs).toEqual([`ssh.connect {"tabGroup":"${id}","host":"build"}`]);
  });

  it("keeps the place out of the toolbar band and the Toolbars list", () => {
    const toolbars = TestBed.inject(ToolbarService);
    const listed = TestBed.inject(MenuService).resolve("desktop.toolbars").flatMap(t => t.rows).map(t => t.title);
    const root: HTMLElement = DomFixture.host(fixture);

    expect(toolbars.places().map(t => t.name)).not.toContain("terminal.tabRow");
    expect(listed).not.toContain("Terminal tabs");
    expect(root.querySelector("[data-place='terminal.tabRow']")).toBeNull();
  });

  it("runs a row's command with its group's id, never one that is not enabled, and gives the submenu's rows the id too", async () => {
    const id = layout.layout().groupOf(second)?.id;
    button(second, "New terminal").click();
    button(second, "Split terminal").click();
    button(second, "Choose a shell").click();
    await settleAsync();
    const shells = document.querySelector<HTMLElement>(".cdk-overlay-container nol-menu[data-place='terminal.shells']");
    shells?.querySelector<HTMLButtonElement>("[data-command='terminal.new']")?.click();
    await settleAsync();

    expect(button(second, "Split terminal").getAttribute("aria-disabled")).toBe("true");
    expect(runs).toEqual([`terminal.new {"tabGroup":"${id}"}`, `terminal.new {"tabGroup":"${id}","shell":"bash"}`]);
  });

  it("names a row's key in its tooltip and reports a command that fails", async () => {
    const errors: unknown[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation((error: unknown) => errors.push(error));
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("terminal.new", "New terminal", "add", "Mod+Alt+T", () => Promise.reject(new Error("The terminal did not start."))),
      new CommandContribution("terminal.split", "Split terminal", null, null, () => Promise.resolve(null), () => false)
    ]);
    await settleAsync();
    const tooltips = fixture.debugElement.queryAll(By.css("nol-tab-row-actions .nol-tab-row-command")).map(t => t.injector.get(TooltipDirective).text());
    button(second, "New terminal").click();
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect(tooltips.slice(0, 2)).toEqual(["New terminal (Ctrl+Alt+T)", "Split terminal"]);
    expect(errors.map(t => String(t))).toEqual(["Error: The terminal did not start."]);
  });

  it("reaches every button by keyboard, a disabled one included, in the tab row's order", () => {
    const row = actions(second);

    expect(row.map(t => t.tabIndex)).toEqual(row.map(() => 0));
    expect(row.map(t => t.getAttribute("aria-label")).slice(0, 3)).toEqual(["New terminal", "Split terminal", "Choose a shell"]);
    expect(row.map(t => t.closest(".nol-tab-group-actions"))).toEqual(row.map(() => group(second).querySelector(".nol-tab-group-actions")));
  });

  it("lines its buttons up with the group's own buttons, in a tab strip and a one-view header, in both directions", async () => {
    AppearanceFixture.apply();
    const measure = (tab: ViewTab): { tops: number[]; heights: number[]; gaps: number[] } => {
      const rects = actions(tab).map(t => t.getBoundingClientRect());
      const isReversed = document.documentElement.dir === "rtl";
      return {
        tops: rects.map(t => t.top - (rects[0]?.top ?? Number.NaN)),
        heights: rects.map(t => t.height - (rects[0]?.height ?? Number.NaN)),
        gaps: rects.slice(1).map((t, index) => isReversed ? (rects[index]?.left ?? Number.NaN) - t.right : t.left - (rects[index]?.right ?? Number.NaN))
      };
    };
    const strip = measure(second);
    document.documentElement.dir = "rtl";
    await settleAsync();
    const reversed = measure(second);
    document.documentElement.removeAttribute("dir");
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    layout.activate(first);
    await settleAsync();
    const header = Object.isNull(group(first).querySelector(".nol-tab-group-header")) ? null : measure(first);
    AppearanceFixture.reset();

    expect(header).not.toBeNull();
    for (const shown of [strip, reversed, header ?? strip]) {
      for (const offset of [...shown.tops, ...shown.heights])
        AppearanceFixture.expectPixels(offset, 0);
      for (const gap of shown.gaps)
        AppearanceFixture.expectPixels(gap, shown.gaps.at(-1) ?? Number.NaN);
    }
    expect(strip.gaps.length).toBe(4);
  });
});
