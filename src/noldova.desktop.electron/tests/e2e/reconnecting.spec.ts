/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import type { Locator, Page } from "@playwright/test";

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { NotesOptionsFixture } from "./fixtures/notes-options.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import type { IKeptRecord, IReconnectRecord, IStartupRecord } from "./fixtures/page-globals.d.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

interface IReconnectResult {
  readonly isSameWorkspace: boolean;
  readonly card: string;
}

function scrollAsync(content: Locator): Promise<number> {
  return content.evaluate(async t => {
    t.scrollTop += 60;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return t.scrollTop;
  });
}

async function watchAsync(window: Page): Promise<void> {
  await window.evaluate(() => {
    const record: IReconnectRecord = { workspace: document.querySelector("nol-workspace"), wasInert: false, card: "" };
    new MutationObserver(() => {
      record.wasInert ||= record.workspace?.hasAttribute("inert") === true;
      record.card ||= document.querySelector(".nol-window-reconnecting [role=status]")?.textContent?.trim() ?? "";
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["inert"] });
    globalThis.reconnecting = record;
  });
}

function notificationIdsAsync(window: Page, kind: string): Promise<string[]> {
  return PageBridgeFixture.evaluateAsync(window, t => t.request("desktop.notifications", {}))
    .then(answer => JsonReader.fromValue(answer).readObject("payload").readObjectArray("notifications")
      .filter(t => t.readObject("post").readString("kind") === kind).map(t => t.readString("id")));
}

async function reconnectAsync(window: Page, dataDirectory: string): Promise<IReconnectResult> {
  await MainProcessFixture.stopRuntimeAsync(dataDirectory);
  await expect.poll(() => window.evaluate(() => globalThis.reconnecting?.wasInert)).toBe(true);
  await expect(window.locator(".nol-window-reconnecting")).toHaveCount(0);
  await expect(window.locator("nol-workspace")).not.toHaveAttribute("inert");
  return window.evaluate(() => {
    const record = globalThis.reconnecting;
    return { isSameWorkspace: record !== undefined && record.workspace === document.querySelector("nol-workspace"), card: record?.card ?? "" };
  });
}

interface ICoverRecord {
  readonly cover: number[];
  readonly dialog: number[];
  readonly workspace: number[];
  readonly hit: string;
  readonly isInert: boolean;
}

const coverModes: readonly [string, Parameters<Page["emulateMedia"]>[0]][] = [
  ["light", { colorScheme: "light", forcedColors: "none" }],
  ["dark", { colorScheme: "dark", forcedColors: "none" }],
  ["forced-colors", { forcedColors: "active" }]
];

function reconnections(count: number): string[] {
  return Array.from({ length: count }, () => ["Connecting", "Ready"]).flat();
}

async function watchStartupsAsync(window: Page): Promise<void> {
  await PageBridgeFixture.evaluateAsync(window, t => {
    const states: string[] = [];
    t.onStartup(u => states.push(u.kind));
    globalThis.startups = states;
  });
}

function readStartupsAsync(window: Page): Promise<string[]> {
  return window.evaluate(() => globalThis.startups ?? []);
}

async function openDialogAsync(window: Page, text: string): Promise<Locator> {
  await window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]").click();
  await window.locator("[data-fixture-content=notes-dialog-1]:visible").click();
  const name = window.locator("[data-fixture-content=notes-dialog-name]");
  await expect(name).toBeFocused();
  await name.fill(text);
  return name;
}

function readCoverAsync(window: Page): Promise<ICoverRecord> {
  return window.evaluate(() => {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const box = (element: Element | null): number[] => {
      const rect = element?.getBoundingClientRect();
      return rect === undefined ? [] : [rect.left, rect.top, rect.right, rect.bottom].map(t => t / rem);
    };
    const cover = document.querySelector(".nol-window-covering");
    const name = document.querySelector("[data-fixture-content=notes-dialog-name]");
    const rect = name?.getBoundingClientRect();
    const hit = rect === undefined ? null : document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      cover: box(cover),
      dialog: box(document.querySelector("nol-notes-dialog nol-dialog")),
      workspace: box(document.querySelector("nol-workspace")),
      hit: cover?.contains(hit) === true ? "cover" : hit === name ? "name" : hit?.tagName.toLowerCase() ?? "",
      isInert: name?.closest("[inert]") !== null
    };
  });
}

