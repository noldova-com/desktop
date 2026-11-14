/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";
import { ModuleState, ModuleStatus, ProgramStatus, type SettingDefinition } from "@noldova/desktop.protocol";

import { ModulesComponent } from "../../../../src/app/components/modules/modules.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../../src/app/services/command.service";
import { ModuleSelectionService } from "../../../../src/app/services/module-selection.service";
import { ModuleStatusService } from "../../../../src/app/services/module-status.service";
import { ProgramStatusService } from "../../../../src/app/services/program-status.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { AppearanceFixture, TooltipFixture as KitTooltipFixture } from "@noldova/ui.components.angular/testing";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { InkFixture } from "../../../fixtures/ink.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { SettingsFixture } from "../../../fixtures/settings.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";

describe("ModulesComponent", () => {
  const clock = new ModuleStatus("clock", "1.4.2", "Clock", "Tells the time.", [], new Map([
    ["commands", ["clock.tick", "clock.gone"]], ["settings", ["clock.tickStep", "clock.oldStep"]], ["views", ["clock.face"]], ["methods", ["clock.time"]]
  ]), ModuleState.Active, null);
  const notes = new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map([["menus", ["notes.tools"]], ["notifications", ["notes.saved"]]]),
    ModuleState.Failed, "Its runtime part could not be loaded.");
  const alarm = new ModuleStatus("alarm", "0.0.1", "Alarm", "Rings at a time.", ["clock", "notes"], new Map(), ModuleState.Blocked, "It depends on notes, which is not active.", "notes");
  let fixture: ComponentFixture<ModulesComponent>;
  let modules: WritableSignal<readonly ModuleStatus[]>;
  let programs: WritableSignal<readonly ProgramStatus[]>;
  let isShown: WritableSignal<boolean>;
  let values: WritableSignal<ReadonlyMap<string, JsonValue>>;
  let bridge: PreloadBridgeFixture;
  let errors: unknown[];

  async function renderAsync(mode: ThemeMode = ThemeMode.Light): Promise<HTMLElement> {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    fixture = TestBed.createComponent(ModulesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return DomFixture.host(fixture);
  }

  const element = (): HTMLElement => DomFixture.host(fixture);
  const texts = (selector: string): readonly string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.replace(/\s+/gu, " ").trim() ?? String.empty);
  const parts = (selector: string): readonly (readonly string[])[] => [...element().querySelectorAll(selector)].map(t => {
    const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    const found: string[] = [];
    while (!Object.isNull(walker.nextNode())) {
      const text = walker.currentNode.textContent?.trim() ?? String.empty;
      if (text.length > 0)
        found.push(text);
    }
    return found;
  });
  const row = (id: string): HTMLButtonElement => DomFixture.oneOf(element(), `.nol-modules-row[data-module='${id}']`, HTMLButtonElement);
  const group = (kind: string): HTMLButtonElement => DomFixture.oneOf(element(), `.nol-modules-group[data-kind='${kind}'] button`, HTMLButtonElement);
  const rem = (pixels: string): number => Number.parseFloat(pixels) / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const find = <T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T => {
    const found = root.querySelector(selector);
    if (!(found instanceof type))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const link = (fact: string, name: string): HTMLButtonElement =>
    DomFixture.present([...element().querySelectorAll<HTMLButtonElement>(`.nol-modules-fact-${fact} .nol-modules-link`)].find(t => t.textContent?.trim() === name));

  async function settleAsync(): Promise<void> {
    for (let turn = 0; turn < 10; turn++)
      await Promise.resolve();
  }

  function click(button: HTMLButtonElement): void {
    button.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install("linux");
    modules = signal([clock, notes, alarm]);
    programs = signal([]);
    isShown = signal(true);
    values = signal(new Map());
    errors = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: ModuleStatusService, useValue: { modules } },
        { provide: WindowPartTokens.shown, useValue: isShown },
        { provide: ProgramStatusService, useValue: { ofModule: (id: string) => programs().filter(t => t.moduleId === id) } },
        { provide: SettingsService, useValue: { definitions: signal<readonly SettingDefinition[]>(SettingsFixture.all), values } },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        KitTooltipFixture.atOnce
      ]
    });
    TestBed.inject(CommandService).setCommands([new CommandContribution("clock.tick", "Tick the clock", null, null, () => Promise.resolve(null))]);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await userEvent.unhover(document.body);
    vi.restoreAllMocks();
    PreloadBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  it("lists every module in module order with its name, state, id, version and description, and shows the first with Noldova Desktop Sample's version", async () => {
    await renderAsync();

    expect(texts(".nol-modules-title")).toEqual(["Modules"]);
    expect(texts(".nol-modules-version")).toEqual(["Noldova Desktop Sample 1.2.3"]);
    expect(parts(".nol-modules-row")).toEqual([
      ["Clock", "Active", "clock", "1.4.2", "Tells the time."],
      ["Notes", "error", "Failed", "notes", "0.0.1", "Keeps notes."],
      ["Alarm", "error", "Blocked", "alarm", "0.0.1", "Rings at a time."]
    ]);
    expect(texts("[aria-current=true]")).toEqual([texts(".nol-modules-row")[0]]);
    expect(element().querySelector("nav")?.getAttribute("aria-label")).toBe("Modules");
    expect(texts(".nol-modules-detail-title")).toEqual(["Clock"]);
    expect(element().querySelector(".nol-modules-detail")?.getAttribute("aria-labelledby")).toBe(element().querySelector(".nol-modules-detail-title")?.id);
    expect(texts(".nol-modules-facts:first-of-type dt")).toEqual(["Version", "State", "Depends on", "Needed by"]);
    expect([texts(".nol-modules-fact-version"), texts(".nol-modules-fact-state"), texts(".nol-modules-fact-dependencies"), texts(".nol-modules-fact-dependents")]).toEqual([["1.4.2"], ["Active"], ["None"], ["Alarm"]]);
    expect([texts(".nol-modules-group .nol-group-header-title"), texts(".nol-modules-group .nol-group-header-count")]).toEqual([["Commands", "Settings", "Views"], ["2", "2", "1"]]);
    expect(errors).toEqual([]);
  });

  it("starts each kind of contribution closed with its count, and opens it to the full list it names as the region it controls", async () => {
    await renderAsync();
    const closed = [[...element().querySelectorAll(".nol-modules-group button")].map(t => t.getAttribute("aria-expanded")), element().querySelectorAll(".nol-modules-contributions").length];

    click(group("commands"));
    click(group("views"));
    const opened = [[...element().querySelectorAll(".nol-modules-contributions")].map(t => t.getAttribute("data-kind")), parts(".nol-modules-contribution")];
    const controls = [group("commands").getAttribute("aria-controls"), element().querySelector(".nol-modules-contributions[data-kind='commands']")?.id];
    click(group("commands"));

    expect(closed).toEqual([["false", "false", "false"], 0]);
    expect(opened).toEqual([["commands", "views"], [["Tick the clock", "clock.tick"], ["clock.gone"], ["clock.face"]]]);
    expect(controls[0]).toBe(controls[1]);
    expect([group("commands").getAttribute("aria-expanded"), group("commands").hasAttribute("aria-controls"), texts(".nol-modules-contribution")]).toEqual(["false", false, ["clock.face"]]);
  });

  it("starts another module's contributions closed, and keeps a module's open groups when it is shown again", async () => {
    await renderAsync();
    click(group("settings"));

    click(row("notes"));
    const other = [texts(".nol-modules-group .nol-group-header-title"), element().querySelectorAll(".nol-modules-contributions").length];
    click(row("clock"));

    expect(other).toEqual([["Menus", "Notification kinds"], 0]);
    expect(parts(".nol-modules-contribution")).toEqual([["Tick step", "clock.tickStep"], ["clock.oldStep"]]);
  });

  it("starts the groups' twisties' ink, folded and open, at the sections' and programs' left edge, indents an open list to its group's title, and leaves 2rem above each section", async () => {
    programs.set([new ProgramStatus("clock", "/usr/bin/node", 4210, new Date(), false)]);
    const host = await renderAsync();
    click(group("commands"));
    const box = (selector: string): DOMRect => DomFixture.one(host, selector).getBoundingClientRect();
    const header = box(".nol-modules-group[data-kind='commands']");
    const title = box(".nol-modules-group[data-kind='commands'] .nol-group-header-title");
    const twisties: number[] = [];
    for (const button of host.querySelectorAll(".nol-modules-group button"))
      twisties.push(await InkFixture.startAsync(button, DomFixture.one(button, ".nol-group-header-title")));
    const edges = [...host.querySelectorAll(".nol-modules-section-title"), DomFixture.oneOf(host, ".nol-modules-program", Element)].map(t => t.getBoundingClientRect().left);
    const first = box(".nol-modules-contribution");
    const section = getComputedStyle(DomFixture.present(host.querySelectorAll(".nol-modules-section-title")[1]));
    const [start = Number.NaN] = edges;

    expect(twisties).toHaveLength(3);
    expect(edges.map(t => t - start)).toEqual(Array.from({ length: 3 }, () => expect.closeTo(0, 0)));
    expect(twisties.map(t => Math.abs(t - start) < 1.5 / devicePixelRatio)).toEqual([true, true, true]);
    expect(first.left).toBeCloseTo(title.left, 0);
    expect(first.top).toBeGreaterThanOrEqual(header.bottom);
    expect([rem(section.marginTop), rem(section.marginBottom)]).toEqual([2, 0.75]);
  });

  it("indents an open list to its group's title by the theme's icon size", async () => {
    const host = await renderAsync();
    host.style.setProperty("--nol-icon", "1.5rem");
    click(group("commands"));
    const box = (selector: string): DOMRect => find(host, selector, HTMLElement).getBoundingClientRect();
    const twistie = box(".nol-modules-group[data-kind='commands'] .nol-group-header-twistie");
    const title = box(".nol-modules-group[data-kind='commands'] .nol-group-header-title");

    expect(rem(`${twistie.width}px`)).toBeCloseTo(1.5, 1);
    expect(box(".nol-modules-contribution").left).toBeCloseTo(title.left, 0);
  });

  it("scrolls its list up to its details and its details to its own end edge, with the space before and after the details inside them, on both sides of the page", async () => {
    const host = await renderAsync();
    host.style.width = "100rem";
    host.style.height = "20rem";
    const scroller = DomFixture.one(host, ".nol-modules-detail-scroller");
    const edges = ["ltr", "rtl"].map(direction => {
      host.dir = direction;
      const isLeft = direction === "ltr";
      const whole = host.getBoundingClientRect();
      const box = (selector: string): DOMRect => DomFixture.one(host, selector).getBoundingClientRect();
      const header = box(".nol-modules-header");
      const list = box(".nol-modules-list");
      const scrolling = box(".nol-modules-detail-scroller");
      const detail = box(".nol-modules-detail");
      const start = (box: DOMRect): number => isLeft ? box.left : whole.right - box.right;
      const end = (box: DOMRect): number => isLeft ? box.right : whole.right - box.left;
      return [start(scrolling) - end(list), end(whole) - end(scrolling), start(detail) - end(list), end(whole) - end(header), start(list) - start(whole)].map(t => Math.round(rem(`${t}px`) * 100) / 100 + 0);
    });

    expect(edges).toEqual([[0, 0, 1.5, 0, 1.5], [0, 0, 1.5, 0, 1.5]]);
    expect([getComputedStyle(scroller).overflowY, rem(getComputedStyle(scroller).paddingInlineEnd), rem(getComputedStyle(DomFixture.oneOf(host, ".nol-modules-header", Element)).paddingInlineEnd)])
      .toEqual(["auto", 1.5, 1.5]);
    expect(rem(`${DomFixture.one(host, ".nol-modules-detail").getBoundingClientRect().width}px`)).toBeCloseTo(rem(getComputedStyle(DomFixture.oneOf(host, ".nol-modules-detail", Element)).maxWidth), 2);
  });

  it("shows a failed or blocked module's cause, its blocker and dependencies as links, and nothing it contributes when it has none", async () => {
    await renderAsync();

    click(row("notes"));
    const failed = [parts(".nol-modules-fact-state"), texts(".nol-modules-fact-dependents"), texts(".nol-modules-group .nol-group-header-title")];
    click(row("alarm"));

    expect(failed).toEqual([[["error", "Failed", "Its runtime part could not be loaded."]], ["Alarm"], ["Menus", "Notification kinds"]]);
    expect(texts("[aria-current=true] .nol-modules-name")).toEqual(["Alarm"]);
    expect(texts(".nol-modules-facts:first-of-type dt")).toEqual(["Version", "State", "Blocked by", "Depends on", "Needed by"]);
    expect([parts(".nol-modules-fact-state"), texts(".nol-modules-fact-blocker"), texts(".nol-modules-fact-dependencies"), texts(".nol-modules-fact-dependents")])
      .toEqual([[["error", "Blocked", "It depends on notes, which is not active."]], ["Notes"], ["Clock, Notes"], ["None"]]);
    expect([texts(".nol-modules-group"), texts(".nol-modules-none")]).toEqual([[], ["None", "No programs are running.", "No commands, settings, menus, views or notification kinds."]]);
  });

  it("lists the selected module's running programs, counts them in the list rows and says how long each has run, each minute", async () => {
    const started = new Date("2026-10-06T08:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(started.getTime() + 3 * 60_000 + 30_000);
    programs.set([
      new ProgramStatus("clock", "/usr/bin/node", 4210, started, false),
      new ProgramStatus("notes", "C:\\Tools\\sync.exe", 4300, started, false),
      new ProgramStatus("clock", "/opt/clock/helper", 4211, started, true)
    ]);
    await renderAsync();

    const rows = texts(".nol-modules-row-programs");
    const shown = parts(".nol-modules-program");
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    const minuteLater = texts(".nol-modules-program-state");
    click(row("notes"));
    const notesShown = parts(".nol-modules-program");
    programs.set([]);
    fixture.detectChanges();

    expect(rows).toEqual(["2 programs", "1 program"]);
    expect(shown).toEqual([["node", "3 min", "content_copy"], ["helper", "Exited, its processes still run", "content_copy"]]);
    expect(minuteLater).toEqual(["4 min", "Exited, its processes still run"]);
    expect(notesShown).toEqual([["sync.exe", "4 min", "content_copy"]]);
    expect([texts(".nol-modules-programs"), texts(".nol-modules-row-programs"), texts(".nol-modules-section-title")])
      .toEqual([[], [], ["Running programs", "Contributes"]]);
    expect(texts(".nol-modules-none")).toContain("No programs are running.");
  });

  it("keeps no minute clock while its page is hidden, and shows the running time again as soon as it is shown", async () => {
    const started = new Date("2026-10-06T08:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(started.getTime() + 3 * 60_000);
    programs.set([new ProgramStatus("clock", "/usr/bin/node", 4210, started, false)]);
    await renderAsync();
    const shownTimers = vi.getTimerCount();

    isShown.set(false);
    fixture.detectChanges();
    const hiddenTimers = vi.getTimerCount();
    vi.advanceTimersByTime(5 * 60_000);
    fixture.detectChanges();
    const hidden = texts(".nol-modules-program-state");
    isShown.set(true);
    fixture.detectChanges();

    expect([shownTimers, hiddenTimers, vi.getTimerCount()]).toEqual([1, 0, 1]);
    expect(hidden).toEqual(["3 min"]);
    expect(texts(".nol-modules-program-state")).toEqual(["8 min"]);
  });

  it("shows a program on one line, cutting a long name before its running time, right-aligned before Copy path, gives its path, process and start in a tooltip, and stops its minute clock when it closes", async () => {
    const started = new Date("2026-10-06T08:00:00.000Z");
    const program = `/opt/${"far/".repeat(4)}${"node".repeat(40)}`;
    programs.set([new ProgramStatus("clock", program, 4210, started, false), new ProgramStatus("clock", "/usr/bin/node", 4211, started, false)]);
    const clear = vi.spyOn(globalThis, "clearInterval");
    await renderAsync();
    const programLines = DomFixture.all(element(), ".nol-modules-program");
    const [line, short] = [DomFixture.present(programLines[0]), DomFixture.present(programLines[1])];
    const box = (selector: string, of: HTMLElement = line): DOMRect => DomFixture.one(of, selector).getBoundingClientRect();
    const [whole, name, state, copy] = [line.getBoundingClientRect(), box(".nol-modules-program-name"), box(".nol-modules-program-state"), box(".nol-modules-program-copy")];
    const [shortName, shortState, shortCopy] = [box(".nol-modules-program-name", short), box(".nol-modules-program-state", short), box(".nol-modules-program-copy", short)];
    const middle = copy.top + copy.height / 2;
    const details = `${program} · Process 4210, started ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(started)}`;

    await TooltipFixture.expectTooltipAsync(line, details);
    await TooltipFixture.expectTooltipAsync(find(line, ".nol-modules-program-copy", HTMLButtonElement), `Copy path · ${details}`);
    fixture.destroy();

    expect(whole.height).toBeCloseTo(copy.height, 0);
    expect([name.top + name.height / 2, state.top + state.height / 2]).toEqual([expect.closeTo(middle, 0), expect.closeTo(middle, 0)]);
    expect([name.right <= state.left, state.right <= copy.left, copy.right]).toEqual([true, true, expect.closeTo(whole.right, 0)]);
    expect([rem(`${shortState.left - shortName.right}px`) > 0.5, rem(`${shortCopy.left - shortState.right}px`), shortState.right, shortCopy.right])
      .toEqual([true, expect.closeTo(0.5, 1), expect.closeTo(state.right, 0), expect.closeTo(copy.right, 0)]);
    expect(clear).toHaveBeenCalled();
  });

  it("copies a program's path from its row, says Copied for a moment, and stays as it was when the clipboard refuses it", async () => {
    programs.set([new ProgramStatus("clock", "/usr/bin/node", 4210, new Date(), false), new ProgramStatus("clock", "/opt/clock/helper", 4211, new Date(), false)]);
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const copy = (index: number): HTMLButtonElement => DomFixture.present(DomFixture.allOf(element(), ".nol-modules-program-copy", HTMLButtonElement)[index]);
    const labels = (): readonly (string | null)[] => [0, 1].map(t => copy(t).getAttribute("aria-label"));
    const before = labels();

    click(copy(1));
    await settleAsync();
    fixture.detectChanges();
    const copied = [labels(), copy(1).classList.contains("nol-modules-program-copied")];
    vi.advanceTimersByTime(1_999);
    fixture.detectChanges();
    const stillCopied = labels();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    const after = labels();
    bridge.isCopyAccepted = false;
    click(copy(0));
    await settleAsync();
    fixture.detectChanges();

    expect(bridge.copied).toEqual(["/opt/clock/helper"]);
    expect(before).toEqual(["Copy path", "Copy path"]);
    expect(copied).toEqual([["Copy path", "Copied"], true]);
    expect(stillCopied).toEqual(["Copy path", "Copied"]);
    expect(after).toEqual(["Copy path", "Copy path"]);
    expect([labels(), errors]).toEqual([["Copy path", "Copy path"], []]);
  });

  it("names Copy path's action first in its tooltip, and Copied while it says so, before the program's details", async () => {
    const started = new Date("2026-10-06T08:00:00.000Z");
    programs.set([new ProgramStatus("clock", "/usr/bin/node", 4210, started, false)]);
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const copy = find(element(), ".nol-modules-program-copy", HTMLButtonElement);
    const details = `/usr/bin/node · Process 4210, started ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(started)}`;

    await TooltipFixture.expectTooltipAsync(copy, `Copy path · ${details}`);
    click(copy);
    await settleAsync();
    fixture.detectChanges();
    await TooltipFixture.expectTooltipAsync(copy, `Copied · ${details}`);
    vi.advanceTimersByTime(2_000);
    fixture.detectChanges();

    await TooltipFixture.expectTooltipAsync(copy, `Copy path · ${details}`);
  });

  it("moves Copied to the program copied next for a whole moment, and ends its wait when the page closes", async () => {
    programs.set([new ProgramStatus("clock", "/usr/bin/node", 4210, new Date(), false), new ProgramStatus("clock", "/opt/clock/helper", 4211, new Date(), false)]);
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const copy = (index: number): HTMLButtonElement => DomFixture.present(DomFixture.allOf(element(), ".nol-modules-program-copy", HTMLButtonElement)[index]);
    const labels = (): readonly (string | null)[] => [0, 1].map(t => copy(t).getAttribute("aria-label"));
    const copyAsync = async (index: number): Promise<void> => {
      click(copy(index));
      await settleAsync();
      fixture.detectChanges();
    };

    await copyAsync(1);
    vi.advanceTimersByTime(1_999);
    await copyAsync(0);
    const moved = labels();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    const kept = labels();
    vi.advanceTimersByTime(1_999);
    fixture.detectChanges();
    const ended = labels();
    await copyAsync(1);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const waits = vi.getTimerCount();
    fixture.destroy();

    expect(bridge.copied).toEqual(["/opt/clock/helper", "/usr/bin/node", "/opt/clock/helper"]);
    expect([moved, kept, ended]).toEqual([["Copied", "Copy path"], ["Copied", "Copy path"], ["Copy path", "Copy path"]]);
    expect([waits, vi.getTimerCount(), errors]).toEqual([1, 0, []]);
  });

  it("hands a clipboard failure to the error handler and keeps Copy path", async () => {
    const failure = new Error("The clipboard is busy.");
    programs.set([new ProgramStatus("clock", "/usr/bin/node", 4210, new Date(), false)]);
    await renderAsync();
    bridge.copyFailure = failure;

    click(DomFixture.oneOf(element(), ".nol-modules-program-copy", HTMLButtonElement));
    await settleAsync();
    fixture.detectChanges();

    expect([bridge.copied, errors]).toEqual([[], [failure]]);
    expect(element().querySelector(".nol-modules-program-copy")?.getAttribute("aria-label")).toBe("Copy path");
  });

  it("lists the modules a module optionally depends on in their own row after its dependencies, only when it has some", async () => {
    const journal = new ModuleStatus("journal", "0.0.1", "Journal", "Keeps a journal.", ["notes"], new Map(), ModuleState.Active, null, null, ["clock", "weather"]);
    modules.set([clock, notes, journal]);
    TestBed.inject(ModuleSelectionService).select("journal");

    await renderAsync();
    const optional = [texts(".nol-modules-facts:first-of-type dt"), texts(".nol-modules-fact-optional-dependencies"), texts(".nol-modules-fact-optional-dependencies .nol-modules-link")];
    click(row("clock"));

    expect(optional).toEqual([["Version", "State", "Depends on", "Uses if present", "Needed by"], ["Clock, weather"], ["Clock"]]);
    expect([texts(".nol-modules-fact-optional-dependencies"), texts(".nol-modules-fact-dependents")]).toEqual([[], ["None"]]);
  });

  it("names a dependency or blocker the list lacks by its id, without a link", async () => {
    modules.set([clock, alarm]);
    TestBed.inject(ModuleSelectionService).select("alarm");

    await renderAsync();

    expect([texts(".nol-modules-fact-blocker"), texts(".nol-modules-fact-dependencies")]).toEqual([["notes"], ["Clock, notes"]]);
    expect([texts(".nol-modules-fact-dependencies .nol-modules-link"), texts(".nol-modules-unknown")]).toEqual([["Clock"], ["notes", "notes"]]);
  });

  it("follows a link to its module, selecting it and moving the focus to its row", async () => {
    await renderAsync();
    click(row("alarm"));

    click(link("blocker", "Notes"));
    await fixture.whenStable();
    const blocker = [texts(".nol-modules-detail-title"), document.activeElement === row("notes")];
    click(link("dependents", "Alarm"));
    click(link("dependencies", "Clock"));
    await fixture.whenStable();

    expect(blocker).toEqual([["Notes"], true]);
    expect(texts(".nol-modules-detail-title")).toEqual(["Clock"]);
    expect(document.activeElement).toBe(row("clock"));
  });

  it("follows the modules while open, keeping the selected module while it remains and else showing the first", async () => {
    await renderAsync();
    click(row("alarm"));

    modules.set([notes, alarm.withState(ModuleState.Active, null)]);
    fixture.detectChanges();
    const kept = [texts(".nol-modules-detail-title"), texts(".nol-modules-fact-state")];
    modules.set([notes, clock]);
    fixture.detectChanges();

    expect(kept).toEqual([["Alarm"], ["Active"]]);
    expect([texts(".nol-modules-row .nol-modules-name"), texts(".nol-modules-detail-title")]).toEqual([["Notes", "Clock"], ["Notes"]]);
  });

  it("offers to copy the details and open the log folder for a module that isn't active only", async () => {
    await renderAsync();
    const active = element().querySelectorAll("nol-module-actions").length;

    click(row("notes"));

    expect(active).toBe(0);
    expect(parts(".nol-modules-detail nol-module-actions button")).toEqual([["content_copy", "Copy details"], ["folder_open", "Open log folder"]]);
  });

  it("shows the module the selection names, as when the status bar opens the document on a failed module", async () => {
    TestBed.inject(ModuleSelectionService).select("alarm");

    await renderAsync();

    expect([texts("[aria-current=true] .nol-modules-name"), texts(".nol-modules-detail-title")]).toEqual([["Alarm"], ["Alarm"]]);
  });

  it("says when the build has no modules, and reports a build it cannot read without showing a version", async () => {
    modules.set([]);
    bridge.build = null;

    await renderAsync();

    expect([texts(".nol-modules-empty"), texts(".nol-modules-detail"), texts(".nol-modules-version")]).toEqual([["No modules"], [], []]);
    expect(errors.length).toBe(1);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`stands the current row and the hovered row after it the row gap apart, the tabs' gap until the kit names one, in the ${theme.id} theme in ${mode} mode`, async () => {
        const host = await renderAsync(mode);
        AppearanceFixture.apply(theme, mode);
        const [current, next] = [row("clock"), row("notes")];
        await userEvent.hover(next);
        const gap = (): number => next.getBoundingClientRect().top - current.getBoundingClientRect().bottom;
        const tabs = host.appendChild(document.createElement("div"));
        tabs.style.width = "calc(2 * var(--nol-tab-inset))";
        const tabGap = tabs.getBoundingClientRect().width;
        tabs.remove();
        const kept = gap();
        host.style.setProperty("--nol-row-gap", "0.5rem");
        const named = gap();

        expect([getComputedStyle(current).backgroundColor, getComputedStyle(next).backgroundColor])
          .toEqual([AppearanceFixture.readColor(theme, mode, "selected"), AppearanceFixture.readColor(theme, mode, "hover")]);
        AppearanceFixture.expectPixels(kept, tabGap);
        AppearanceFixture.expectPixels(named, AppearanceFixture.toPixels(0.5));
      });

  it("follows the component table for the list, rows, states and links in both modes", async () => {
    for (const mode of AppearanceFixture.modes) {
      const host = await renderAsync(mode);
      const current = getComputedStyle(row("clock"));
      const title = getComputedStyle(DomFixture.oneOf(host, ".nol-modules-title", Element));

      AppearanceFixture.expectLook(getComputedStyle(DomFixture.oneOf(host, ".nol-modules-list", Element)).flexBasis, DefaultTheme.theme, "modules-list-width", "flex-basis");
      AppearanceFixture.expectLook(getComputedStyle(DomFixture.oneOf(host, ".nol-modules-detail", Element)).maxWidth, DefaultTheme.theme, "modules-detail-width", "max-width");
      expect(current.backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "selected"));
      expect([title.fontWeight, title.color]).toEqual([title.getPropertyValue("--nol-weight-emphasis").trim(), AppearanceFixture.readColor(DefaultTheme.theme, mode, "setting-title")]);
      expect(getComputedStyle(DomFixture.oneOf(host, ".nol-modules-state-icon", Element)).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "error"));
      expect(getComputedStyle(DomFixture.oneOf(host, ".nol-modules-row-version", Element)).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "text"));
      expect(getComputedStyle(link("dependents", "Alarm")).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "link"));
      fixture.destroy();
    }
  });

  it("truncates a row's name, id and description on one line each, keeps its version whole beside the id, and shows a cut description whole in a tooltip", async () => {
    modules.set([new ModuleStatus("long", "0.0.1", "A module whose name is far too long for the list", "Tells the time. ".repeat(20), [], new Map(), ModuleState.Active, null), clock]);
    await renderAsync();
    const long = row("long");

    const truncating = [".nol-modules-name", ".nol-modules-id"].map(t => long.querySelector(t)?.hasAttribute("data-truncates"));
    const description = getComputedStyle(DomFixture.oneOf(long, ".nol-modules-description", Element));
    const meta = getComputedStyle(DomFixture.oneOf(long, ".nol-modules-row-meta", Element));
    const version = getComputedStyle(DomFixture.oneOf(long, ".nol-modules-row-version", Element));

    expect(truncating).toEqual([true, true]);
    expect([meta.display, meta.minWidth, version.flexShrink]).toEqual(["flex", "0px", "0"]);
    const cut = DomFixture.one(long, ".nol-modules-description");
    expect([description.whiteSpace, description.textOverflow, description.overflow]).toEqual(["nowrap", "ellipsis", "hidden"]);
    expect(cut.getBoundingClientRect().height).toBeCloseTo(Number.parseFloat(description.lineHeight), 0);
    expect([cut.scrollWidth > cut.clientWidth, cut.hasAttribute("data-truncates")]).toEqual([true, true]);
    await TooltipFixture.expectTooltipAsync(cut, "Tells the time. ".repeat(20).trim());
  });

  it("makes the module's name the largest text in its details and shows its state at panel size there, smaller in the list", async () => {
    const host = await renderAsync();
    const size = (selector: string): number => Number.parseFloat(getComputedStyle(DomFixture.oneOf(host, selector, Element)).fontSize);

    expect(size(".nol-modules-detail-title")).toBeGreaterThan(size(".nol-modules-detail-description"));
    expect(size(".nol-modules-fact-state .nol-modules-state")).toBe(size(".nol-modules-fact-dependencies"));
    expect(size(".nol-modules-row .nol-modules-state")).toBeLessThan(size(".nol-modules-fact-state .nol-modules-state"));
  });

  it("sizes the module's name in its details from the panel size, even when the message size is smaller", async () => {
    const host = await renderAsync();
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, 16);
    document.documentElement.style.setProperty("--nol-text-message", "12px");
    const size = (selector: string): number => Number.parseFloat(getComputedStyle(DomFixture.oneOf(host, selector, Element)).fontSize);

    expect(size(".nol-modules-detail-title")).toBeGreaterThan(size(".nol-modules-detail-description"));
    AppearanceFixture.expectRem(getComputedStyle(DomFixture.oneOf(host, ".nol-modules-detail-title", Element)).fontSize, 0.8125 + 0.125, 16);
  });

  it("shows an unavailable module as unavailable with its cause beside a muted icon, and with no actions and no switch", async () => {
    const shade = new ModuleStatus("shade", "0.0.1", "Shade", "Dims windows.", [], new Map(), ModuleState.Unavailable, "It doesn't run on Linux.");
    modules.set([shade, clock]);

    for (const mode of AppearanceFixture.modes) {
      TestBed.inject(ModuleSelectionService).select("shade");
      const host = await renderAsync(mode);
      const fact = find(host, ".nol-modules-fact-state", HTMLElement);
      const icon = find(host, ".nol-modules-fact-state .nol-modules-state .material-symbols-rounded", HTMLElement);
      const label = find(host, ".nol-modules-fact-state .nol-modules-state-label", HTMLElement);
      const state = find(host, ".nol-modules-fact-state .nol-modules-state", HTMLElement).getBoundingClientRect();
      const cause = find(host, ".nol-modules-fact-state .nol-modules-cause", HTMLElement).getBoundingClientRect();

      expect(parts(".nol-modules-row")[0]).toEqual(["Shade", "block", "Unavailable", "shade", "0.0.1", "Dims windows."]);
      expect(parts(".nol-modules-fact-state")).toEqual([["block", "Unavailable", "It doesn't run on Linux."]]);
      expect([getComputedStyle(icon).color, getComputedStyle(label).color]).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, mode, "text"), AppearanceFixture.readColor(DefaultTheme.theme, mode, "text")]);
      expect(rem(`${cause.left - state.right}px`)).toBeCloseTo(rem(getComputedStyle(fact).columnGap), 2);
      expect([texts(".nol-modules-facts dt").includes("Switch"), host.querySelector("nol-module-actions")]).toEqual([false, null]);
      fixture.destroy();
    }
  });

  it("lines up an unavailable module's state in its list row as an off module's, with the same icon size, gap and end inset", async () => {
    const sleep = new ModuleStatus("sleep", "0.0.1", "Sleep", "Dims the screen.", [], new Map(), ModuleState.Off, null, null, [], "sleep.enabled");
    const shade = new ModuleStatus("shade", "0.0.1", "Shade", "Dims windows.", [], new Map(), ModuleState.Unavailable, "It doesn't run on Linux.");
    modules.set([sleep, shade, clock]);
    values.set(new Map([["sleep.enabled", false]]));

    for (const mode of AppearanceFixture.modes) {
      const host = await renderAsync(mode);
      const measure = (id: string): readonly number[] => {
        const head = find(row(id), ".nol-modules-row-head", HTMLElement).getBoundingClientRect();
        const state = find(row(id), ".nol-modules-state", HTMLElement);
        const icon = find(state, ".material-symbols-rounded", HTMLElement).getBoundingClientRect();
        const label = find(state, ".nol-modules-state-label", HTMLElement).getBoundingClientRect();
        return [head.right - state.getBoundingClientRect().right, icon.width, label.left - icon.right].map(t => rem(`${t}px`));
      };
      const [off, unavailable] = [measure("sleep"), measure("shade")];
      const gap = rem(getComputedStyle(find(row("shade"), ".nol-modules-state", HTMLElement)).columnGap);

      expect(unavailable.map(t => t.toFixed(3))).toEqual(off.map(t => t.toFixed(3)));
      expect(unavailable[2]).toBeCloseTo(gap, 2);
      expect(getComputedStyle(find(row("shade"), ".nol-modules-state", HTMLElement)).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "text-muted"));
      expect(host.querySelector(".nol-modules-state-down")).toBeNull();
      fixture.destroy();
    }
  });

  it("shows an off module as off with a muted icon and no actions, and the switch of every module that has one, on or off, lined up with the other facts", async () => {
    const sleep = new ModuleStatus("sleep", "0.0.1", "Sleep", "Dims the screen.", [], new Map(), ModuleState.Off, null, null, [], "sleep.enabled");
    const timer = new ModuleStatus("timer", "0.0.1", "Timer", "Counts down.", [], new Map(), ModuleState.Active, null, null, [], "timer.enabled");
    modules.set([sleep, timer, clock]);
    values.set(new Map([["sleep.enabled", false]]));

    for (const mode of AppearanceFixture.modes) {
      TestBed.inject(ModuleSelectionService).select("sleep");
      const host = await renderAsync(mode);
      const off = find(host, ".nol-modules-fact-state .nol-modules-state .material-symbols-rounded", HTMLElement);
      const label = find(host, ".nol-modules-fact-state .nol-modules-state-label", HTMLElement);
      const box = find(host, ".nol-modules-fact-switch input", HTMLInputElement);
      const switchLeft = find(host, ".nol-modules-fact-switch", HTMLElement).getBoundingClientRect().left;
      const versionLeft = find(host, ".nol-modules-fact-version", HTMLElement).getBoundingClientRect().left;

      expect(parts(".nol-modules-row").slice(0, 2)).toEqual([["Sleep", "toggle_off", "Off", "sleep", "0.0.1", "Dims the screen."], ["Timer", "Active", "timer", "0.0.1", "Counts down."]]);
      expect([getComputedStyle(off).color, getComputedStyle(label).color]).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, mode, "text"), AppearanceFixture.readColor(DefaultTheme.theme, mode, "text")]);
      expect([texts(".nol-modules-facts dt").includes("Switch"), box.checked, host.querySelector("nol-module-actions")]).toEqual([true, false, null]);
      expect(rem(`${switchLeft - versionLeft}px`)).toBe(0);
      click(row("timer"));
      expect(find(host, ".nol-modules-fact-switch input", HTMLInputElement).checked).toBe(true);
      click(row("clock"));
      expect(host.querySelector(".nol-modules-fact-switch")).toBeNull();
      fixture.destroy();
    }
  });
});
