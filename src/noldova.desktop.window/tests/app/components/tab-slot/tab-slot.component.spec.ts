/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, type Signal, type WritableSignal, computed, inject, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { TabSlotComponent } from "../../../../src/app/components/tab-slot/tab-slot.component";
import { ContentPadding } from "../../../../src/app/enums/content-padding";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { CommandService } from "../../../../src/app/services/command.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { LiveViewService } from "../../../../src/app/services/live-view.service";
import { ModuleStatusService } from "../../../../src/app/services/module-status.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

@Component({
  selector: "nol-test-page",
  template: "<textarea></textarea><div class=\"list\" style=\"height: 20px; overflow: auto\"><div style=\"height: 200px\"></div></div>"
})
class TestPageComponent {
}

@Component({
  imports: [TabSlotComponent],
  template: "@if (isShown()) { <nol-tab-slot [tab]=\"tab()\" [isDocked]=\"isDocked()\" /> }"
})
class TestHostComponent {
  public readonly tab: WritableSignal<Tab> = signal(LayoutFixture.plan);
  public readonly isDocked: WritableSignal<boolean> = signal(false);
  public readonly isShown: WritableSignal<boolean> = signal(true);
  public readonly slot: Signal<TabSlotComponent | undefined> = viewChild(TabSlotComponent);
}

@Component({
  imports: [TabSlotComponent],
  template: "@if (isFirst()) { <div class=\"first\"><nol-tab-slot [tab]=\"tab\" /></div> } @else { <div class=\"second\"><nol-tab-slot [tab]=\"tab\" /></div> }"
})
class MovingHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  protected readonly tab: Tab = LayoutFixture.todo;
  protected readonly isFirst: Signal<boolean> = computed(() => this.layout.layout().isOpen(LayoutFixture.plan));
}

@Component({
  imports: [TabSlotComponent],
  template: `
    <div style="display: flex; flex-direction: column; height: 300px"><nol-tab-slot [tab]="plan" [isDocked]="isDocked()" /></div>
    <div style="display: flex; flex-direction: column; height: 300px"><nol-tab-slot [tab]="todo" /></div>
  `
})
class TwoViewsHostComponent {
  protected readonly plan: Tab = LayoutFixture.plan;
  protected readonly todo: Tab = LayoutFixture.todo;
  public readonly isDocked: WritableSignal<boolean> = signal(false);
}

describe("TabSlotComponent", () => {
  const { plan, todo } = LayoutFixture;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    PreloadBridgeFixture.install();
    const host = new WindowPartHostFixture();
    for (const tab of [plan, todo])
      host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(plan).openDocument(todo));
    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  afterEach(() => PreloadBridgeFixture.remove());

  function slotElement(): HTMLElement | null {
    return DomFixture.host(fixture).querySelector("nol-tab-slot");
  }

  it("shows its tab's view and tells it whether it is docked", async () => {
    const content = fixture.componentInstance.slot()?.content();

    fixture.componentInstance.isDocked.set(true);
    await fixture.whenStable();

    expect(content?.element.parentElement).toBe(slotElement());
    expect(content?.element.querySelector("textarea")).not.toBeNull();
    expect(content?.isDocked()).toBe(true);
  });

  it("hides the view of the tab it showed before and shows it again as it was when that tab comes back", async () => {
    const planned = fixture.componentInstance.slot()?.content();
    DomFixture.oneOf(DomFixture.present(planned).element, "textarea", HTMLTextAreaElement).value = "draft";

    fixture.componentInstance.tab.set(todo);
    await fixture.whenStable();
    const other = fixture.componentInstance.slot()?.content();
    const whileOther = [planned?.element.isConnected, other?.element.parentElement];
    fixture.componentInstance.tab.set(plan);
    await fixture.whenStable();

    expect(whileOther).toEqual([false, slotElement()]);
    expect(fixture.componentInstance.slot()?.content()).toBe(planned);
    expect(DomFixture.oneOf(DomFixture.present(planned).element, "textarea", HTMLTextAreaElement).value).toBe("draft");
  });

  it("shows a new view once its tab's view is destroyed", async () => {
    const planned = fixture.componentInstance.slot()?.content();

    TestBed.inject(LiveViewService).destroy(t => t.equals(plan));
    await fixture.whenStable();
    const replaced = fixture.componentInstance.slot()?.content();

    expect(replaced).not.toBe(planned);
    expect(replaced?.element.parentElement).toBe(slotElement());
  });

  it("keeps the scroll of a view whose slot the layout replaces in the same frame as the scroll, reading it before the old slot leaves the page", async () => {
    const moving = TestBed.createComponent(MovingHostComponent);
    await moving.whenStable();
    const root = DomFixture.host(moving);
    const list = DomFixture.one(root, ".first .list");
    list.scrollTop = 120;
    list.dispatchEvent(new Event("scroll"));

    TestBed.inject(LayoutService).close(plan);
    await moving.whenStable();

    expect([list.closest(".second")?.parentElement, list.scrollTop]).toEqual([root, 120]);
  });

  it("hides its view when it goes and keeps the view for the next slot", async () => {
    const planned = fixture.componentInstance.slot()?.content();

    fixture.componentInstance.isShown.set(false);
    await fixture.whenStable();
    const hidden = [planned?.element.isConnected, planned?.isShown()];
    fixture.componentInstance.isShown.set(true);
    await fixture.whenStable();

    expect(hidden).toEqual([false, false]);
    expect(fixture.componentInstance.slot()?.content()).toBe(planned);
  });

  it("lets nothing go when it goes before it has shown a view", () => {
    const early = TestBed.createComponent(TabSlotComponent);
    early.componentRef.setInput("tab", todo);

    early.destroy();

    expect(early.componentInstance.content()).toBeNull();
  });
});

