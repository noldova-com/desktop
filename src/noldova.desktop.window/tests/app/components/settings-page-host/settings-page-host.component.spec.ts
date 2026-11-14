/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, ErrorHandler, type InputSignal, type Signal, type Type, inject, input } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ModuleState } from "@noldova/desktop.protocol";

import { SettingsPageHostComponent } from "../../../../src/app/components/settings-page-host/settings-page-host.component";
import { WindowPartFailureException } from "../../../../src/app/exceptions/window-part-failure.exception";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { SettingsPageContribution } from "../../../../src/app/models/settings-page-contribution";
import { SettingsPageEntry } from "../../../../src/app/models/settings/settings-page-entry";
import { WindowPartContext } from "../../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { ModuleStatusFixture } from "../../../fixtures/module-status.fixture";
import { WindowPartContextHostFixture } from "../../../fixtures/window-part-context-host.fixture";

const injected: { context: unknown; shown: boolean | null }[] = [];

@Component({
  selector: "nol-spec-account-page",
  template: `<p class="nol-spec-account">Signed in</p>`
})
class FakeAccountComponent {
  public constructor() {
    const shown: Signal<boolean> = inject(WindowPartTokens.shown);
    injected.push({ context: inject(WindowPartTokens.context), shown: shown() });
  }
}

@Component({
  selector: "nol-spec-settings-page-host",
  imports: [SettingsPageHostComponent],
  template: `<nol-settings-page-host [entry]="entry()" />`
})
class SettingsPageHostHostComponent {
  public readonly entry: InputSignal<SettingsPageEntry> = input.required<SettingsPageEntry>();
}

describe("SettingsPageHostComponent", () => {
  let errors: unknown[];
  const source = new WindowPartSource("clock", [], [], [], [], [], [], [], () => Promise.reject(new Error("unused")), [], [], [{ name: "clock.account", title: "Account" }]);
  const context = new WindowPartContext(source, new WindowPartContextHostFixture());
  const entry = (moduleId: string, loadComponent: () => Promise<Type<unknown>>): SettingsPageEntry =>
    new SettingsPageEntry(`${moduleId}.account`, "Account", moduleId, new SettingsPageContribution(`${moduleId}.account`, loadComponent), context, null);

  beforeEach(() => {
    errors = [];
    injected.length = 0;
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
  });

  async function renderAsync(shown: SettingsPageEntry): Promise<ComponentFixture<SettingsPageHostComponent>> {
    const fixture = TestBed.createComponent(SettingsPageHostComponent);
    fixture.componentRef.setInput("entry", shown);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const texts = (host: HTMLElement, selector: string): readonly string[] => DomFixture.all(host, selector).map(t => t.textContent?.trim() ?? String.empty);

  it("shows the module's page with the module's context, as shown, and nothing else once it has loaded", async () => {
    const host = DomFixture.host(await renderAsync(entry("clock", () => Promise.resolve(FakeAccountComponent))));

    expect([texts(host, ".nol-spec-account"), host.querySelectorAll("nol-spinner").length, host.querySelectorAll("nol-module-failure-card").length]).toEqual([["Signed in"], 0, 0]);
    expect(injected).toHaveLength(1);
    expect(injected[0]?.context).toBe(context);
    expect(injected[0]?.shown).toBe(true);
    expect(errors).toEqual([]);
  });

  it("shows a spinner while the page has nothing to load", async () => {
    const host = DomFixture.host(await renderAsync(new SettingsPageEntry("clock.account", "Account", "clock", null, context, null)));

    expect([host.querySelectorAll("nol-spinner").length, host.querySelectorAll("nol-module-failure-card").length, injected.length]).toEqual([1, 0, 0]);
  });

  it("shows the module's own failure in place of its page while the module has failed", async () => {
    const load = (): Promise<Type<unknown>> => Promise.resolve(FakeAccountComponent);
    const failure = new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its window part failed to activate.", []);
    const failed = new SettingsPageEntry("clock.account", "Account", "clock", new SettingsPageContribution("clock.account", load), context, failure);

    const host = DomFixture.host(await renderAsync(failed));

    expect([texts(host, ".nol-module-failure-card-cause"), host.querySelectorAll("nol-spinner").length]).toEqual([["Its window part failed to activate."], 0]);
    expect(texts(host, ".nol-module-failure-card-title").some(t => t.includes("Clock"))).toBe(true);
    expect(errors).toEqual([]);
  });

  it("reports a page that fails to load and shows a card naming its module, by the runtime's name when it reports one and by its id when not", async () => {
    ModuleStatusFixture.report(ModuleStatusFixture.create("notes", "Notes"));

    const named = DomFixture.host(await renderAsync(entry("notes", () => Promise.reject(new Error("No chunk.")))));
    const unnamed = DomFixture.host(await renderAsync(entry("radio", () => Promise.reject(new Error("No tuner.")))));

    expect([texts(named, ".nol-module-failure-card-cause"), texts(unnamed, ".nol-module-failure-card-cause")])
      .toEqual([["Its settings page could not be loaded."], ["Its settings page could not be loaded."]]);
    expect([texts(named, ".nol-module-failure-card-title").some(t => t.includes("Notes")), texts(unnamed, ".nol-module-failure-card-title").some(t => t.includes("radio"))])
      .toEqual([true, true]);
    expect(errors.map(t => t instanceof WindowPartFailureException ? [t.moduleId, t.message, t.cause instanceof Error ? t.cause.message : null] : t))
      .toEqual([["notes", "Its settings page could not be loaded.", "No chunk."], ["radio", "Its settings page could not be loaded.", "No tuner."]]);
  });

  it("insets the page by the settings edge and lays its rows out as a column", async () => {
    const fixture = TestBed.createComponent(SettingsPageHostHostComponent);
    fixture.componentRef.setInput("entry", entry("clock", () => Promise.resolve(FakeAccountComponent)));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = DomFixture.one(DomFixture.host(fixture), "nol-settings-page-host");
    host.style.setProperty("--nol-settings-edge", "16px");
    host.style.setProperty("--nol-row-gap", "8px");
    const rows = document.createElement("div");
    rows.className = "nol-settings-rows";
    const row = document.createElement("div");
    row.className = "nol-setting-row";
    rows.append(row);
    host.append(rows);

    const style = getComputedStyle(host);
    const rowStyle = getComputedStyle(row);
    const rowsStyle = getComputedStyle(rows);

    expect([style.display, style.paddingLeft, style.paddingRight]).toEqual(["block", "16px", "16px"]);
    expect([rowsStyle.display, rowsStyle.flexDirection, rowsStyle.rowGap]).toEqual(["flex", "column", "8px"]);
    expect([rowStyle.display, rowStyle.flexDirection, rowStyle.marginLeft, rowStyle.marginRight]).toEqual(["flex", "column", "-16px", "-16px"]);
    expect(row.getBoundingClientRect().left - host.getBoundingClientRect().left).toBe(0);
  });
});
