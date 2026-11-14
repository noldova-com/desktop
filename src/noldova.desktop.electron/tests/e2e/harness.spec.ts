/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { DataDirectory, DiscoveryReader, Endpoint, RuntimeServer } from "@noldova/desktop.runtime";

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { CleanupSteps } from "./fixtures/cleanup-steps.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { LayoutFixture } from "./fixtures/layout.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { TestRoots } from "./fixtures/test-roots.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

test.use({ mainProcessVariant: BuildVariantFixture.noModules });

test.describe("the harness's viewport and cursor guard", () => {
  const readViewport = (mainProcess: MainProcessFixture): Promise<readonly number[]> => mainProcess.readViewportAsync();
  const isCursorInside = (mainProcess: MainProcessFixture): Promise<boolean> => mainProcess.application.evaluate(({ BrowserWindow, screen }) => {
    const cursor = screen.getCursorScreenPoint();
    const bounds = BrowserWindow.getAllWindows()[0]?.getBounds();
    return bounds !== undefined && cursor.x >= bounds.x && cursor.y >= bounds.y && cursor.x < bounds.x + bounds.width && cursor.y < bounds.y + bounds.height;
  });
  const isHovered = (mainProcess: MainProcessFixture): Promise<boolean> => mainProcess.window.evaluate(() => document.querySelector(":hover") !== null);
  const emulateAsync =async (mainProcess: MainProcessFixture, width: number, height: number): Promise<void> => {
    const session = await mainProcess.window.context().newCDPSession(mainProcess.window);
    await session.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await expect.poll(() => readViewport(mainProcess)).toEqual([width, height, 1]);
  };

  test("every workflow starts at the suite's viewport with the real cursor outside the window, and again after a restart", async ({ mainProcess }) => {
    const first = [await readViewport(mainProcess), await isCursorInside(mainProcess)];

    await mainProcess.restartAsync();

    expect(first).toEqual([[1920, 1080, 1], false]);
    expect([await readViewport(mainProcess), await isCursorInside(mainProcess)]).toEqual([[1920, 1080, 1], false]);
    expect(await isHovered(mainProcess)).toBe(false);
    await mainProcess.checkpointAsync("harness-suite-viewport");
  });

  test("a pixel ratio off by a rounding error, as a display scaled above 100% reports one, reads as the ratio it is, while one really different stays different", () => {
    const ratios = [1.0000000149011612, 2.0000000298023224, 1.2500000186264515, 1.25, 1.000002];

    expect(ratios.map(t => MainProcessFixture.roundPixelRatio(t))).toEqual([1, 2, 1.25, 1.25, 1.000002]);
  });

  test("the cursor guard names input from outside the test when the system's last input came after the cursor was outside, and a moved window or display otherwise", () => {
    const found = "The real cursor came back inside the window, so its position could reach the test's pointer events.";

    expect([
      MainProcessFixture.describeCursorReturn(3, 16_400),
      MainProcessFixture.describeCursorReturn(20, 16_400),
      MainProcessFixture.describeCursorReturn(null, 16_400)
    ]).toEqual([
      `${found} The system last received input 3 s ago, within the 16 s since the cursor was last outside, and the tests send it none, so the input came from outside the test.`,
      `${found} The system last received input 20 s ago, before the cursor was last outside 16 s ago, so the window or a display moved under the still cursor.`,
      `${found} The system's idle time could not be read, so where the input came from is unknown.`
    ]);
  });

  test("a workflow starts with nothing hovered even when the pointer left the window without moving", async ({ mainProcess }) => {
    await mainProcess.window.mouse.move(100, 100);
    await expect.poll(() => isHovered(mainProcess)).toBe(true);

    await mainProcess.useViewportAsync(1920, 1080);

    expect(await isHovered(mainProcess)).toBe(false);
  });

  test("a workflow that ends off its viewport fails, while one that chose another size keeps it", async ({ mainProcess }) => {
    await mainProcess.useViewportAsync(900, 700);
    await emulateAsync(mainProcess, 800, 600);

    await mainProcess.disposeAsync(false);

    expect(mainProcess.acceptFailures(/viewport/)).toEqual(["The workflow ended at a 800 × 600 viewport instead of 900 × 700, so its viewport was lost."]);
  });

  test.describe("a workflow that tests window placement", () => {
    test.use({ mainProcessWindowPlacement: true });

    test("keeps the window's own size and position and is not checked for either", async ({ mainProcess }) => {
      const bounds = await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getContentBounds());
      const viewport = await readViewport(mainProcess);

      await emulateAsync(mainProcess, 800, 600);
      await mainProcess.disposeAsync(false);

      expect(viewport.slice(0, 2)).toEqual([bounds?.width, bounds?.height]);
      expect(mainProcess.failures).toEqual([]);
    });
  });
});

