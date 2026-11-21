/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NotificationPost, NotificationSeverity, NotificationState } from "@noldova/desktop.protocol";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { DomFixture } from "../../../fixtures/dom.fixture";
import { NotificationsFixture } from "../../../fixtures/notifications.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";

describe("NotificationsPopoverComponent", () => {
  let service: NotificationsFixture;

  beforeEach(() => {
    service = NotificationsFixture.install();
  });

  afterEach(() => {
    NotificationsFixture.remove();
    AppearanceFixture.reset();
  });

  it("lists each notification with its severity, title, text, module, time, progress and actions, and says when there are none", async () => {
    const fixture = await NotificationsFixture.renderAsync();
    const empty = (await NotificationsFixture.openAsync(fixture)).querySelector(".nol-notifications-empty")?.textContent;
    service.stateValue.set(new NotificationState([
      NotificationsFixture.createNotification(3, "notes.saved", "Saved", { severity: NotificationSeverity.Success, text: "Plan.md", open: "notes.open", actions: ["notes.undo", "clock.reset"], isRead: true }),
      NotificationsFixture.createNotification(2, "clock.sync", "Syncing", { severity: NotificationSeverity.Warning, progress: NotificationPost.indeterminate, isRead: true }),
      NotificationsFixture.createNotification(1, "clock.sync", "Copying", { severity: NotificationSeverity.Error, progress: 0.25, isRead: true })
    ], false, [], 0));
    await fixture.whenStable();
    const rows = [...DomFixture.present(NotificationsFixture.findPopover()).querySelectorAll<HTMLElement>(".nol-notifications-row")];

    expect(empty).toBe("No notifications");
    expect(rows.map(t => [t.dataset["notification"], t.querySelector(".nol-notifications-severity")?.getAttribute("aria-label"), t.querySelector(".nol-notifications-row-title")?.textContent?.trim()]))
      .toEqual([["3", "Success", "Saved"], ["2", "Warning", "Syncing"], ["1", "Error", "Copying"]]);
    expect(rows[0]?.querySelector(".nol-notifications-text")?.textContent).toBe("Plan.md");
    expect(rows[0]?.querySelector(".nol-notifications-meta")?.textContent).toMatch(/^Notes · \d{1,2}:05/);
    expect(rows[1]?.querySelector(".nol-notifications-meta")?.textContent).toMatch(/^clock · /);
    expect(rows[1]?.querySelector("nol-progress")?.hasAttribute("aria-valuenow")).toBe(false);
    expect(rows[2]?.querySelector("nol-progress")?.getAttribute("aria-valuenow")).toBe("0.25");
    expect([...rows[0]?.querySelectorAll<HTMLButtonElement>(".nol-notifications-action") ?? []].map(t => [t.textContent?.trim(), t.disabled]))
      .toEqual([["Run notes.undo", false], ["Run clock.reset", true]]);
    expect(rows[0]?.querySelector<HTMLButtonElement>("button.nol-notifications-open")?.disabled).toBe(false);
    expect(rows[1]?.querySelector("button.nol-notifications-open")).toBeNull();
  });

  it("scrolls its list from edge to edge of the popover and down to its bottom, with the popover's padding inside the list, so its rows start and end where they did and a row brought into view keeps that padding below it", async () => {
    service.stateValue.set(new NotificationState(Array.from({ length: 30 }, (_, t) => NotificationsFixture.createNotification(t + 1, "clock.sync", `Tick ${t + 1}`, { text: "The clock ticked.", isRead: true })), false, [], 0));
    AppearanceFixture.apply();
    const fixture = await NotificationsFixture.renderAsync();
    const popover = await NotificationsFixture.openAsync(fixture);
    const list = DomFixture.one(popover, ".nol-notifications-list");
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const inRem = (pixels: number): number => Math.round(pixels / rem * 100) / 100 + 0;
    const border = Number.parseFloat(getComputedStyle(popover).borderTopWidth);
    const whole = popover.getBoundingClientRect();
    const box = list.getBoundingClientRect();
    const header = DomFixture.one(popover, ".nol-notifications-header").getBoundingClientRect();
    const row = DomFixture.one(list, ".nol-notifications-row").getBoundingClientRect();
    const scrollbar = list.offsetWidth - list.clientWidth;
    const below = DomFixture.present([...list.querySelectorAll<HTMLElement>(".nol-notifications-row")].find(t => t.getBoundingClientRect().top >= box.bottom));
    below.scrollIntoView({ block: "nearest" });
    const revealed = inRem(list.getBoundingClientRect().bottom - below.getBoundingClientRect().bottom);

    expect([list.scrollHeight > list.clientHeight, popover.scrollHeight > popover.clientHeight]).toEqual([true, false]);
    expect([box.left - whole.left - border, whole.right - border - box.right, whole.bottom - border - box.bottom].map(inRem)).toEqual([0, 0, 0]);
    expect([row.left - header.left, header.right - scrollbar - row.right].map(inRem)).toEqual([0, 0]);
    expect(inRem(Number.parseFloat(getComputedStyle(list).paddingBottom))).toBe(0.75);
    expect([below === list.lastElementChild, revealed]).toEqual([false, 0.75]);
  });

  it("runs an action or the open command and closes, dismisses one, clears all and switches Do not disturb", async () => {
    service.stateValue.set(new NotificationState([
      NotificationsFixture.createNotification(2, "notes.saved", "Saved", { open: "notes.open", actions: ["notes.undo"], isRead: true }),
      NotificationsFixture.createNotification(1, "clock.sync", "Syncing", { progress: 0.5, isRead: true })
    ], false, [], 0));
    const fixture = await NotificationsFixture.renderAsync();

    (await NotificationsFixture.openAsync(fixture)).querySelector<HTMLButtonElement>(".nol-notifications-action")?.click();
    await fixture.whenStable();
    const closedAfterAction = NotificationsFixture.findPopover();
    (await NotificationsFixture.openAsync(fixture)).querySelector<HTMLButtonElement>("button.nol-notifications-open")?.click();
    await fixture.whenStable();
    const list = await NotificationsFixture.openAsync(fixture);
    await TooltipFixture.expectTooltipAsync(DomFixture.oneOf(list, ".nol-notifications-dismiss", HTMLButtonElement), "Dismiss");
    list.querySelector<HTMLButtonElement>(".nol-notifications-dismiss")?.click();
    list.querySelector<HTMLButtonElement>(".nol-notifications-clear")?.click();
    list.querySelector<HTMLInputElement>(".nol-notifications-quiet .nol-checkbox-box")?.click();

    expect(closedAfterAction).toBeNull();
    expect(service.calls).toEqual(["run notes.undo", "run notes.open", "dismiss 2", "clear", "quiet true"]);
  });

  it("moves the focus from a dismissed row to the next row's Dismiss, else the previous row's, else the popover", async () => {
    const all = [3, 2, 1].map(t => NotificationsFixture.createNotification(t, "clock.sync", `Tick ${t}`, { isRead: true }));
    service.stateValue.set(new NotificationState(all, false, [], 0));
    const fixture = await NotificationsFixture.renderAsync();
    const popover = await NotificationsFixture.openAsync(fixture);
    const dismissOf = (id: number): HTMLButtonElement => DomFixture.oneOf(popover, `[data-notification="${id}"] .nol-notifications-dismiss`, HTMLButtonElement);
    const dismissAsync = async (id: number): Promise<string | null> => {
      dismissOf(id).focus();
      dismissOf(id).click();
      service.stateValue.set(new NotificationState(service.stateValue().notifications.filter(t => t.id !== String(id)), false, [], 0));
      await fixture.whenStable();
      return document.activeElement === popover ? "popover" : document.activeElement?.closest<HTMLElement>("[data-notification]")?.dataset["notification"] ?? null;
    };

    const middle = await dismissAsync(2);
    const last = await dismissAsync(1);
    const only = await dismissAsync(3);

    expect([middle, last, only]).toEqual(["1", "3", "popover"]);
    expect(service.calls.filter(t => t.startsWith("dismiss"))).toEqual(["dismiss 2", "dismiss 1", "dismiss 3"]);
  });

  it("checks its Do not disturb box while Do not disturb is on", async () => {
    const fixture = await NotificationsFixture.renderAsync();

    const list = await NotificationsFixture.openAsync(fixture);
    const box = list.querySelector<HTMLInputElement>(".nol-notifications-quiet .nol-checkbox-box");
    const unchecked = box?.checked;
    service.stateValue.set(new NotificationState([], true, [], 0));
    await fixture.whenStable();

    expect([unchecked, box?.checked, list.querySelector(".nol-notifications-quiet .nol-checkbox-text")?.textContent?.trim()]).toEqual([false, true, "Do not disturb"]);
  });

  it("disables Clear all while every notification is in progress and reports an action that fails", async () => {
    service.stateValue.set(new NotificationState([NotificationsFixture.createNotification(1, "clock.sync", "Syncing", { progress: 0.5, actions: ["clock.cancel"], isRead: true })], false, [], 0));
    service.failure = new Error("The clock stopped.");
    const fixture = await NotificationsFixture.renderAsync();

    const list = await NotificationsFixture.openAsync(fixture);
    const isClearDisabled = list.querySelector<HTMLButtonElement>(".nol-notifications-clear")?.disabled;
    list.querySelector<HTMLButtonElement>(".nol-notifications-action")?.click();
    await vi.waitFor(() => expect(service.errors.length).toBe(1));

    expect(isClearDisabled).toBe(true);
    expect(service.errors[0]).toHaveProperty("message", "The clock stopped.");
  });
});
