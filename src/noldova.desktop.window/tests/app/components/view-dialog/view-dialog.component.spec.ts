/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";
import { DefaultTheme } from "@noldova/ui.components.angular";

import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { ContentPadding } from "../../../../src/app/enums/content-padding";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LiveViewService } from "../../../../src/app/services/live-view.service";
import { ModuleStatusService } from "../../../../src/app/services/module-status.service";
import { TabFocusService } from "../../../../src/app/services/tab-focus.service";
import { ViewDialogService } from "../../../../src/app/services/view-dialog.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";

@Component({
  selector: "nol-test-changes",
  template: "<p class=\"nol-test-changes\">No changes</p>"
})
class TestChangesComponent {
}

@Component({
  selector: "nol-test-files",
  template: "<input class=\"nol-test-files\" aria-label=\"Filter\">"
})
class TestFilesComponent {
}

@Component({
  selector: "nol-test-fields",
  template: "<input class=\"first\" aria-label=\"Tag\"><textarea class=\"second\" aria-label=\"Summary\"></textarea>"
})
class TestFieldsComponent {
}

describe("ViewDialogComponent", () => {
  const { changes, files, plan, todo } = LayoutFixture;
  let dialogs: ViewDialogService;
  let bridge: PreloadBridgeFixture;

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    const host = new WindowPartHostFixture();
    host.contributions.set(changes.key, new ContributionMatch(() => Promise.resolve(TestChangesComponent), null, ContentPadding.Default));
    host.contributions.set(files.key, new ContributionMatch(() => Promise.resolve(TestFilesComponent), null, ContentPadding.Default));
    host.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestFieldsComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry));
    dialogs = TestBed.inject(ViewDialogService);
  });

  afterEach(async () => {
    dialogs.close();
    await vi.waitFor(() => expect(document.querySelector("nol-view-dialog")).toBeNull());
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  for (const mode of AppearanceFixture.modes)
    it(`ends its title bar with Open in main window, Maximize and Close, keeps focus on Close for a view without controls and lays the view out on the panel surface filling the body, in ${mode} mode`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      void dialogs.showAsync(changes);
      await vi.waitFor(() => expect(document.querySelector(".nol-test-changes")).not.toBeNull());
      await TestBed.inject(ApplicationRef).whenStable();
      const slot = DomFixture.one(document, "nol-tab-slot");
      const body = DomFixture.one(document, ".nol-dialog-body").getBoundingClientRect();
      const bounds = DomFixture.one(document, "nol-tab-content").getBoundingClientRect();

      const open = DomFixture.one(document, ".nol-dialog-header .nol-view-dialog-open");

      expect([...document.querySelectorAll(".nol-dialog-header button")].map(t => t.getAttribute("aria-label"))).toEqual(["Open in main window", "Maximize", "Close"]);
      expect(open.hasAttribute("aria-describedby")).toBe(false);
      expect(document.activeElement?.classList.contains("nol-dialog-close")).toBe(true);
      expect(getComputedStyle(slot).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "panel"));
      AppearanceFixture.expectPixels(bounds.width, body.width);
      AppearanceFixture.expectPixels(bounds.height, body.height);
    });

  it("focuses the first control of a view that was already live in its tab once the dialog has given its own first focus", async () => {
    const slot = document.createElement("div");
    document.body.append(slot);
    TestBed.inject(LiveViewService).show(files, slot, true);
    await TestBed.inject(ApplicationRef).whenStable();
    const field = slot.querySelector(".nol-test-files");

    void dialogs.showAsync(files);
    await vi.waitFor(() => expect(document.querySelector("nol-view-dialog .nol-test-files")).toBe(field));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(field);
    slot.remove();
  });

  it("leaves the focus on the field the person chose after its first focus, when a tab's request for the focus changes later", async () => {
    const focus = TestBed.inject(TabFocusService);
    void dialogs.showAsync(plan);
    await vi.waitFor(() => expect(document.activeElement?.className).toBe("first"));
    const second = DomFixture.oneOf(document, "nol-view-dialog .second", HTMLTextAreaElement);

    second.focus();
    focus.focusContent(todo);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(second);
  });

  for (const mode of AppearanceFixture.modes)
    it(`shows Resume above a view of a module that offers tools, across the dialog's body, while agents are stopped, in ${mode} mode`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      TestBed.inject(ModuleStatusService).report([
        new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map([["tools", ["notes_search"]]]), ModuleState.Active, null)
      ]);
      void dialogs.showAsync(plan);
      await vi.waitFor(() => expect(document.querySelector("nol-view-dialog .second")).not.toBeNull());
      bridge.publishEvent("desktop.agentControlChanged", { isStopped: true, isActing: true });
      await TestBed.inject(ApplicationRef).whenStable();
      const body = DomFixture.one(document, ".nol-dialog-body").getBoundingClientRect();
      const bar = document.querySelector<HTMLElement>("nol-view-dialog .nol-tab-slot-stopped");
      const strip = bar?.getBoundingClientRect() ?? new DOMRect();
      const view = DomFixture.one(document, "nol-view-dialog nol-tab-content").getBoundingClientRect();

      expect([...bar?.children ?? []].map(t => t.textContent?.trim())).toEqual(["Agents are stopped", "Resume"]);
      expect(Object.isNull(bar) ? null : getComputedStyle(bar).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "raised"));
      AppearanceFixture.expectPixels(strip.top, body.top);
      AppearanceFixture.expectPixels(strip.left, body.left);
      AppearanceFixture.expectPixels(strip.right, body.right);
      AppearanceFixture.expectPixels(view.top, strip.bottom);
      AppearanceFixture.expectPixels(view.bottom, body.bottom);
    });

  it("pads a view it shows as a document, whatever dock the view belongs to", async () => {
    AppearanceFixture.apply();
    void dialogs.showAsync(changes);
    await vi.waitFor(() => expect(document.querySelector(".nol-test-changes")).not.toBeNull());
    await TestBed.inject(ApplicationRef).whenStable();
    const style = getComputedStyle(DomFixture.one(document, "nol-tab-content"));

    AppearanceFixture.expectLook(style.paddingTop, DefaultTheme.theme, "document-padding-block", "padding-top");
    AppearanceFixture.expectLook(style.paddingBottom, DefaultTheme.theme, "document-padding-block", "padding-bottom");
    AppearanceFixture.expectLook(style.paddingLeft, DefaultTheme.theme, "content-padding-inline", "padding-left");
  });
});