test.describe("the harness's fonts", () => {
  test("every workflow starts with each face the window declares loaded, and again after a restart, so text measures in its fonts", async ({ mainProcess }) => {
    const readFaces = (): Promise<readonly [number, readonly string[]]> => mainProcess.window.evaluate(() =>
      [document.fonts.size, [...document.fonts].filter(t => t.status !== "loaded").map(t => `${t.family} ${t.weight} ${t.style}`)] as const);
    const first = await readFaces();

    await mainProcess.restartAsync();
    const restarted = await readFaces();

    expect([first[0] > 0, first[1]]).toEqual([true, []]);
    expect([restarted[0] > 0, restarted[1]]).toEqual([true, []]);
    await mainProcess.checkpointAsync("harness-fonts");
  });
});

test.describe("the harness's trace", () => {
  test("a workflow that crashes a web view turns tracing off, so Playwright has nothing in flight on the view when it crashes, and tracing stays off after a restart", async ({ mainProcess }, testInfo) => {
    const chunk = testInfo.outputPath("trace-chunk.zip");
    await mainProcess.application.context().tracing.stopChunk({ path: chunk });
    await mainProcess.application.context().tracing.startChunk();

    await mainProcess.stopTracingAsync();
    await expect(mainProcess.application.context().tracing.stopChunk({ path: chunk })).rejects.toThrow(/Must start tracing/);
    await mainProcess.restartAsync();
    await expect(mainProcess.application.context().tracing.stopChunk({ path: chunk })).rejects.toThrow(/Must start tracing/);
  });
});

