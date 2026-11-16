/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type, inject } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PlaceholderContentComponent } from "../../../../src/app/components/placeholder-content/placeholder-content.component";
import { ContentPadding } from "../../../../src/app/enums/content-padding";
import type { IWindowPart } from "../../../../src/app/interfaces/i-window-part";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { WindowPartContext } from "../../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { WindowPartContextHostFixture } from "../../../fixtures/window-part-context-host.fixture";

@Component({
  selector: "nol-test-start",
  template: "<button type=\"button\" class=\"start\">Start</button>"
})
class TestStartComponent {
  public readonly context: unknown = inject(WindowPartTokens.context);
  public readonly isShown: boolean = inject(WindowPartTokens.shown)();
  public readonly isActiveDocument: boolean = inject(WindowPartTokens.activeDocument)();
}

@Component({
  selector: "nol-test-welcome",
  template: "<p class=\"welcome\">Welcome</p>"
})
class TestWelcomeComponent {
}

describe("PlaceholderContentComponent", () => {
  const context = new WindowPartContext(
    new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), ["notes.start"]), new WindowPartContextHostFixture());
  const match = (component: Type<unknown>, padding: ContentPadding = ContentPadding.Default): ContributionMatch =>
    new ContributionMatch(() => Promise.resolve(component), context, padding);

  async function renderAsync(value: ContributionMatch): Promise<ComponentFixture<PlaceholderContentComponent>> {
    const fixture = TestBed.createComponent(PlaceholderContentComponent);
    fixture.componentRef.setInput("match", value);
    await fixture.whenStable();
    return fixture;
  }

  it("shows the placeholder's component with its module's context, shown, and is loaded once it shows", async () => {
    const fixture = TestBed.createComponent(PlaceholderContentComponent);
    fixture.componentRef.setInput("match", match(TestStartComponent));
    const before = fixture.componentInstance.isLoaded();
    await fixture.whenStable();
    const start = fixture.debugElement.query(By.directive(TestStartComponent)).injector.get(TestStartComponent);

    expect([before, fixture.componentInstance.isLoaded()]).toEqual([false, true]);
    expect([start.context, start.isShown, start.isActiveDocument]).toEqual([context, true, false]);
    expect(fixture.componentInstance.element.querySelector(".start")?.textContent).toBe("Start");
  });

  it("shows another placeholder when its contribution changes", async () => {
    const fixture = await renderAsync(match(TestStartComponent));

    fixture.componentRef.setInput("match", match(TestWelcomeComponent));
    await fixture.whenStable();
    const element = fixture.componentInstance.element;

    expect([element.querySelector(".start"), element.querySelector(".welcome")?.textContent]).toEqual([null, "Welcome"]);
  });

  it("shows nothing, unpadded and not loaded, when its component fails to load", async () => {
    const fixture = await renderAsync(new ContributionMatch(() => Promise.reject(new Error("No chunk.")), context, ContentPadding.Default));
    const element = fixture.componentInstance.element;

    expect([element.children.length, element.classList.contains("nol-placeholder-content-padded"), fixture.componentInstance.isLoaded()]).toEqual([0, false, false]);
  });

  for (const theme of AppearanceFixture.themes)
    it(`pads the placeholder like a document with the ${theme.id} theme's paddings, with a stable scrollbar gutter`, async () => {
      AppearanceFixture.apply(theme);
      try {
        const fixture = await renderAsync(match(TestStartComponent));
        const style = getComputedStyle(fixture.componentInstance.element);

        expect(style.scrollbarGutter).toBe("stable");
        for (const [index, property] of ["padding-top", "padding-right", "padding-bottom", "padding-left"].entries())
          AppearanceFixture.expectLook(style.getPropertyValue(property), theme, index % 2 === 0 ? "document-padding-block" : "content-padding-inline", property);
      }
      finally {
        AppearanceFixture.reset();
      }
    });

  it("leaves a placeholder edge to edge when it opts out, and lets its page turn the padding on until the page resets it", async () => {
    const fixture = await renderAsync(match(TestStartComponent, ContentPadding.None));
    const element = fixture.componentInstance.element;
    const padding = fixture.debugElement.query(By.directive(TestStartComponent)).injector.get(WindowPartTokens.contentPadding);
    const padded = (): boolean => {
      fixture.detectChanges();
      return element.classList.contains("nol-placeholder-content-padded");
    };
    const states = [padded(), getComputedStyle(element).scrollbarGutter];

    padding.set(ContentPadding.Default);
    states.push(padded());
    padding.reset();
    states.push(padded());

    expect(states).toEqual([false, "auto", true, false]);
  });
});
