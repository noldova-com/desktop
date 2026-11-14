/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { StartupComponent } from "../../../../src/app/components/startup/startup.component";
import { ProductName } from "../../../../src/app/models/product-name";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("StartupComponent", () => {
  let bridge: PreloadBridgeFixture;

  beforeEach(() => {
    AppearanceFixture.apply();
    bridge = PreloadBridgeFixture.install();
  });

  afterEach(() => {
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  async function renderAsync(kind: string, details: readonly string[]): Promise<ComponentFixture<StartupComponent>> {
    bridge.startup = { kind, details };
    const fixture = TestBed.createComponent(StartupComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function texts(fixture: ComponentFixture<StartupComponent>, selector: string): string[] {
    return [...DomFixture.host(fixture).querySelectorAll(selector)].map(t => t.textContent?.trim() ?? String.empty);
  }

  function buttons(fixture: ComponentFixture<StartupComponent>): HTMLButtonElement[] {
    return [...DomFixture.host(fixture).querySelectorAll("button")];
  }

  it("says Noldova Desktop Sample is starting while it connects, as a polite status", async () => {
    const fixture = await renderAsync("Connecting", []);
    const card = DomFixture.host(fixture).querySelector(".nol-startup-card");

    expect(texts(fixture, "p")).toEqual(["Starting Noldova Desktop Sample…"]);
    expect(card?.getAttribute("role")).toBe("status");
    expect(card?.getAttribute("aria-live")).toBe("polite");
    expect(buttons(fixture)).toEqual([]);
  });

  it("names the app by the name it started the window with while it starts", async () => {
    const started = ProductName.current;
    ProductName.use("Example Product");
    try {
      const fixture = await renderAsync("Connecting", []);

      expect(texts(fixture, "p")).toEqual(["Starting Example Product…"]);
    }
    finally {
      ProductName.use(started);
    }
  });

  it("explains data from before the shell and moves it aside on request", async () => {
    const fixture = await renderAsync("PreShellData", ["/home/person/.noldova/desktop"]);

    expect(texts(fixture, "h1")).toEqual(["Data from an earlier Noldova Desktop Sample"]);
    expect(texts(fixture, "p")[0]).toBe("/home/person/.noldova/desktop");
    expect(texts(fixture, "p")[1]).toContain("changes and deletes nothing");
    expect(texts(fixture, "button")).toEqual(["Move aside"]);
    buttons(fixture)[0]?.click();
    fixture.detectChanges();

    expect(buttons(fixture)[0]?.disabled).toBe(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(buttons(fixture)[0]?.disabled).toBe(false);
    expect(bridge.actions).toEqual(["moveAside"]);
  });

  it("lists an older build's work and offers to wait for it or stop it", async () => {
    const fixture = await renderAsync("WorkInProgress", ["A reply", "A command"]);

    expect(texts(fixture, "h1")).toEqual(["An older Noldova Desktop Sample is still working"]);
    expect(texts(fixture, "li")).toEqual(["A reply", "A command"]);
    expect(texts(fixture, "button")).toEqual(["Wait for it", "Stop the work"]);
    expect(buttons(fixture)[1]?.classList.contains("nol-button-secondary")).toBe(true);
    buttons(fixture)[0]?.click();
    await fixture.whenStable();
    buttons(fixture)[1]?.click();
    await fixture.whenStable();

    expect(bridge.actions).toEqual(["wait", "stopWork"]);
  });

  it("shows the work it waits for", async () => {
    const fixture = await renderAsync("WaitingForWork", ["A reply"]);

    expect(texts(fixture, "h1")).toEqual(["Waiting for the older Noldova Desktop Sample"]);
    expect(texts(fixture, "li")).toEqual(["A reply"]);
    expect(buttons(fixture)).toEqual([]);
  });

  it("says which version it installs while it saves the work and closes, without actions", async () => {
    const fixture = await renderAsync("Updating", ["0.3.0"]);

    expect(texts(fixture, "h1")).toEqual(["Installing Noldova Desktop Sample 0.3.0"]);
    expect(texts(fixture, "p")).toEqual(["Saving your work and closing Noldova Desktop Sample"]);
    expect(buttons(fixture)).toEqual([]);
  });

  it("leaves the version out of the title when the main process gives none", async () => {
    const fixture = await renderAsync("Updating", []);

    expect(texts(fixture, "h1")).toEqual(["Installing Noldova Desktop Sample"]);
  });

  it("names the newer build that is running", async () => {
    const fixture = await renderAsync("NewerBuild", ["2.0.0"]);

    expect(texts(fixture, "h1")).toEqual(["A newer Noldova Desktop Sample is running"]);
    expect(texts(fixture, "p")).toEqual(["Noldova Desktop Sample 2.0.0 is using this data folder. Use that Noldova Desktop Sample instead."]);
  });

  it("shows why Noldova Desktop Sample could not start and offers to try again", async () => {
    const fixture = await renderAsync("Failed", ["The runtime did not start in time."]);

    expect(texts(fixture, "h1")).toEqual(["Noldova Desktop Sample could not start"]);
    expect(texts(fixture, "p")).toEqual(["The runtime did not start in time."]);
    buttons(fixture)[0]?.click();
    await fixture.whenStable();

    expect(bridge.actions).toEqual(["retry"]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`draws its card from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await renderAsync("Failed", ["The runtime did not start in time."]);
        const root = DomFixture.host(fixture);
        const card = getComputedStyle(root.querySelector(".nol-startup-card") ?? root);
        const title = getComputedStyle(root.querySelector("h1") ?? root);
        const detail = getComputedStyle(root.querySelector(".nol-startup-detail") ?? root);

        expect(card.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "panel"));
        expect(card.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "card-border"));
        expect(card.color).toBe(AppearanceFixture.readColor(theme, mode, "text"));
        expect(detail.color).toBe(AppearanceFixture.readColor(theme, mode, "text-muted"));
        expect(title.fontWeight).toBe(title.getPropertyValue("--nol-weight-emphasis").trim());
        AppearanceFixture.expectLook(card.borderTopLeftRadius, theme, "radius-large", "border-top-left-radius");
        AppearanceFixture.expectLook(card.paddingTop, theme, "space-6", "padding-top");
      });

  it("fits a narrow window and wraps a long path within the card", async () => {
    const fixture = await renderAsync("PreShellData", ["/".repeat(400)]);
    const root = DomFixture.host(fixture);
    root.style.width = "200px";
    const card = root.querySelector<HTMLElement>(".nol-startup-card") ?? root;

    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });
});