test.describe("the workflows' checkpoints", () => {
  test("every workflow file that opens Noldova Desktop Sample takes a named checkpoint, and each name is taken in one place only", async ({}, testInfo) => {
    const folder = path.dirname(testInfo.file);
    const files = (await readdir(folder)).filter(t => t.endsWith(".spec.ts")).sort();
    const texts = await Promise.all(files.map(async t => [t, await readFile(path.join(folder, t), "utf8")] as const));
    const workflows = texts.filter(([, text]) => /\{\s*main process\s*\}/.test(text));
    const names = workflows.flatMap(([, text]) => [...text.matchAll(/checkpointAsync\("([^"]+)"\)/g)].map(t => t[1]));

    expect(workflows.filter(([, text]) => !/checkpointAsync\(|captureMainWindowAsync\(/.test(text)).map(([file]) => file)).toEqual([]);
    expect(names.filter((t, index) => names.indexOf(t) !== index)).toEqual([]);
  });

  test("a checkpoint records the appearance settings in effect, the mode the page shows, the zoom, the CSS viewport and the pixel ratio, and one at 200% zoom shows the whole window in 1920 × 1080 pixels", async ({ mainProcess }, testInfo) => {
    const window = mainProcess.window;
    const settings = { theme: "desktop.default", mode: "Dark", interfaceFont: "Noldova", codeFont: "Noldova", panelSize: 17, messageSize: 13, codeSize: 12 };
    await WindowModeFixture.setAsync(window, "Dark");
    await PageBridgeFixture.evaluateAsync(window, t => t.request("desktop.setSetting", { name: "desktop.panelSize", value: 17 }));
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).fontSize)).not.toBe("16px");

    await mainProcess.checkpointAsync("harness-checkpoint-record");
    await mainProcess.zoomAsync(2, 960);
    await window.evaluate(() => {
      for (const [x, y, color] of [["left", "top", "rgb(255, 0, 0)"], ["right", "top", "rgb(0, 255, 0)"], ["left", "bottom", "rgb(0, 0, 255)"], ["right", "bottom", "rgb(255, 0, 255)"]] as const) {
        const marker = document.createElement("div");
        marker.className = "harness-corner";
        marker.style.cssText = `position: fixed; ${x}: 0; ${y}: 0; width: 8px; height: 8px; z-index: 10000; background: ${color}`;
        document.body.append(marker);
      }
    });
    const zoomed = await mainProcess.checkpointAsync("harness-checkpoint-zoomed");
    const corners = await window.evaluate(async data => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0);
      document.querySelectorAll(".harness-corner").forEach(t => t.remove());
      return [[4, 4], [canvas.width - 5, 4], [4, canvas.height - 5], [canvas.width - 5, canvas.height - 5], [20, 20]]
        .map(([x, y]) => [...(context?.getImageData(x ?? 0, y ?? 0, 1, 1).data.slice(0, 3) ?? [])]);
    }, zoomed.toString("base64"));
    await mainProcess.zoomAsync(1, 1920);

    expect(testInfo.annotations.filter(t => t.type === "checkpoint").map(t => JsonReader.parse(t.description ?? String.empty).toJson())).toEqual([
      { name: "harness-checkpoint-record", settings, colorScheme: "dark", zoom: 1, viewport: { width: 1920, height: 1080 }, pixelRatio: 1 },
      { name: "harness-checkpoint-zoomed", settings, colorScheme: "dark", zoom: 2, viewport: { width: 960, height: 540 }, pixelRatio: 2 }
    ]);
    expect([zoomed.readUInt32BE(16), zoomed.readUInt32BE(20)]).toEqual([1920, 1080]);
    expect(corners.slice(0, 4)).toEqual([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 255]]);
    expect(corners[4]).not.toEqual([255, 0, 0]);
  });

  test.describe("on a display scaled to 125%", () => {
    test.use({ mainProcessArguments: ["--force-device-scale-factor=1.25"] });

    test("the suite's viewport keeps one device pixel per CSS pixel through checkpoints, a clipped screenshot and zoom, and each checkpoint records the ratio it is", async ({ mainProcess }, testInfo) => {
      const readRatio = async (): Promise<number> => (await mainProcess.readViewportAsync())[2] ?? Number.NaN;
      const ratios = [await readRatio()];

      await mainProcess.checkpointAsync("harness-scaled");
      ratios.push(await readRatio());
      const clipped = await mainProcess.window.screenshot({ clip: { x: 0, y: 0, width: 100, height: 50 } });
      ratios.push(await readRatio());
      await mainProcess.zoomAsync(2, 960);
      const zoomed = await mainProcess.checkpointAsync("harness-scaled-zoomed");
      await mainProcess.zoomAsync(1, 1920);

      expect([ratios, await mainProcess.readViewportAsync()]).toEqual([[1, 1, 1], [1920, 1080, 1]]);
      expect([clipped.readUInt32BE(16), clipped.readUInt32BE(20), zoomed.readUInt32BE(16), zoomed.readUInt32BE(20)]).toEqual([100, 50, 1920, 1080]);
      expect(testInfo.annotations.filter(t => t.type === "checkpoint").map(t => JsonReader.parse(t.description ?? String.empty).readNumber("pixelRatio"))).toEqual([1, 2]);
    });
  });
});