test.describe("reconnecting", () => {
  test("the workspace stays under the startup card while the runtime starts again and keeps a document's focus, scroll position and typed text", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await SettingsFixture.openGalleryAsync(window);
    const content = window.locator(".nol-settings-content");
    const field = content.locator("input[nol-text-field][type=text]").first();
    await field.fill("A draft not saved yet");
    const top = await scrollAsync(content);
    expect(top).toBeGreaterThan(0);
    await expect(field).toBeFocused();
    await watchAsync(window);

    mainProcess.acceptRuntimeEnds();
    const record = await reconnectAsync(window, mainProcess.dataDirectory);

    expect(record).toEqual({ isSameWorkspace: true, card: expect.stringMatching(/^Starting .+…$/) });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("A draft not saved yet");
    expect(await content.evaluate(t => t.scrollTop)).toBe(top);
    await mainProcess.checkpointAsync("reconnecting-kept");
  });

  test("a module's document whose part continues keeps its focus, scroll position and typed text and shows the new runtime's state, while a part that asks to be rebuilt is rebuilt", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const note = window.locator("nol-notes-note", { has: window.locator("[data-fixture-content=notes-note-2]") });
    const runtime = note.locator("[data-fixture-content=notes-runtime]");
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    const first = await runtime.textContent() ?? String.empty;
    const summary = note.locator("textarea");
    await summary.fill("A summary not saved yet");
    const content = window.locator("nol-tab-content", { has: note });
    const top = await scrollAsync(content);
    expect(top).toBeGreaterThan(0);
    await expect(summary).toBeFocused();
    await watchAsync(window);
    await window.evaluate(() => {
      const record: IKeptRecord = {
        note: document.querySelector("nol-notes-note:has([data-fixture-content=notes-note-2])"),
        clock: document.querySelector("[data-fixture-content=clock-face]")
      };
      globalThis.kept = record;
    });

    mainProcess.acceptRuntimeEnds();
    const record = await reconnectAsync(window, mainProcess.dataDirectory);

    expect(record.isSameWorkspace).toBe(true);
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    await expect(runtime).not.toHaveText(first);
    await expect(runtime).toHaveAttribute("data-continued", "1");
    await expect.poll(() => window.evaluate(() => {
      const kept = globalThis.kept;
      return [kept?.note?.isConnected, kept?.clock?.isConnected, document.querySelector("[data-fixture-content=clock-face]") !== null];
    })).toEqual([true, false, true]);
    await expect(summary).toBeFocused();
    await expect(summary).toHaveValue("A summary not saved yet");
    expect(await content.evaluate(t => t.scrollTop)).toBe(top);
    await mainProcess.checkpointAsync("reconnecting-module-kept");
  });

  test("a runtime killed by its process id is started again under the startup card, and a request after it reaches the new runtime", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    const killed = await mainProcess.readRuntimeProcessIdAsync();
    expect(killed).toBeDefined();
    await watchAsync(window);

    mainProcess.acceptRuntimeEnds();
    process.kill(killed ?? 0, "SIGKILL");

    await expect.poll(() => window.evaluate(() => globalThis.reconnecting?.wasInert)).toBe(true);
    await expect(window.locator(".nol-window-reconnecting")).toHaveCount(0);
    await expect(window.locator("nol-workspace")).not.toHaveAttribute("inert");
    const record = await window.evaluate(() => {
      const kept = globalThis.reconnecting;
      return { isSameWorkspace: kept !== undefined && kept.workspace === document.querySelector("nol-workspace"), card: kept?.card ?? "" };
    });
    expect(record).toEqual({ isSameWorkspace: true, card: expect.stringMatching(/^Starting .+…$/) });
    const started = await mainProcess.readRuntimeProcessIdAsync();
    expect(started).toBeDefined();
    expect(started).not.toBe(killed);
    expect(MainProcessFixture.isAlive(killed ?? 0)).toBe(false);
    expect(await notificationIdsAsync(window, "notes.saveFailed")).toEqual(expect.any(Array));
  });

  test("the startup card covers a dialog a window part opened while the runtime cannot start, in light, dark and forced colors, and the dialog under it takes no click", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const name = await openDialogAsync(window, "A name not saved yet");
    await watchStartupsAsync(window);

    for (let end = 1; end < 6; end++) {
      await mainProcess.receiveInvalidFrameAsync();
      await expect.poll(() => readStartupsAsync(window)).toEqual(reconnections(end));
    }
    await mainProcess.receiveInvalidFrameAsync();
    const card = window.locator(".nol-window-covering .nol-startup-card");
    await expect(card.getByRole("button", { name: "Try again" })).toBeVisible();

    for (const [mode, media] of coverModes) {
      await MediaFixture.emulateAsync(window, media);
      const cover = await readCoverAsync(window);
      expect(cover.isInert).toBe(true);
      expect(cover.hit).toBe("cover");
      expect(cover.dialog).toHaveLength(4);
      expect(cover.cover[0]).toBeLessThanOrEqual(cover.dialog[0] ?? Number.NaN);
      expect(cover.cover[1]).toBeLessThanOrEqual(cover.dialog[1] ?? Number.NaN);
      expect(cover.cover[2]).toBeGreaterThanOrEqual(cover.dialog[2] ?? Number.NaN);
      expect(cover.cover[3]).toBeGreaterThanOrEqual(cover.dialog[3] ?? Number.NaN);
      expect(cover.cover).toHaveLength(4);
      cover.cover.forEach((edge, index) => expect(edge).toBeCloseTo(cover.workspace[index] ?? Number.NaN, 2));
      await mainProcess.checkpointAsync(`reconnecting-covers-dialog-${mode}`);
    }
    await MediaFixture.emulateAsync(window, { colorScheme: "light", forcedColors: "none" });
    const box = await name.boundingBox();
    await window.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    await window.keyboard.type(" and more");
    await expect(name).not.toBeFocused();
    await expect(name).toHaveValue("A name not saved yet");

    await card.getByRole("button", { name: "Try again" }).click();

    await expect(window.locator(".nol-window-covering")).toHaveCount(0);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("A name not saved yet");
    const logged = mainProcess.acceptFailures(/The main process ended its connection to the runtime|The runtime could not be started or reached/);
    expect(logged).toHaveLength(6);
  });

  test("a dialog a window part opened is usable again with its typed text once the runtime is ready, in light, dark and forced colors", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const name = await openDialogAsync(window, "A name not saved yet");
    await window.evaluate(() => {
      const host = document.querySelector("[data-fixture-content=notes-dialog-name]")?.closest(".cdk-overlay-container > *");
      const record = { wasInert: false, wasCovered: false };
      new MutationObserver(() => {
        record.wasInert ||= host?.hasAttribute("inert") === true;
        record.wasCovered ||= document.querySelector(".nol-window-covering") !== null;
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["inert"] });
      globalThis.covering = record;
    });

    mainProcess.acceptRuntimeEnds();
    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);

    await expect.poll(() => window.evaluate(() => globalThis.covering)).toEqual({ wasInert: true, wasCovered: true });
    await expect(window.locator(".nol-window-covering")).toHaveCount(0);
    await expect(window.locator(".nol-window-reconnecting")).toHaveCount(0);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("A name not saved yet");
    for (const [mode, media] of coverModes) {
      await MediaFixture.emulateAsync(window, media);
      const cover = await readCoverAsync(window);
      expect([cover.isInert, cover.hit, cover.cover]).toEqual([false, "name", []]);
      await mainProcess.checkpointAsync(`reconnecting-dialog-usable-${mode}`);
    }
    await MediaFixture.emulateAsync(window, { colorScheme: "light", forcedColors: "none" });
    await name.click();
    await window.keyboard.press("End");
    await window.keyboard.type(", renamed");
    await expect(name).toHaveValue("A name not saved yet, renamed");
    await window.locator("[data-fixture-content=notes-dialog-done]").click();
    await expect(name).toHaveCount(0);
  });

  test("a part that continues after a broken connection to the same runtime keeps its notification and posts it no second time", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const runtime = window.locator("nol-notes-note", { has: window.locator("[data-fixture-content=notes-note-2]") }).locator("[data-fixture-content=notes-runtime]");
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    const first = await runtime.textContent() ?? String.empty;
    const processId = await mainProcess.readRuntimeProcessIdAsync();
    const posted = await notificationIdsAsync(window, "notes.saveFailed");
    await PageBridgeFixture.evaluateAsync(window, t => {
      const states: string[] = [];
      t.onStartup(u => states.push(u.kind));
      globalThis.startups = states;
    });

    await mainProcess.breakRuntimeConnectionAsync();

    await expect.poll(() => window.evaluate(() => globalThis.startups ?? [])).toEqual(["Connecting", "Ready"]);
    await expect(runtime).toHaveAttribute("data-continued", "1");
    expect(await mainProcess.readRuntimeProcessIdAsync()).toBe(processId);
    await expect(runtime).toHaveText(first);
    expect(posted).toHaveLength(1);
    expect(await notificationIdsAsync(window, "notes.saveFailed")).toEqual(posted);
  });

  test("a connection that ends while a part reads the runtime again leaves no window error and the part in place, and the part reads it again once ready", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const runtime = window.locator("nol-notes-note", { has: window.locator("[data-fixture-content=notes-note-2]") }).locator("[data-fixture-content=notes-runtime]");
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    const first = await runtime.textContent() ?? String.empty;
    await PageBridgeFixture.evaluateAsync(window, t => {
      const states: string[] = [];
      t.onStartup(u => states.push(u.kind));
      globalThis.startups = states;
      globalThis.clock = document.querySelector("[data-fixture-content=clock-face]");
    });
    const readyCountAsync = (): Promise<number> => window.evaluate(() => (globalThis.startups ?? []).filter(t => t === "Ready").length);
    await NotesOptionsFixture.holdAsync(window);

    await mainProcess.breakRuntimeConnectionAsync();
    await expect.poll(() => NotesOptionsFixture.heldAsync(window)).toBe(1);
    await mainProcess.breakRuntimeConnectionAsync();
    await expect.poll(readyCountAsync).toBe(2);
    await NotesOptionsFixture.releaseAsync(window);

    await expect.poll(() => window.evaluate(() => [globalThis.clock?.isConnected, document.querySelector("[data-fixture-content=clock-face]") !== null]))
      .toEqual([false, true]);
    await expect(runtime).toHaveAttribute("data-continued", "1");
    await expect(runtime).toHaveText(first);
    await expect(window.locator("nol-workspace")).not.toHaveAttribute("inert");
  });
});

