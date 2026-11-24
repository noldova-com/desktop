/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

interface IIdentityGeometry {
  readonly name: string;
  readonly isNameShown: boolean;
  readonly isNameCut: boolean;
  readonly isLoaded: boolean;
  readonly rem: number;
  readonly icon: readonly [number, number];
  readonly iconStart: number;
  readonly rowStart: number;
  readonly centres: readonly [number, number];
  readonly gap: number;
  readonly regions: readonly string[];
  readonly fieldCentre: number;
  readonly fieldWidth: number;
}

async function layOutAsync(mainProcess: MainProcessFixture, width: number): Promise<void> {
  await test.step(`lay the window out ${width} CSS px wide, since the hosted runners' display size varies`, async () => {
    const natural: number = await mainProcess.window.evaluate(() => innerWidth);
    await mainProcess.zoomAsync(natural / width, width);
  });
}

async function readAsync(window: Page): Promise<IIdentityGeometry> {
  await expect(window.locator("nol-window-row .nol-window-row-identity-icon")).toBeVisible();
  return window.locator("nol-window-row").evaluate(row => {
    const one = <T extends HTMLElement>(selector: string): T => {
      const element = row.querySelector<T>(selector);
      if (element === null)
        throw new Error(`Nothing matches ${selector} in the window row.`);
      return element;
    };
    const image = one<HTMLImageElement>(".nol-window-row-identity-icon");
    const name = one(".nol-window-row-identity-name");
    const identity = one(".nol-window-row-identity");
    const icon = image.getBoundingClientRect();
    const field = one(".nol-window-row-search").getBoundingClientRect();
    const after = one(".nol-window-row-menu-bar:not(.nol-window-row-menu-bar-folded) .nol-window-row-menu-bar-item, .nol-window-row-menu, .nol-window-row-start > *").getBoundingClientRect();
    const regionAt = (box: DOMRect): string => {
      let element = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      while (element !== null && ["", "none"].includes(getComputedStyle(element).getPropertyValue("app-region")))
        element = element.parentElement;
      return element === null ? "none" : getComputedStyle(element).getPropertyValue("app-region");
    };
    return {
      name: String(name.textContent).trim(),
      isNameShown: getComputedStyle(name).display !== "none",
      isNameCut: name.scrollWidth > name.clientWidth,
      isLoaded: image.complete && image.naturalWidth > 0,
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      icon: [icon.width, icon.height],
      iconStart: icon.left,
      rowStart: row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft),
      centres: [icon.top + icon.height / 2, after.top + after.height / 2],
      gap: after.left - name.getBoundingClientRect().right,
      regions: [regionAt(icon), regionAt(identity.getBoundingClientRect())],
      fieldCentre: field.left + field.width / 2 - innerWidth / 2,
      fieldWidth: field.width / parseFloat(getComputedStyle(document.documentElement).fontSize)
    };
  });
}

function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);
}

function expectIconPlaced(geometry: IIdentityGeometry): void {
  expect([geometry.name, geometry.isLoaded, geometry.regions]).toEqual(["Noldova Desktop Sample", true, ["drag", "drag"]]);
  near(geometry.icon[0], geometry.rem);
  near(geometry.icon[1], geometry.rem);
  near(geometry.iconStart, geometry.rowStart);
  near(geometry.centres[0], geometry.centres[1]);
}

test.describe("the app's name and icon in the window row", () => {
  test.use({ mainProcessWindowPlacement: true });

  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  });

  test("start a 1920 px row with the 1rem icon from the app's tree and the whole name, 0.5rem before the next control, in the drag region, with the search field centred @smoke", async ({ mainProcess }) => {
    await layOutAsync(mainProcess, 1920);
    const geometry = await readAsync(mainProcess.window);

    expectIconPlaced(geometry);
    expect([geometry.isNameShown, geometry.isNameCut]).toEqual([true, false]);
    near(geometry.gap, geometry.rem * 0.5);
    expect(Math.abs(geometry.fieldCentre)).toBeLessThan(1);
    expect(geometry.fieldWidth).toBeCloseTo(27.5, 1);
    await mainProcess.checkpointAsync("title-bar-identity");
  });

  test("keep the icon in a 1280 px row and cut or hide the name, so the full search field stays centred", async ({ mainProcess }) => {
    await layOutAsync(mainProcess, 1280);
    const geometry = await readAsync(mainProcess.window);

    expectIconPlaced(geometry);
    const isWhole = geometry.isNameShown && !geometry.isNameCut;
    expect(isWhole && process.platform !== "darwin", "Beside the menus, a whole name leaves the 1280 px row no room to centre the field.").toBe(false);
    expect(Math.abs(geometry.fieldCentre)).toBeLessThan(1);
    expect(geometry.fieldWidth).toBeCloseTo(27.5, 1);
    await mainProcess.checkpointAsync("title-bar-identity-1280");
  });

  test("keep the icon at 1rem in its place at 200% zoom, while the search field keeps at least 12rem", async ({ mainProcess }) => {
    const natural: number = await mainProcess.window.evaluate(() => innerWidth);
    await mainProcess.zoomAsync(2, natural / 2);
    const geometry = await readAsync(mainProcess.window);

    expectIconPlaced(geometry);
    expect(geometry.fieldWidth).toBeGreaterThanOrEqual(12);
    await mainProcess.checkpointAsync("title-bar-identity-zoom");
  });
});