test.describe("the layout checks", () => {
  test("report a control cut off, outside the window, covered or under 24 × 24 px beside another, a region that scrolls sideways or shows no control, readable text cut off without an ellipsis or at the bottom, and the focus out of view, but not a control scrolled out of its scroll area or a small one spaced as large", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await window.evaluate(() => {
      const region = document.createElement("div");
      region.id = "layout-check";
      region.style.cssText = "position: fixed; left: 0; top: 0; width: 400px; height: 120px; z-index: 10000; background: white";
      region.innerHTML = [
        "<button style=\"position: absolute; left: 100px; top: 40px; width: 60px; height: 30px\">Covered</button>",
        "<div style=\"position: absolute; left: 90px; top: 30px; width: 80px; height: 50px\"></div>",
        "<button style=\"position: absolute; left: -40px; top: 40px; width: 30px; height: 30px\">Outside</button>",
        "<div style=\"position: absolute; left: 0; top: 0; width: 60px; height: 30px; overflow: hidden\"><button style=\"position: absolute; left: 70px; top: 0\">Cut</button></div>",
        "<div style=\"position: absolute; left: 200px; top: 0; width: 50px; height: 30px; overflow-x: auto\"><div style=\"width: 200px\">Wide</div></div>",
        "<div style=\"position: absolute; left: 300px; top: 0; width: 60px; height: 20px; overflow-y: auto\"><div style=\"height: 40px\"></div><button style=\"width: 50px\">Away</button></div>",
        "<button aria-label=\"Small\" style=\"position: absolute; left: 300px; top: 60px; width: 16px; height: 16px; padding: 0\"></button>",
        "<button aria-label=\"Near\" style=\"position: absolute; left: 316px; top: 60px; width: 30px; height: 30px; padding: 0\"></button>",
        "<button aria-label=\"Spaced\" style=\"position: absolute; left: 370px; top: 96px; width: 16px; height: 16px; padding: 0\"></button>"
      ].join("");
      const empty = document.createElement("div");
      empty.id = "layout-empty";
      empty.style.cssText = "position: fixed; left: 0; top: 200px; width: 100px; height: 20px";
      document.body.append(region, empty);
    });

    expect(await LayoutFixture.findProblemsAsync(window.locator("#layout-check, #layout-empty"))).toEqual([
      "div \"Wide\" scrolls sideways.",
      "button \"Covered\" is covered by div \"\".",
      "button \"Outside\" is outside the window.",
      "button \"Cut\" is cut off by div \"Cut\".",
      "button \"Small\" is 16 × 16 px, under 24 × 24, and too close to button \"Near\".",
      "div \"\" shows no control."
    ]);
    await window.evaluate(() => {
      const region = document.createElement("div");
      region.id = "text-check";
      region.style.cssText = "position: fixed; left: 0; top: 300px; width: 400px; font-size: 16px; line-height: 20px";
      region.innerHTML = [
        "<div style=\"width: 40px; overflow: hidden; white-space: nowrap\">Cut without an ellipsis</div>",
        "<div style=\"width: 40px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis\">Cut with an ellipsis</div>",
        "<div style=\"height: 10px; overflow: hidden\">Short</div>",
        "<div aria-hidden=\"true\" style=\"height: 10px; overflow: hidden\">Hidden from reading</div>",
        "<div style=\"width: 40px; overflow-x: auto; white-space: nowrap\">Scrolls instead of cutting</div>"
      ].join("");
      document.body.append(region);
    });
    expect(await LayoutFixture.findCutTextAsync(window.locator("#text-check"))).toEqual([
      "div \"Cut without an ellipsis\" cuts its text off at the side without an ellipsis.",
      "div \"Short\" cuts its text off at the bottom."
    ]);
    await window.getByRole("button", { name: "Covered" }).focus();
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", 1)).toEqual(["Tab 1: button \"Outside\" has the focus out of view."]);
  });
});

