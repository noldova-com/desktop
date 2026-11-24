/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";

interface IIdentityGeometry {
  readonly name: string;
  readonly isLoaded: boolean;
  readonly rem: number;
  readonly icon: readonly [number, number];
  readonly iconStart: number;
  readonly rowStart: number;
  readonly centres: readonly number[];
  readonly gaps: readonly [number, number];
  readonly regions: readonly string[];
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
    const icon = image.getBoundingClientRect();
    const words = name.getBoundingClientRect();
    const after = one(".nol-window-row-menu-bar:not(.nol-window-row-menu-bar-folded) .nol-window-row-menu-bar-item, .nol-window-row-menu, .nol-window-row-start > *").getBoundingClientRect();
    const regionAt = (box: DOMRect): string => {
      let element = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      while (element !== null && ["", "none"].includes(getComputedStyle(element).getPropertyValue("app-region")))
        element = element.parentElement;
      return element === null ? "none" : getComputedStyle(element).getPropertyValue("app-region");
    };
    return {
      name: String(name.textContent).trim(),
      isLoaded: image.complete && image.naturalWidth > 0,
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      icon: [icon.width, icon.height],
      iconStart: icon.left,
      rowStart: row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft),
      centres: [icon, words, after].map(t => t.top + t.height / 2),
      gaps: [words.left - icon.right, after.left - words.right],
      regions: [regionAt(icon), regionAt(words)]
    };
  });
}

function expectPlaced(geometry: IIdentityGeometry): void {
  const near = (actual: number, expected: number): void => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);
  expect([geometry.name, geometry.isLoaded, geometry.regions]).toEqual(["Noldova Desktop Sample", true, ["drag", "drag"]]);
  near(geometry.icon[0], geometry.rem);
  near(geometry.icon[1], geometry.rem);
  near(geometry.iconStart, geometry.rowStart);
  near(geometry.gaps[0], geometry.rem * 0.25);
  near(geometry.gaps[1], geometry.rem * 0.5);
  const [icon, ...others] = geometry.centres;
  for (const centre of others)
    near(centre, Number(icon));
}

test.describe("the app's name and icon in the window row", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  });

  test("start the row with the 1rem icon from the app's tree and the name 0.25rem after it, centred on the next control 0.5rem after the name, in the drag region @smoke", async ({ mainProcess }) => {
    expectPlaced(await readAsync(mainProcess.window));
    await mainProcess.checkpointAsync("title-bar-identity");
  });

  test("keep their place, size and alignment at 200% zoom", async ({ mainProcess }) => {
    await mainProcess.zoomAsync(2, 960);

    expectPlaced(await readAsync(mainProcess.window));
    await mainProcess.checkpointAsync("title-bar-identity-zoom");
  });
});