test.describe("reconnecting backoff", () => {
  test.use({ mainProcessVariant: BuildVariantFixture.noModules });

  test("a connection that receives an invalid frame each time it is ready ends, after waits that grow, in the start failure with its cause, and trying again connects", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await PageBridgeFixture.evaluateAsync(window, t => {
      const states: IStartupRecord[] = [];
      t.onStartup(u => states.push({ kind: u.kind, at: performance.now() }));
      globalThis.startupRecords = states;
    });
    const readAsync = (): Promise<IStartupRecord[]> => window.evaluate(() => globalThis.startupRecords ?? []);

    for (let end = 1; end < 6; end++) {
      await mainProcess.receiveInvalidFrameAsync();
      await expect.poll(async () => (await readAsync()).map(t => t.kind)).toEqual(reconnections(end));
    }
    await mainProcess.receiveInvalidFrameAsync();

    const card = window.locator(".nol-startup-card");
    await expect(card.locator(".nol-startup-detail")).toHaveText(/^The connection to the runtime ended 6 times in a row, .* The last time, the main process ended it \(InvalidMessage\): .+/);
    const stopped = await readAsync();
    expect(stopped.map(t => t.kind)).toEqual([...reconnections(5), "Failed"]);
    const waited = (stopped.at(-1)?.at ?? 0) - (stopped[0]?.at ?? 0);
    expect(waited).toBeGreaterThanOrEqual(14_900);
    expect(waited).toBeLessThan(30_000);
    await WindowModeFixture.expectStrongTextAsync(window, card.locator(".nol-startup-title"));
    await card.getByRole("button", { name: "Try again" }).click();
    await expect.poll(async () => (await readAsync()).map(t => t.kind)).toEqual([...reconnections(5), "Failed", "Connecting", "Ready"]);
    await expect(window.locator("nol-workspace")).not.toHaveAttribute("inert");
    const logged = mainProcess.acceptFailures(/The main process ended its connection to the runtime|The runtime could not be started or reached/);
    expect(logged).toHaveLength(6);
    expect(logged.slice(0, 5).every(t => t.includes("so it connects again (InvalidMessage): "))).toBe(true);
    expect(logged[5]).toContain("so the main process stopped connecting again. The last time, the main process ended it (InvalidMessage): ");
  });
});
