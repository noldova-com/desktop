/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";

import { EmptyWindowComponent } from "../../../../src/app/components/empty-window/empty-window.component";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("EmptyWindowComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  it("shows the product name and that there are no modules, in muted text a small space apart", () => {
    AppearanceFixture.apply();
    const fixture = TestBed.createComponent(EmptyWindowComponent);
    fixture.detectChanges();
    const root: HTMLElement = DomFixture.host(fixture);

    expect([...root.querySelectorAll("p")].map(t => t.textContent)).toEqual(["Noldova Desktop Sample", "No modules"]);
    expect(getComputedStyle(root).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "text-muted"));
    AppearanceFixture.expectLook(getComputedStyle(root).rowGap, DefaultTheme.theme, "space-1", "row-gap", "gap");
  });
});
