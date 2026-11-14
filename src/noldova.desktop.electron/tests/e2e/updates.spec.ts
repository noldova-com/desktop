/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { ProductInfo } from "@noldova/desktop.runtime";

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { CleanupSteps } from "./fixtures/cleanup-steps.ts";
import { ClockWorkFixture } from "./fixtures/clock-work.fixture.ts";
import { HelpMenuFixture } from "./fixtures/help-menu.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { PageBridgeFixture, type IUpdateState } from "./fixtures/page-bridge.fixture.ts";
import { ReadyUpdateFixture } from "./fixtures/ready-update.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { UpdateFeedFixture } from "./fixtures/update-feed.fixture.ts";

interface IReadyUpdate {
  readonly feed: UpdateFeedFixture;
  readonly launchAsync: () => Promise<MainProcessFixture>;
}

const VERSION = "999.0.0";
const SENT_HEADERS: readonly string[] = ["user-agent", "accept", "range", "cache-control", "host", "connection", "accept-encoding"];
const NOT_AN_APP_IMAGE = "This copy of Noldova Desktop Sample doesn't run from an AppImage, so it can't install the update.";

const withReadyUpdateAsync = async (
  testInfo: TestInfo, run: (update: IReadyUpdate) => Promise<void>, options: { readonly isReady?: boolean; readonly isAppImage?: boolean } = {}): Promise<void> => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-updates-"));
  const device = path.join(folder, "device");
  const cache = path.join(folder, "cache");
  const contents = Buffer.from(`Noldova Desktop Sample ${VERSION}`);
  const mainProcesses: MainProcessFixture[] = [];
  const appImage: Readonly<Record<string, string>> = options.isAppImage === true && process.platform === "linux" ? { APPIMAGE: path.join(folder, "app.AppImage") } : {};
  let feed: UpdateFeedFixture | null = null;
  let failure: { readonly error: unknown } | null = null;
  try {
    await BuildVariantFixture.swapInAsync(UpdateFeedFixture.VARIANT);
    const started = await UpdateFeedFixture.startAsync(path.join(folder, "feed"));
    feed = started;
    await started.publishAsync(VERSION, contents);
    if (options.isReady ?? true)
      await ReadyUpdateFixture.seedAsync(device, cache, VERSION, contents);
    await run({
      feed: started,
      launchAsync: async () => {
        const mainProcess = await MainProcessFixture.launchAsync(testInfo, { ...ReadyUpdateFixture.environment(cache), ...appImage }, {}, [], false, device);
        mainProcesses.push(mainProcess);
        return mainProcess;
      }
    });
  }
  catch (error) {
    failure = { error };
  }
  const cleanup = await CleanupSteps.collectFailuresAsync([
    ...mainProcesses.map(t => () => t.disposeAsync()),
    async () => {
      await feed?.disposeAsync();
    },
    () => BuildVariantFixture.restoreAsync(),
    () => rm(folder, { recursive: true, force: true, maxRetries: 10 })
  ]);
  await CleanupSteps.attachAsync(testInfo, cleanup);
  if (!Object.isNull(failure))
    throw failure.error;
  CleanupSteps.throwFailures(cleanup);
  for (const mainProcess of mainProcesses)
    expect(mainProcess.failures).toEqual([]);
};

const readUpdateAsync = (page: Page): Promise<IUpdateState> => PageBridgeFixture.evaluateAsync(page, t => t.readUpdate());

const expectNewRuntimeAsync = async (mainProcess: MainProcessFixture, previous: number | undefined): Promise<void> => {
  await expect.poll(async () => {
    const current = await mainProcess.readRuntimeProcessIdAsync();
    return !Object.isUndefined(current) && current !== previous && MainProcessFixture.isAlive(current);
  }, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await PageBridgeFixture.evaluateAsync(mainProcess.window, t => t.readStartup()))?.kind, { timeout: 30_000 }).toBe("Ready");
};

