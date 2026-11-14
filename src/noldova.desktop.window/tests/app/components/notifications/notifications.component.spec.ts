/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { userEvent } from "vitest/browser";

import { NotificationState } from "@noldova/desktop.protocol";
import type { Theme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { NotificationsFixture } from "../../../fixtures/notifications.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { MediaFixture } from "../../../fixtures/media.fixture";

describe("NotificationsComponent", () => {
  let service: NotificationsFixture;

  beforeEach(() => {
    service = NotificationsFixture.install();
  });

  afterEach(() => {
    AppearanceFixture.reset();
    NotificationsFixture.remove();
  });

  it("shows a bell with its unread count, capped at 9+, and a silenced bell while Do not disturb is on", async () => {
    const fixture = await NotificationsFixture.renderAsync();
    const quietLabel = (): string | null => NotificationsFixture.findItem(fixture).getAttribute("aria-label");
    const empty = [NotificationsFixture.findItem(fixture).textContent?.trim(), quietLabel()];

    service.stateValue.set(new NotificationState(Array.from({ length: 12 }, (_, index) => NotificationsFixture.createNotification(index + 1, "clock.alarm", `Alarm ${index}`)), true, [], 0));
    await fixture.whenStable();

    expect(empty).toEqual(["notifications", "Notifications"]);
    expect([NotificationsFixture.findItem(fixture).querySelector(".nol-notifications-icon")?.textContent, NotificationsFixture.findItem(fixture).querySelector(".nol-notifications-count")?.textContent]).toEqual(["notifications_off", "9+"]);
    expect(quietLabel()).toBe("Notifications, 12 unread, Do not disturb");
    await TooltipFixture.expectTooltipAsync(NotificationsFixture.findItem(fixture), "Notifications, 12 unread, Do not disturb");
  });

  it("opens its list, marking everything read only when something is unread, and closes on a second click, Escape and a click outside", async () => {
    service.stateValue.set(new NotificationState([NotificationsFixture.createNotification(1, "clock.alarm", "Alarm")], false, [], 0));
    const fixture = await NotificationsFixture.renderAsync();

    const opened = await NotificationsFixture.openAsync(fixture);
    const expanded = NotificationsFixture.findItem(fixture).getAttribute("aria-expanded");
    NotificationsFixture.findItem(fixture).click();
    await fixture.whenStable();
    const afterSecondClick = NotificationsFixture.findPopover();
    service.stateValue.set(new NotificationState([NotificationsFixture.createNotification(1, "clock.alarm", "Alarm", { isRead: true })], false, [], 0));
    await NotificationsFixture.openAsync(fixture);
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();
    const focusAfterEscape = document.activeElement;
    await NotificationsFixture.openAsync(fixture);
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await fixture.whenStable();

    expect(opened.getAttribute("aria-label")).toBe("Notifications");
    expect(expanded).toBe("true");
    expect(afterSecondClick).toBeNull();
    expect(focusAfterEscape).toBe(NotificationsFixture.findItem(fixture));
    expect(NotificationsFixture.findPopover()).toBeNull();
    expect(service.calls).toEqual(["read"]);
  });

  it("stays open for other keys and closes when something around the item scrolls", async () => {
    const fixture = await NotificationsFixture.renderAsync();

    await NotificationsFixture.openAsync(fixture);
    await userEvent.keyboard("{ArrowDown}");
    await fixture.whenStable();
    const isOpenAfterKey = !Object.isNull(NotificationsFixture.findPopover());
    DomFixture.host(fixture).style.marginTop = "40px";
    DomFixture.host(fixture).dispatchEvent(new Event("scroll"));
    await fixture.whenStable();

    expect(isOpenAfterKey).toBe(true);
    expect(NotificationsFixture.findPopover()).toBeNull();
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`fills its bell under the pointer with the ${theme.id} theme's toolbar hover color in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await NotificationsFixture.renderAsync();
        const item = NotificationsFixture.findItem(fixture);

        const itemStyle = getComputedStyle(item);
        await userEvent.hover(item);
        const hovered = itemStyle.backgroundColor;
        await userEvent.unhover(item);

        expect(channels(hovered)).toEqual(channels(AppearanceFixture.readColor(theme, mode, "toolbar-hover")));
        expect(alpha(hovered)).toBeCloseTo(hoverAlpha(theme, mode), 2);
        AppearanceFixture.expectLook(itemStyle.height, theme, "status-bar-item-height", "height");
        AppearanceFixture.expectLook(itemStyle.width, theme, "status-bar-item-height", "width");
        AppearanceFixture.expectLook(itemStyle.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`is a square of the status bar item's height with its bell centred, and a pill once something is unread, with the ${theme.id} theme in ${mode} mode and with forced colors`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await NotificationsFixture.renderAsync();
        const item = NotificationsFixture.findItem(fixture);
        const showAsync = async (unread: number): Promise<void> => {
          service.stateValue.set(new NotificationState(Array.from({ length: unread }, (_, index) => NotificationsFixture.createNotification(index + 1, "clock.alarm", `Alarm ${index}`)), false, [], 0));
          await fixture.whenStable();
        };
        const measure = (): { width: number; height: number; start: number; end: number; middle: number } => {
          const box = item.getBoundingClientRect();
          const bell = DomFixture.one(item, ".nol-notifications-icon").getBoundingClientRect();
          const last = item.querySelector(".nol-notifications-count")?.getBoundingClientRect() ?? bell;
          return { width: box.width, height: box.height, start: bell.left - box.left, end: box.right - last.right, middle: (bell.top + bell.bottom - box.top - box.bottom) / 2 };
        };

        const quiet = measure();
        await showAsync(1);
        const counted = measure();
        await MediaFixture.forceColorsAsync("active");
        try {
          const forcedCounted = measure();
          await showAsync(0);
          const forcedQuiet = measure();
          const side = AppearanceFixture.measureLook("status-bar-item-height");
          const pill = AppearanceFixture.measureLook("pill-padding");

          expect(matchMedia("(forced-colors: active)").matches).toBe(true);
          const pairs: [number, number][] = [[quiet.width, side], [quiet.height, side], [quiet.start, quiet.end], [quiet.middle, 0], [counted.height, side], [counted.start, pill], [counted.end, pill], [counted.middle, 0]];
          for (const [forced, shown] of [[forcedQuiet, quiet], [forcedCounted, counted]] as const)
            pairs.push([forced.width, shown.width], [forced.height, shown.height], [forced.start, shown.start], [forced.end, shown.end], [forced.middle, shown.middle]);
          for (const [shown, wanted] of pairs)
            AppearanceFixture.expectPixels(shown, wanted);
          expect(counted.width).toBeGreaterThan(side);
        }
        finally {
          await MediaFixture.forceColorsAsync("none");
        }
      });

  function channels(color: string): string[] {
    return (color.match(/[\d.]+/gu) ?? []).slice(0, 3);
  }

  function alpha(color: string): number {
    return Number((color.match(/[\d.]+/gu) ?? [])[3] ?? "1");
  }

  function hoverAlpha(theme: Theme, mode: ThemeMode): number {
    const color = theme.readColor(mode, "toolbar-hover") ?? String.empty;
    return color.length === 9 ? Number.parseInt(color.slice(7, 9), 16) / 255 : 1;
  }
});
