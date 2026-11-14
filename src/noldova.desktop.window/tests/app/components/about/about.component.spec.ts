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

import { AboutComponent } from "../../../../src/app/components/about/about.component";
import { UpdateStateKind } from "../../../../src/app/enums/update-state-kind";
import type { IProductAbout } from "../../../../src/app/interfaces/i-product-about";
import { BuildTokens } from "../../../../src/app/models/build-tokens";
import { ProductName } from "../../../../src/app/models/product-name";
import { UpdateState } from "../../../../src/app/models/update-state";
import { LinkService } from "../../../../src/app/services/link.service";
import { UpdateService } from "../../../../src/app/services/update.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { AppearanceService, DefaultTheme, ModePreference, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

describe("AboutComponent", () => {
  let state: WritableSignal<UpdateState>;
  let calls: string[];
  let errors: unknown[];
  let bridge: PreloadBridgeFixture;
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const supplied: IProductAbout = {
    description: "Sample work, done together.",
    website: "https://sample.example/",
    releases: "https://github.com/example/sample/releases/latest",
    licenses: "Sample is open source under the MIT license.\nIts fonts are under the SIL Open Font License.",
    logo: { light: `${pixel}#light`, dark: `${pixel}#dark` }
  };

  const of = (kind: UpdateStateKind, fields: Partial<{ version: string; progress: number; checkedAt: number; reason: string; mustMove: boolean }> = {}): UpdateState =>
    new UpdateState(kind, fields.version ?? null, fields.progress ?? null, fields.checkedAt ?? null, fields.reason ?? null, fields.mustMove ?? false);

  beforeEach(() => {
    state = signal(UpdateState.off);
    calls = [];
    errors = [];
    bridge = PreloadBridgeFixture.install("darwin");
    bridge.processor = "arm64";
    TestBed.configureTestingModule({
      providers: [
        { provide: UpdateService, useValue: { state, act: (action: string) => calls.push(action) } },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    PreloadBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  async function renderAsync(): Promise<ComponentFixture<AboutComponent>> {
    const fixture = TestBed.createComponent(AboutComponent);
    await fixture.whenStable();
    return fixture;
  }

  function renderWithAsync(about: IProductAbout): Promise<ComponentFixture<AboutComponent>> {
    TestBed.overrideProvider(BuildTokens.about, { useValue: about });
    return renderAsync();
  }

  function hostOf(fixture: ComponentFixture<AboutComponent>): HTMLElement {
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new Error("About's host is not an element.");
    return host;
  }

  function parts(fixture: ComponentFixture<AboutComponent>): readonly string[] {
    return [...hostOf(fixture).children].map(t => String(t.classList[0]));
  }

  function links(fixture: ComponentFixture<AboutComponent>): readonly HTMLAnchorElement[] {
    return [...hostOf(fixture).querySelectorAll<HTMLAnchorElement>("a")];
  }

  function text(fixture: ComponentFixture<AboutComponent>, selector: string): string {
    return String(hostOf(fixture).querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim());
  }

  function buttons(fixture: ComponentFixture<AboutComponent>): readonly HTMLButtonElement[] {
    return [...hostOf(fixture).querySelectorAll<HTMLButtonElement>("button")];
  }

  function find<T extends Element>(fixture: ComponentFixture<AboutComponent>, selector: string, type: abstract new () => T): T {
    const found = hostOf(fixture).querySelector(selector);
    if (!(found instanceof type))
      throw new Error(`No ${type.name} matches ${selector}.`);
    return found;
  }

  it("names Noldova Desktop Sample's version, platform and processor as a region of the page", async () => {
    const fixture = await renderAsync();
    const host = hostOf(fixture);

    expect([text(fixture, ".nol-about-title"), text(fixture, ".nol-about-platform")]).toEqual(["Noldova Desktop Sample 1.2.3", "macOS ARM64"]);
    expect([host.getAttribute("role"), host.getAttribute("aria-label"), host.classList.contains("nol-settings-group")]).toEqual(["region", "About Noldova Desktop Sample", true]);
  });

  it("names the app by the name it started the window with, in its title and its region's name", async () => {
    const started = ProductName.current;
    ProductName.use("Example Product");
    try {
      const fixture = await renderAsync();

      expect([text(fixture, ".nol-about-title"), hostOf(fixture).getAttribute("aria-label")]).toEqual(["Example Product 1.2.3", "About Example Product"]);
    }
    finally {
      ProductName.use(started);
    }
  });

  it("shows the description under the name, the website by its host and Releases, and the licences after the updates, as the app supplies them", async () => {
    const fixture = await renderWithAsync(supplied);
    const host = hostOf(fixture);

    expect(parts(fixture)).toEqual(["nol-about-heading", "nol-about-description", "nol-about-platform", "nol-about-links", "nol-about-state", "nol-about-licenses-title",
      "nol-about-licenses"]);
    expect([text(fixture, ".nol-about-description"), text(fixture, ".nol-about-licenses-title"), host.querySelector(".nol-about-licenses")?.textContent])
      .toEqual(["Sample work, done together.", "Licenses", supplied.licenses]);
    expect(links(fixture).map(t => [t.textContent?.trim(), t.getAttribute("href")])).toEqual([["sample.example", supplied.website], ["Releases", supplied.releases]]);
  });

  it("shows only the name, platform and updates for an app that supplies no details", async () => {
    const fixture = await renderAsync();

    expect([parts(fixture), links(fixture).length, hostOf(fixture).querySelector("img")]).toEqual([["nol-about-heading", "nol-about-platform", "nol-about-state"], 0, null]);
  });

  for (const [about, shown] of [
    [{ description: null, website: "sample", releases: null, licenses: null, logo: null }, [["sample", "sample"]]],
    [{ description: null, website: null, releases: "https://github.com/example/sample/releases", licenses: null, logo: null }, [["Releases", "https://github.com/example/sample/releases"]]]
  ] as const)
    it(`shows only the link an app supplies, and an address it can't read as it is: ${JSON.stringify(shown)}`, async () => {
      const fixture = await renderWithAsync(about);

      expect([parts(fixture), links(fixture).map(t => [t.textContent?.trim(), t.getAttribute("href")])]).toEqual([
        ["nol-about-heading", "nol-about-platform", "nol-about-links", "nol-about-state"], shown]);
    });

  it("opens the website and Releases in the system browser, through the window's one path for links", async () => {
    const fixture = await renderWithAsync(supplied);
    const stop = TestBed.inject(LinkService).listen();
    const clicks = links(fixture).map(t => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      t.dispatchEvent(event);
      return event.defaultPrevented;
    });
    await Promise.resolve();
    stop();

    expect([clicks, bridge.links]).toEqual([[true, true], [supplied.website, supplied.releases]]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark])
    it(`shows the mode's logo left of the name and centred on its line, and the details under them on the kit's spacing, in ${mode} mode`, async () => {
      TestBed.overrideProvider(BuildTokens.about, { useValue: supplied });
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      TestBed.inject(AppearanceService).setModePreference(mode === ThemeMode.Dark ? ModePreference.Dark : ModePreference.Light);
      const fixture = await renderAsync();
      const host = hostOf(fixture);
      host.style.width = "800px";
      const box = (selector: string): DOMRect => find(fixture, selector, HTMLElement).getBoundingClientRect();
      const image = find(fixture, ".nol-about-logo", HTMLImageElement);
      const logo = image.getBoundingClientRect();
      const title = box(".nol-about-title");
      const description = box(".nol-about-description");
      const platform = box(".nol-about-platform");
      const row = box(".nol-about-links");
      const state = box(".nol-about-state");
      const heading = box(".nol-about-licenses-title");
      const licenses = box(".nol-about-licenses");
      const anchor = find(fixture, ".nol-about-link:first-child", HTMLAnchorElement);
      const website = anchor.getBoundingClientRect();
      const releases = find(fixture, ".nol-about-link:last-child", HTMLAnchorElement).getBoundingClientRect();
      const link = getComputedStyle(anchor);

      expect(links(fixture)).toHaveLength(2);
      expect([description.top - box(".nol-about-heading").bottom, platform.top - description.bottom, row.top - platform.bottom, heading.top - state.bottom, licenses.top - heading.bottom])
        .toEqual([0.75, 0.25, 0.25, 1.5, 0.25].map(t => AppearanceFixture.toPixels(t)));
      expect([image.getAttribute("src"), image.alt, logo.width, logo.height, title.left - logo.right, (logo.top + logo.bottom) / 2])
        .toEqual([mode === ThemeMode.Dark ? supplied.logo?.dark : supplied.logo?.light, String.empty, AppearanceFixture.toPixels(2.25), AppearanceFixture.toPixels(2.25),
          AppearanceFixture.toPixels(0.75), (title.top + title.bottom) / 2]);
      expect([logo.left, description.left, platform.left, website.left, heading.left, licenses.left]).toEqual(Array(6).fill(host.getBoundingClientRect().left));
      expect([releases.left - website.right, releases.top]).toEqual([AppearanceFixture.toPixels(1), website.top]);
      expect([link.color, link.textDecorationLine]).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, mode, "link"), "underline"]);
      expect(getComputedStyle(find(fixture, ".nol-about-licenses", HTMLElement)).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "text-muted"));
    });

  it("wraps a long unbroken description, website or licences line inside a narrow pane, which then scrolls only down", async () => {
    AppearanceFixture.apply();
    const fixture = await renderWithAsync({
      ...supplied,
      description: "d".repeat(200),
      website: `https://${"w".repeat(60)}.example/`,
      licenses: `Sample is open source: https://sample.example/${"license/".repeat(40)}`
    });
    const host = hostOf(fixture);
    host.style.overflow = "auto";
    host.style.width = "200px";

    expect([find(fixture, ".nol-about-link:first-child", HTMLAnchorElement).textContent, host.scrollWidth]).toEqual([`${"w".repeat(60)}.example`, host.clientWidth]);
  });

  it("names an unknown platform and processor as the main process gives them, and reports a version it cannot read", async () => {
    bridge.platform = "freebsd";
    bridge.processor = "riscv64";
    bridge.build = { productVersion: 3 };

    const fixture = await renderAsync();
    await fixture.whenStable();

    expect([text(fixture, ".nol-about-title"), text(fixture, ".nol-about-platform")]).toEqual(["Noldova Desktop Sample", "freebsd riscv64"]);
    expect(errors.length).toBe(1);
  });

  it("says why a build that cannot update doesn't, with no button", async () => {
    const fixture = await renderAsync();
    const off = [text(fixture, ".nol-about-status"), buttons(fixture).length];
    state.set(of(UpdateStateKind.Available, { version: "1.3.0", reason: "Hidden", mustMove: true }));
    await fixture.whenStable();

    expect(off).toEqual(["Updates are turned off in this build.", 0]);
    expect([text(fixture, ".nol-about-status"), buttons(fixture).length]).toEqual(["Move Noldova Desktop Sample to Applications to get updates.", 0]);
  });

  it("shows each state's line with its action, then the last check, the reason or the move to Applications, the details muted", async () => {
    AppearanceFixture.apply();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 23, 59));
    const today = new Date(2026, 9, 6, 10, 42);
    const earlier = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3, 10, 42).getTime();
    const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(today);
    const dayAndTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(earlier);
    const fixture = await renderAsync();
    const probe = hostOf(fixture).appendChild(document.createElement("span"));
    probe.style.color = "var(--nol-text-muted)";
    const mutedColor = getComputedStyle(probe).color;
    probe.remove();
    const shown: string[] = [];
    const muted: (readonly boolean[])[] = [];
    for (const next of [
      of(UpdateStateKind.UpToDate),
      of(UpdateStateKind.UpToDate, { checkedAt: today.getTime() }),
      of(UpdateStateKind.UpToDate, { checkedAt: earlier }),
      of(UpdateStateKind.Checking),
      of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 }),
      of(UpdateStateKind.Ready, { version: "1.3.0", reason: "Notes couldn't save." }),
      of(UpdateStateKind.Ready),
      of(UpdateStateKind.Failed, { reason: "The download doesn't match the release." }),
      of(UpdateStateKind.Failed, { reason: "The release's information is invalid.", mustMove: true })
    ]) {
      state.set(next);
      await fixture.whenStable();
      const lines = [...hostOf(fixture).querySelectorAll<HTMLElement>(".nol-about-status > span")];
      shown.push(`${lines.map(t => t.textContent).join(" / ")} | ${buttons(fixture).map(t => t.textContent?.trim()).join(",")}`);
      muted.push(lines.map(t => getComputedStyle(t).color === mutedColor));
      for (const button of buttons(fixture))
        button.click();
    }

    expect(shown).toEqual([
      "Noldova Desktop Sample is up to date. | Check for updates",
      `Noldova Desktop Sample is up to date. / Last checked ${time}. | Check for updates`,
      `Noldova Desktop Sample is up to date. / Last checked ${dayAndTime}. | Check for updates`,
      "Checking for updates… | ",
      "Downloading Noldova Desktop Sample 1.3.0… 42% | ",
      "Noldova Desktop Sample 1.3.0 is ready to install. / Notes couldn't save. | Restart to update",
      "Noldova Desktop Sample is ready to install. | Restart to update",
      "The update failed. / The download doesn't match the release. | Try again",
      "The update failed. / The release's information is invalid. / Move Noldova Desktop Sample to Applications to get updates. | Try again"
    ]);
    expect(muted).toEqual([[false], [false, true], [false, true], [false], [false], [false, true], [false], [false, true], [false, true, false]]);
    expect(calls).toEqual(["Check", "Check", "Check", "Restart", "Restart", "Check", "Check"]);
  });

  it("keeps the download's percentage out of its polite status, since the progress bar carries it", async () => {
    state.set(of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 }));
    const fixture = await renderAsync();
    const status = DomFixture.one(hostOf(fixture), ".nol-about-status");
    const hidden = [...status.querySelectorAll("[aria-hidden=true]")].map(t => t.textContent);

    expect([status.getAttribute("role"), hidden]).toEqual(["status", [" 42%"]]);
  });

  for (const [kind, label] of [[UpdateStateKind.UpToDate, "Check for updates"], [UpdateStateKind.Failed, "Try again"]] as const)
    it(`keeps focus on the update's status once ${label} is chosen and its button goes away`, async () => {
      state.set(of(kind));
      const fixture = await renderAsync();
      const button = DomFixture.present(buttons(fixture)[0]);
      button.focus();

      button.click();
      state.set(of(UpdateStateKind.Checking));
      await fixture.whenStable();

      expect([button.textContent?.trim(), buttons(fixture).length, document.activeElement?.className, calls]).toEqual([label, 0, "nol-about-status", ["Check"]]);
    });

  it("keeps focus on the update's status when a check it didn't ask for removes the focused button, and never takes focus from anywhere else", async () => {
    state.set(of(UpdateStateKind.UpToDate));
    const fixture = await renderAsync();
    const outside = document.body.appendChild(document.createElement("button"));
    DomFixture.present(buttons(fixture)[0]).focus();

    state.set(of(UpdateStateKind.Checking));
    await fixture.whenStable();
    const onButton = document.activeElement?.className;
    state.set(of(UpdateStateKind.Ready, { version: "1.3.0" }));
    await fixture.whenStable();
    DomFixture.present(buttons(fixture)[0]).focus();
    state.set(of(UpdateStateKind.Ready, { version: "1.3.0", reason: "Notes couldn't save." }));
    await fixture.whenStable();
    const kept = document.activeElement?.textContent?.trim();
    outside.focus();
    state.set(of(UpdateStateKind.Failed));
    await fixture.whenStable();
    const elsewhere = document.activeElement;
    outside.remove();

    expect([onButton, kept, elsewhere === outside]).toEqual(["nol-about-status", "Restart to update", true]);
  });

  it("shows the download's progress below its line and as wide as it, named for the download, and an unknown amount while it has none", async () => {
    AppearanceFixture.apply();
    state.set(of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 }));
    const fixture = await renderAsync();
    const host = hostOf(fixture);
    host.style.width = "800px";
    const bar = (): HTMLElement | null => host.querySelector("[role=progressbar]");
    const line = DomFixture.one(host, ".nol-about-update").getBoundingClientRect();
    const track = DomFixture.one(host, ".nol-about-progress").getBoundingClientRect();
    const known = [bar()?.getAttribute("aria-label"), bar()?.getAttribute("aria-valuenow")];
    state.set(of(UpdateStateKind.Downloading));
    await fixture.whenStable();
    const unknown = [bar()?.getAttribute("aria-label"), bar()?.getAttribute("aria-valuenow")];
    state.set(of(UpdateStateKind.Ready, { version: "1.3.0" }));
    await fixture.whenStable();

    expect([track.left, track.width, track.top - line.bottom]).toEqual([line.left, line.width, AppearanceFixture.toPixels(0.25)]);
    expect(line.width).toBeLessThan(400);
    expect(known).toEqual(["Downloading Noldova Desktop Sample 1.3.0", "0.42"]);
    expect(unknown).toEqual(["Downloading Noldova Desktop Sample", null]);
    expect(bar()).toBeNull();
  });
});