const acceptHandoffFailureAsync = async (mainProcess: MainProcessFixture, reason: string): Promise<void> => {
  const logged = /^main: \S+ The update('s publisher check failed in \d+ ms\.$| failed: )/;
  const expected = process.platform === "win32"
    ? [/^main: \S+ The update's publisher check failed in \d+ ms\.$/, /^main: \S+ The update failed: The update's installer .+ is not signed by the publisher, so it was not started: /]
    : [/^main: \S+ The update failed: /];
  await expect.poll(() => mainProcess.failures.filter(t => logged.test(t)).length, { timeout: 10_000 }).toBe(expected.length);
  const accepted = mainProcess.acceptFailures(logged);
  expected.forEach((pattern, index) => expect(accepted[index]).toMatch(pattern));
  const tail = process.platform === "win32" ? reason.slice(reason.indexOf(": its signature is not valid ")) : reason;
  expect(accepted.at(-1)?.endsWith(tail), `${accepted.at(-1)} ends with ${tail}`).toBe(true);
};

const expectHelpWithUpdatesAsync = async (page: Page): Promise<void> => {
  const help = await HelpMenuFixture.openInWindowAsync(page);
  await HelpMenuFixture.expectRowsAsync(help, [/Check for updates$/, String.empty, /Open log folder$/, /Copy details$/]);
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
};

const openAboutAsync = async (page: Page): Promise<Locator> => {
  await SettingsFixture.openPageAsync(page, "About");
  return page.getByRole("region", { name: "About Noldova Desktop Sample" });
};

test("an update made ready before Noldova Desktop Sample started offers Restart to update at once, without asking the feed again, on a Mac copy outside Applications only asks the person to move it, or on a Linux copy that is no AppImage fails with the reason, offers no restart, stops nothing and downloads nothing, and offers Check for updates in Help on Windows and Linux or in the application menu on macOS", async ({}, testInfo) => {
  await withReadyUpdateAsync(testInfo, async ({ feed, launchAsync }) => {
    const mainProcess = await launchAsync();
    const page = mainProcess.window;

    if (process.platform === "linux") {
      const runtime = await mainProcess.readRuntimeProcessIdAsync();
      await expect(page.locator(".nol-update-item")).toHaveText(/Update failed$/);
      expect(await readUpdateAsync(page)).toEqual(expect.objectContaining({ kind: "Failed", reason: NOT_AN_APP_IMAGE }));
      await expectHelpWithUpdatesAsync(page);
      const about = await openAboutAsync(page);
      await expect(about.getByRole("status")).toContainText("The update failed.");
      await expect(about.locator(".nol-about-detail")).toHaveText(NOT_AN_APP_IMAGE);
      await expect(about.getByRole("button", { name: "Restart to update" })).toHaveCount(0);
      expect(await PageBridgeFixture.evaluateAsync(page, t => t.actOnUpdate("Restart"))).toBe(false);
      expect(feed.requests).not.toContain(UpdateFeedFixture.source.packageFile);
      expect(await mainProcess.readRuntimeProcessIdAsync()).toBe(runtime);
      expect(MainProcessFixture.isAlive(runtime ?? 0)).toBe(true);
      expect(await mainProcess.isVisibleAsync()).toBe(true);
    }
    else if (process.platform === "darwin") {
      const runtime = await mainProcess.readRuntimeProcessIdAsync();
      await expect(page.locator(".nol-update-item")).toHaveText(/Move to Applications to update$/);
      expect(await readUpdateAsync(page)).toEqual(expect.objectContaining({ kind: "Available", version: VERSION, reason: null }));
      await expect.poll(() => HelpMenuFixture.readNativeApplicationAsync(mainProcess.application)).toContain("Check for updates");
      expect(await HelpMenuFixture.readNativeHelpAsync(mainProcess.application)).toEqual(["Open log folder", "Copy details"]);
      const about = await openAboutAsync(page);
      await expect(about.getByRole("status")).toHaveText(/ to Applications to get updates\.$/);
      await expect(about.getByRole("button", { name: "Restart to update" })).toHaveCount(0);
      expect(await PageBridgeFixture.evaluateAsync(page, t => t.actOnUpdate("Restart"))).toBe(false);
      expect(feed.requests).toEqual([]);
      expect(await mainProcess.readRuntimeProcessIdAsync()).toBe(runtime);
      expect(await mainProcess.isVisibleAsync()).toBe(true);
    }
    else {
      await expect(page.locator(".nol-update-item")).toHaveText(/Restart to update$/);
      expect(feed.requests).toEqual([]);
      expect(await readUpdateAsync(page)).toEqual(expect.objectContaining({ kind: "Ready", version: VERSION, reason: null }));
      await expectHelpWithUpdatesAsync(page);
    }
  });
});

test("each request for the update information names the product, its version, platform and architecture, marks only the day's first request daily, and sends no cookie the feed set, language or referrer", async ({}, testInfo) => {
  await withReadyUpdateAsync(testInfo, async ({ feed, launchAsync }) => {
    await feed.publishAsync("0.0.1", Buffer.from("Noldova Desktop Sample 0.0.1"));
    const mainProcess = await launchAsync();
    const page = mainProcess.window;
    const product = ProductInfo.read(ProductInfo.file);
    const userAgent = `${product.slug}/${product.version} (${process.platform}; ${process.arch}`;
    const checkAsync = async (count: number): Promise<void> => {
      expect(await PageBridgeFixture.evaluateAsync(page, t => t.actOnUpdate("Check"))).toBe(true);
      await expect.poll(() => feed.requests.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(count);
      await expect.poll(async () => (await readUpdateAsync(page)).kind, { timeout: 60_000 }).toBe("UpToDate");
    };

    await checkAsync(1);
    await checkAsync(2);

    expect(feed.requests).toEqual(feed.requests.map(() => UpdateFeedFixture.source.channelFile));
    expect(feed.headers.map(t => t["user-agent"])).toEqual(feed.headers.map((_, index) => `${userAgent}${index === 0 ? "; daily" : String.empty})`));
    expect(feed.headers.map(t => ["cookie", "accept-language", "referer"].filter(u => u in t))).toEqual(feed.headers.map(() => []));
    expect(feed.headers.map(t => Object.keys(t).filter(u => !SENT_HEADERS.includes(u)))).toEqual(feed.headers.map(() => []));
  }, { isReady: false, isAppImage: true });
});

test("Restart to update asks first while work runs, changes nothing when the person cancels, and stops the work when they choose to", async ({}, testInfo) => {
  test.skip(process.platform === "linux", "The development app on Linux fails before it offers the restart; the first workflow covers it.");
  test.skip(process.platform === "darwin", "The development app on macOS runs outside Applications, where a ready update only shows as available; the first workflow covers it.");
  test.setTimeout(180_000);
  await withReadyUpdateAsync(testInfo, async ({ launchAsync }) => {
    const mainProcess = await launchAsync();
    const window = mainProcess.window;
    const runtime = await mainProcess.readRuntimeProcessIdAsync();
    await ClockWorkFixture.beginAsync(mainProcess);
    const about = await openAboutAsync(window);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await about.getByRole("button", { name: "Restart to update" }).click();
    await expect(asking).toBeVisible();
    await expect(asking.getByRole("listitem")).toHaveText([new RegExp(`^${ClockWorkFixture.WORK} \\(.+\\)$`)]);
    await expect(asking.locator(".nol-dialog-actions").getByRole("button")).toHaveText(["Wait, then update", "Stop the work and update", "Cancel"]);
    await expect(asking.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await asking.getByRole("button", { name: "Cancel" }).click();
    await expect(asking).toHaveCount(0);
    expect(await readUpdateAsync(window)).toEqual(expect.objectContaining({ kind: "Ready", version: VERSION, reason: null }));
    expect(await mainProcess.readRuntimeProcessIdAsync()).toBe(runtime);
    expect(await ClockWorkFixture.readAsync(mainProcess.dataDirectory)).toEqual(expect.arrayContaining([ClockWorkFixture.WORK]));

    await about.getByRole("button", { name: "Restart to update" }).click();
    await asking.getByRole("button", { name: "Stop the work and update" }).click();

    await expect.poll(async () => (await readUpdateAsync(window)).reason, { timeout: 90_000 }).not.toBeNull();
    expect(MainProcessFixture.isAlive(runtime ?? 0)).toBe(false);
    await expectNewRuntimeAsync(mainProcess, runtime);
    expect(await mainProcess.isVisibleAsync()).toBe(true);
    await acceptHandoffFailureAsync(mainProcess, (await readUpdateAsync(window)).reason ?? String.empty);
  });
});

test("Restart to update stops Noldova Desktop Sample in every data directory of the installation, and when the handoff fails, Noldova Desktop Sample runs on with the update ready and the reason", async ({}, testInfo) => {
  test.skip(process.platform === "linux", "The development app on Linux fails before it offers the restart; the first workflow covers it.");
  test.skip(process.platform === "darwin", "The development app on macOS runs outside Applications, where a ready update only shows as available; the first workflow covers it.");
  test.setTimeout(180_000);
  await withReadyUpdateAsync(testInfo, async ({ launchAsync }) => {
    const other = await launchAsync();
    const otherRuntime = await other.readRuntimeProcessIdAsync();
    const otherMainProcess = other.application.process().pid ?? 0;
    const mainProcess = await launchAsync();
    const runtime = await mainProcess.readRuntimeProcessIdAsync();
    const about = await openAboutAsync(mainProcess.window);

    await about.getByRole("button", { name: "Restart to update" }).click();

    await expect.poll(() => MainProcessFixture.isAlive(otherMainProcess), { timeout: 60_000 }).toBe(false);
    await expect.poll(() => MainProcessFixture.isAlive(otherRuntime ?? 0), { timeout: 30_000 }).toBe(false);
    await expect.poll(async () => (await readUpdateAsync(mainProcess.window)).reason, { timeout: 90_000 }).not.toBeNull();
    const update = await readUpdateAsync(mainProcess.window);
    expect(update).toEqual(expect.objectContaining({ kind: "Ready", version: VERSION }));
    if (process.platform === "win32")
      expect(update.reason).toMatch(/^The update's installer /);
    await expect(about.locator(".nol-about-detail")).toHaveText(update.reason ?? String.empty);
    expect(MainProcessFixture.isAlive(runtime ?? 0)).toBe(false);
    for (const launched of [other, mainProcess])
      expect((await readdir(path.join(launched.dataDirectory, "backups"))).filter(t => /^desktop-before-update-\d{8}T\d{6}Z\.sqlite$/.test(t))).toHaveLength(1);
    await expectNewRuntimeAsync(mainProcess, runtime);
    await expect(about.getByRole("button", { name: "Restart to update" })).toBeVisible();
    expect(await mainProcess.isVisibleAsync()).toBe(true);
    await acceptHandoffFailureAsync(mainProcess, update.reason ?? String.empty);
  });
});