test.describe("the harness's instances", () => {
  test("two instances with their own data directories run side by side, each with its own window, main process and runtime", async ({}, testInfo) => {
    const started = await Promise.allSettled([MainProcessFixture.launchAsync(testInfo), MainProcessFixture.launchAsync(testInfo)]);
    const instances = started.filter(t => t.status === "fulfilled").map(t => t.value);
    const mainProcesses = await Promise.all(instances.map(t => t.application.evaluate(() => process.pid)));
    const runtimes = await Promise.all(instances.map(t => t.readRuntimeProcessIdAsync()));
    const visible = await Promise.all(instances.map(t => t.window.evaluate(() => document.visibilityState)));
    CleanupSteps.throwFailures(await CleanupSteps.collectFailuresAsync(instances.map(t => () => t.disposeAsync(false))));

    expect(started.map(t => t.status === "rejected" ? String(t.reason) : t.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(new Set(mainProcesses).size).toBe(2);
    expect(runtimes.every(t => !Object.isUndefined(t))).toBe(true);
    expect(new Set(runtimes).size).toBe(2);
    expect(visible).toEqual(["visible", "visible"]);
    expect(instances.flatMap(t => t.failures)).toEqual([]);
  });
});

test.describe("the harness's socket paths", () => {
  const widestWorkers = 100;
  const margin = 16;
  const longestFolders = [["darwin", `/var/folders/zz/${"x".repeat(30)}/T`], ["linux", `/${"x".repeat(50)}`]] as const;

  test("from the longest temporary folders it runs in, a test's runtime socket path, and that of a test in its child run, stays 16 bytes under the 103 the runtime accepts", () => {
    const longest = longestFolders.flatMap(([platform, given]) => {
      const run = TestRoots.runFolderIn(TestRoots.baseFor(given, platform));
      const child = TestRoots.runFolderIn(TestRoots.baseFor(run, platform));
      return [run, child].map(t => TestRoots.longestSocketPath(t, widestWorkers));
    });

    expect(longest.filter(t => Buffer.byteLength(t) > RuntimeServer.maximumSocketPathLength - margin)).toEqual([]);
  });

  test("the run's set-up stops before its tests when a test's runtime socket path would be over the limit, naming the path and its length, and checks nothing on Windows, where the runtime listens on TCP", () => {
    const given = path.join(`/${"x".repeat(60)}`, "ui-run-abcdef");
    const longest = TestRoots.longestSocketPath(TestRoots.runFolderIn(given), 1);

    expect(() => TestRoots.checkSocketPath(1, given, "linux")).toThrow(
      `A test of this run would start the runtime with the socket path ${longest}, which is ${Buffer.byteLength(longest)} bytes, over the 103 the runtime accepts, so the run stops before its tests; `);
    expect(() => TestRoots.checkSocketPath(1, given, "win32")).not.toThrow();
    expect(() => TestRoots.checkSocketPath(widestWorkers, longestFolders[0][1], "darwin")).not.toThrow();
  });

  test("a test's runtime listens on a socket path in its run's folder no longer than the longest the run's set-up checked", async ({ mainProcess }, testInfo) => {
    test.skip(process.platform === "win32", "The runtime listens on TCP on Windows.");
    const discovery = await DiscoveryReader.readAsync(new DataDirectory(mainProcess.dataDirectory));
    const socket = Object.isNull(discovery) ? null : Endpoint.parse(discovery.endpoint).path;
    const longest = TestRoots.longestSocketPath(os.tmpdir(), testInfo.config.workers);

    expect(path.dirname(mainProcess.root)).toBe(os.tmpdir());
    expect(socket).toBe(path.join(new DataDirectory(mainProcess.dataDirectory).discoveryFolder, "runtime.sock"));
    expect(Buffer.byteLength(socket ?? String.empty)).toBeLessThanOrEqual(Buffer.byteLength(longest));
  });
});

test.describe("the harness's main process log", () => {
  test("a runtime that ends its connection fails a workflow until the workflow accepts its ends, which accepts no other line", async ({ mainProcess }) => {
    const other = "main: 2026-11-05T00:00:00.000Z Another line.";
    await PageBridgeFixture.evaluateAsync(mainProcess.window, t => {
      const states: string[] = [];
      t.onStartup(u => states.push(u.kind));
      globalThis.startups = states;
    });
    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);
    await expect.poll(() => mainProcess.window.evaluate(() => globalThis.startups)).toEqual(["Connecting", "Ready"]);
    expect(mainProcess.failures.filter(t => t.includes("The runtime ended its connection to the main process"))).toHaveLength(1);
    mainProcess.failures.push(other);
    mainProcess.acceptRuntimeEnds();

    await mainProcess.disposeAsync(false);

    expect(mainProcess.acceptFailures(/./)).toEqual([other]);
  });
});