describe("TabSlotComponent while agent control is stopped", () => {
  let bridge: PreloadBridgeFixture;
  let runs: string[];
  let fixture: ComponentFixture<TwoViewsHostComponent>;

  function notes(contributions: readonly (readonly [string, readonly string[]])[]): ModuleStatus {
    return new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map(contributions), ModuleState.Active, null);
  }

  function bars(): HTMLElement[] {
    return [...DomFixture.host(fixture).querySelectorAll<HTMLElement>(".nol-tab-slot-stopped")];
  }

  async function publishAsync(isStopped: boolean): Promise<void> {
    bridge.publishEvent("desktop.agentControlChanged", { isStopped, isActing: true });
    await fixture.whenStable();
  }

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    runs = [];
    const host = new WindowPartHostFixture();
    for (const tab of [LayoutFixture.plan, LayoutFixture.todo])
      host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartHostService, useValue: host }, { provide: CommandService, useValue: { run: (name: string) => runs.push(name) } }]
    });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo));
    TestBed.inject(ModuleStatusService).report([notes([["tools", ["notes_search"]]])]);
    fixture = TestBed.createComponent(TwoViewsHostComponent);
    await fixture.whenStable();
  });

  afterEach(() => PreloadBridgeFixture.remove());

  it("shows Resume above every open view of a module that offers tools, runs the resume command, and leaves every view once control resumes", async () => {
    const before = bars().length;

    await publishAsync(true);
    const shown = bars().map(t => [...t.children].map(u => u.textContent?.trim()).join("|"));
    bars()[1]?.querySelector("button")?.click();
    await publishAsync(false);

    expect([before, shown, runs, bars().length]).toEqual([0, ["Agents are stopped|Resume", "Agents are stopped|Resume"], ["desktop.resumeAgentControl"], 0]);
  });

  it("shows nothing over the views of a module that offers no tools", async () => {
    TestBed.inject(ModuleStatusService).report([notes([["views", ["notes.list"]]])]);

    await publishAsync(true);

    expect(bars().length).toBe(0);
  });

  for (const mode of AppearanceFixture.modes)
    for (const isDocked of [false, true])
      it(`lays the bar out above the view on a surface unlike the view's, and gives the view its whole height back, in ${mode} mode ${isDocked ? "in a dock" : "in the middle"}`, async () => {
        AppearanceFixture.apply(DefaultTheme.theme, mode);
        try {
          fixture.componentInstance.isDocked.set(isDocked);
          await fixture.whenStable();
          const slot = DomFixture.one(DomFixture.host(fixture), "nol-tab-slot");
          const content = (): HTMLElement => DomFixture.one(slot, "nol-tab-content");
          const box = (element: Element): readonly number[] => {
            const bounds = element.getBoundingClientRect();
            return [bounds.top, bounds.bottom, bounds.left, bounds.right];
          };
          const running = box(content());

          await publishAsync(true);
          const [bar] = bars();
          const area = slot.getBoundingClientRect();
          const strip = bar?.getBoundingClientRect() ?? new DOMRect();
          const view = content().getBoundingClientRect();
          const text = bar?.querySelector(".nol-tab-slot-stopped-text")?.getBoundingClientRect() ?? new DOMRect();
          const button = bar?.querySelector("button")?.getBoundingClientRect() ?? new DOMRect();
          const inset = Number.parseFloat(getComputedStyle(content()).paddingLeft);
          const surface = bar ? getComputedStyle(bar).backgroundColor : String.empty;
          await publishAsync(false);

          expect([strip.top, strip.left, strip.right]).toEqual([area.top, area.left, area.right]);
          expect([view.top, view.bottom]).toEqual([strip.bottom, area.bottom]);
          AppearanceFixture.expectPixels(text.left - area.left, inset);
          AppearanceFixture.expectPixels(area.right - button.right, inset);
          AppearanceFixture.expectPixels(button.top - strip.top, AppearanceFixture.toPixels(0.25));
          AppearanceFixture.expectPixels(strip.bottom - button.bottom, AppearanceFixture.toPixels(0.25));
          expect(surface).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, isDocked ? "panel" : "raised"));
          expect(surface).not.toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, isDocked ? "window" : "panel"));
          expect(box(content())).toEqual(running);
        }
        finally {
          AppearanceFixture.reset();
        }
      });
});
