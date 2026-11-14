/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { ScrollAreaFixture } from "./fixtures/scroll-area.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";

function scope(window: Page, mode: "Light" | "Dark"): Locator {
  return window.locator(`nol-gallery .nol-gallery-scope-frame[data-mode="${mode}"]`);
}

async function layoutProblemsAsync(window: Page): Promise<readonly string[]> {
  return window.locator("nol-gallery").evaluate(gallery => {
    const problems: string[] = [];
    const tolerance = 1;
    const overlaps = (a: DOMRect, b: DOMRect): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance;
    for (const specimen of gallery.querySelectorAll<HTMLElement>(".nol-gallery-specimen")) {
      const name = specimen.getAttribute("aria-label") ?? "";
      const head = specimen.querySelector<HTMLElement>(".nol-gallery-specimen-name");
      if (head?.textContent !== name)
        problems.push(`${name}: no header with its name`);
      const cells = [...specimen.querySelectorAll<HTMLElement>(".nol-gallery-specimen-cells > nol-gallery-cell")];
      if (cells.length === 0)
        problems.push(`${name}: no cells`);
      const boxes = cells.map(t => t.getBoundingClientRect());
      boxes.forEach((box, i) => {
        const caption = cells[i]?.getAttribute("aria-label");
        const first = boxes[0] ?? box;
        const previous = boxes[i - 1];
        if (Math.abs(box.width - first.width) > tolerance)
          problems.push(`${name}: ${caption} is ${box.width}px wide, not ${first.width}px`);
        if (previous !== undefined && box.left > previous.left + tolerance && Math.abs(box.top - previous.top) > tolerance)
          problems.push(`${name}: ${caption} does not share its row's top edge`);
      });
      const parts = [...(head === null ? [] : [head]), ...cells, ...specimen.querySelectorAll<HTMLElement>(".nol-gallery-specimen-long > nol-gallery-cell")];
      parts.forEach((part, i) => parts.slice(i + 1).filter(other => overlaps(part.getBoundingClientRect(), other.getBoundingClientRect()))
        .forEach(other => problems.push(`${name}: ${part.getAttribute("aria-label") ?? "the header"} overlaps ${other.getAttribute("aria-label")}`)));
      for (const cell of parts.filter(t => t.localName === "nol-gallery-cell")) {
        const box = cell.getBoundingClientRect();
        const outside = [...cell.querySelectorAll<HTMLElement>(".nol-gallery-cell-specimen > *")].map(t => t.getBoundingClientRect())
          .some(t => t.width > 0 && (t.left < box.left - tolerance || t.right > box.right + tolerance));
        if (outside)
          problems.push(`${name}: ${cell.getAttribute("aria-label")} is wider than its cell`);
      }
      if (specimen.scrollWidth > specimen.clientWidth + tolerance)
        problems.push(`${name}: scrolls sideways`);
    }
    return problems;
  });
}

async function truncationAsync(control: Locator): Promise<{ isInside: boolean; isCut: boolean; overflow: string }> {
  return control.evaluate(t => {
    const box = t.getBoundingClientRect();
    const label = t.querySelector<HTMLElement>("[data-truncates]");
    if (label === null)
      throw new Error("Nothing matches [data-truncates].");
    const text = label.getBoundingClientRect();
    return {
      isInside: text.left >= box.left - 0.5 && text.right <= box.right + 0.5,
      isCut: label.scrollWidth > label.clientWidth,
      overflow: getComputedStyle(label).textOverflow
    };
  });
}

test.describe("gallery", () => {
  test("a development build shows the kit's controls on a Settings page in every theme, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await SettingsFixture.openGalleryAsync(window);

    await expect(window.locator("nol-gallery .nol-gallery-scope-frame")).toHaveCount(2);
    await expect(window.locator("nol-gallery .nol-gallery-scope-title")).toHaveText(["Default, light mode", "Default, dark mode"]);
    await expect(scope(window, "Light").locator("nol-gallery-forms, nol-gallery-navigation, nol-gallery-overlays")).toHaveCount(3);
    const panels = await window.locator("nol-gallery .nol-gallery-scope-frame").evaluateAll(frames => frames.map(t => getComputedStyle(t).backgroundColor));
    expect(new Set(panels).size).toBe(2);
    await mainProcess.checkpointAsync("gallery-light");

    await scope(window, "Dark").scrollIntoViewIfNeeded();
    await scope(window, "Dark").locator(".nol-gallery-scope-title").scrollIntoViewIfNeeded();
    await mainProcess.checkpointAsync("gallery-dark");
  });

  test("the Gallery opens at its top, and moving a quick input's active option scrolls only its own list", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const page = window.locator(".nol-settings-content");
    const quick = scope(window, "Dark").locator(".nol-gallery-specimen[aria-label=\"Quick input\"] nol-gallery-cell[aria-label=\"Default\"] nol-quick-input");
    const list = quick.locator(".nol-quick-input-list");
    const scrollTopAsync = (area: Locator): Promise<number> => area.evaluate(t => t.scrollTop);

    await SettingsFixture.openGalleryAsync(window);
    await expect(quick.getByRole("option").first()).toBeAttached();
    await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await scrollTopAsync(page)).toBe(0);

    await quick.scrollIntoViewIfNeeded();
    await list.evaluate(t => {
      const option = t.querySelector<HTMLElement>("[role=option]");
      if (option === null)
        throw new Error("Nothing matches [role=option].");
      t.style.setProperty("max-height", `${option.offsetHeight * 1.5}px`);
    });
    const top = await scrollTopAsync(page);
    await quick.locator(".nol-quick-input-field").focus();
    await window.keyboard.press("End");
    await expect.poll(() => scrollTopAsync(list)).toBeGreaterThan(0);
    expect(await scrollTopAsync(page)).toBe(top);
    await window.keyboard.press("Home");
    await expect.poll(() => scrollTopAsync(list)).toBe(0);
    expect(await scrollTopAsync(page)).toBe(top);
  });

  test("each Focus cell shows the keyboard focus without holding it, and each scope keeps its own colors", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openGalleryAsync(window);
    const dark = scope(window, "Dark");

    for (const name of ["Button", "Icon button", "Checkbox", "Text field", "Select", "Choice pills", "Tab", "Toolbar button", "Sash"])
      await expect(dark.locator(`.nol-gallery-specimen[aria-label="${name}"] nol-gallery-cell[aria-label="Focus"] [data-nol-state="Focus"]`)).toHaveCount(1);
    await expect(dark.locator(":focus")).toHaveCount(0);
    await dark.locator(".nol-gallery-specimen[aria-label=\"Button\"]").scrollIntoViewIfNeeded();
    await mainProcess.checkpointAsync("gallery-focus");
    const colors = await window.locator("nol-gallery .nol-gallery-scope-frame").evaluateAll(frames => frames.map(t => getComputedStyle(t).color));
    expect(new Set(colors).size).toBe(2);
  });

  test("with the side docks hidden, every section has its header, and its cells share their width and their row's top edge without overlapping, at 100% and 200% zoom and in a narrow window", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openGalleryAsync(window);
    await window.keyboard.press("ControlOrMeta+B");
    await window.keyboard.press("ControlOrMeta+Alt+B");
    await expect.poll(() => window.locator("nol-tab-group[data-side=Left], nol-tab-group[data-side=Right]").evaluateAll(t => t.filter(u => u.getBoundingClientRect().width > 0).length)).toBe(0);

    expect(await window.locator("nol-gallery .nol-gallery-specimen").count()).toBeGreaterThan(20);
    expect(await layoutProblemsAsync(window)).toEqual([]);
    await scope(window, "Light").locator(".nol-gallery-specimen[aria-label=\"Button\"]").scrollIntoViewIfNeeded();
    await mainProcess.checkpointAsync("gallery-sections-light");
    await scope(window, "Dark").locator(".nol-gallery-specimen[aria-label=\"Button\"]").scrollIntoViewIfNeeded();
    await mainProcess.checkpointAsync("gallery-sections-dark");

    const width = await window.evaluate(() => innerWidth);
    await mainProcess.zoomAsync(2, width / 2);
    expect(await layoutProblemsAsync(window)).toEqual([]);
    await mainProcess.zoomAsync(1, width);

    await mainProcess.useViewportAsync(640, 400);
    expect(await layoutProblemsAsync(window)).toEqual([]);
    await mainProcess.checkpointAsync("gallery-sections-narrow");
  });

  test("the tree is moved through, opened, closed and chosen from by keyboard alone", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openGalleryAsync(window);
    const tree = scope(window, "Light").locator(".nol-gallery-specimen[aria-label=\"Tree\"] nol-gallery-cell[aria-label=\"Default\"]").getByRole("tree", { name: "Gallery files" });
    const item = (name: string): Locator => tree.getByRole("treeitem", { name, exact: true });
    await item("Notes").focus();
    await expect(item("Notes")).toBeFocused();

    await window.keyboard.press("Home");
    await expect(item("Project")).toBeFocused();
    await expect(item("Project")).toHaveAttribute("aria-expanded", "true");
    await window.keyboard.press("ArrowRight");
    await expect(item("Source")).toBeFocused();
    await window.keyboard.press("ArrowRight");
    await window.keyboard.press("ArrowDown");
    await expect(item("App")).toBeFocused();
    await expect(item("App")).toHaveAttribute("aria-level", "3");
    await window.keyboard.press("End");
    await expect(item("A file name that is far too long to fit the width of its tree")).toBeFocused();
    await window.keyboard.press("Home");
    await window.keyboard.press("r");
    await expect(item("Readme")).toBeFocused();
    await window.keyboard.press("Enter");
    await expect(item("Readme")).toHaveAttribute("aria-selected", "true");
    await expect(item("Notes")).toHaveAttribute("aria-selected", "false");
    await mainProcess.checkpointAsync("gallery-tree");
    await window.keyboard.press("ArrowLeft");
    await expect(item("Project")).toBeFocused();
    await window.keyboard.press("ArrowLeft");
    await expect(item("Project")).toHaveAttribute("aria-expanded", "false");
    await expect(tree.getByRole("treeitem")).toHaveCount(3);
  });

  for (const mode of ["Light", "Dark"] as const)
    test(`a tree row is dragged with a ghost and a drop line and dropped into place, and moved by Alt and the arrow keys, in ${mode.toLowerCase()} mode`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      await SettingsFixture.openGalleryAsync(window);
      const cell = scope(window, mode).locator(".nol-gallery-specimen[aria-label=\"Tree\"] nol-gallery-cell[aria-label=\"Default\"]");
      const tree = cell.getByRole("tree", { name: "Gallery files" });
      const host = cell.locator("nol-tree.nol-gallery-tree");
      const item = (name: string): Locator => tree.getByRole("treeitem", { name, exact: true });
      const order = (): Promise<(string | null)[]> => tree.locator(".nol-tree-label").evaluateAll(t => t.map(u => u.textContent));
      const centreOf = async (name: string, fraction: number): Promise<{ x: number; y: number }> => {
        const box = await item(name).boundingBox();
        if (Object.isNull(box))
          throw new Error(`The tree item ${name} has no box.`);
        return { x: box.x + box.width / 2, y: box.y + box.height * fraction };
      };
      await item("Notes").scrollIntoViewIfNeeded();

      const from = await centreOf("Notes", 0.5);
      await window.mouse.move(from.x, from.y);
      await window.mouse.down();
      await window.mouse.move(from.x + 8, from.y - 8, { steps: 3 });
      const branch = await centreOf("Project", 0.5);
      await window.mouse.move(branch.x, branch.y);
      await expect(item("Project")).toHaveClass(/nol-tree-row-drop/u);
      await mainProcess.checkpointAsync(`gallery-tree-drag-branch-${mode.toLowerCase()}`);
      const target = await centreOf("Readme", 0.1);
      await window.mouse.move(target.x, target.y);
      await expect(host.locator(".nol-tree-ghost")).toHaveText(/Notes/u);
      await expect(host.locator(".nol-tree-drop-line")).toBeVisible();
      await mainProcess.checkpointAsync(`gallery-tree-drag-${mode.toLowerCase()}`);
      await window.mouse.up();

      await expect(host.locator(".nol-tree-ghost")).toHaveCount(0);
      await expect.poll(order).toEqual(["Project", "Source", "Notes", "Readme", "A file name that is far too long to fit the width of its tree"]);
      await expect(item("Readme")).toHaveAttribute("aria-selected", "false");
      await expect(item("Notes")).toBeFocused();
      await item("Notes").focus();
      await window.keyboard.press("Alt+ArrowLeft");
      await expect.poll(order).toEqual(["Project", "Source", "Readme", "Notes", "A file name that is far too long to fit the width of its tree"]);
      await expect(item("Notes")).toBeFocused();
      await window.keyboard.press("Alt+ArrowUp");
      await expect.poll(order).toEqual(["Notes", "Project", "Source", "Readme", "A file name that is far too long to fit the width of its tree"]);
      await expect(item("Notes")).toBeFocused();
    });

  test("toolbar buttons never overlap, and a label too long for its button ends with an ellipsis inside it and shows in full in its tooltip, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".nol-gallery-specimen[aria-label=\"Toolbar button\"]");
      await specimen.scrollIntoViewIfNeeded();
      const overlaps = await specimen.evaluate(t => {
        const boxes = [...t.querySelectorAll(".nol-toolbar-button")].map(u => u.getBoundingClientRect());
        return boxes.flatMap((box, i) => boxes.slice(i + 1).filter(other => Math.min(box.right, other.right) - Math.max(box.left, other.left) > 0.5 &&
          Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 0.5).map(() => i));
      });
      expect(overlaps).toEqual([]);
      const long = specimen.locator(".nol-toolbar-button.nol-gallery-narrow");
      expect(await truncationAsync(long)).toEqual({ isInside: true, isCut: true, overflow: "ellipsis" });
      await long.hover();
      await expect(scope(window, mode).locator(".cdk-overlay-container nol-tooltip")).toHaveText((await long.getAttribute("aria-label")) ?? String.empty);
      await mainProcess.checkpointAsync(`toolbar-button-long-label-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });

  test("the text field and the select write in the panel text size, and an open select's list shows its thumb while hovered, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".nol-gallery-specimen[aria-label=\"Select\"]");
      await specimen.scrollIntoViewIfNeeded();
      const sizes = await scope(window, mode).evaluate(t => {
        const probe = t.appendChild(document.createElement("div"));
        probe.style.fontSize = "var(--nol-text-panel)";
        const panel = getComputedStyle(probe).fontSize;
        probe.style.fontSize = "var(--nol-text-label)";
        const label = getComputedStyle(probe).fontSize;
        probe.remove();
        const field = t.querySelector(".nol-gallery-specimen[aria-label=\"Text field\"] input");
        if (field === null)
          throw new Error("Nothing matches .nol-gallery-specimen[aria-label=\"Text field\"] input.");
        const select = t.querySelector(".nol-gallery-specimen[aria-label=\"Select\"] .nol-select-button");
        if (select === null)
          throw new Error("Nothing matches .nol-gallery-specimen[aria-label=\"Select\"] .nol-select-button.");
        return { panel, label, field: getComputedStyle(field).fontSize, select: getComputedStyle(select).fontSize };
      });
      expect(sizes.panel).not.toBe(sizes.label);
      expect([sizes.field, sizes.select]).toEqual([sizes.panel, sizes.panel]);

      await specimen.locator(".nol-select-button").first().click();
      const list = scope(window, mode).locator(".cdk-overlay-container .nol-select-list");
      await expect(list).toBeVisible();
      await list.evaluate(t => {
        const option = t.querySelector<HTMLElement>(".nol-select-option");
        if (option === null)
          throw new Error("Nothing matches .nol-select-option.");
        t.style.setProperty("max-height", `${option.offsetHeight * 1.5}px`);
      });
      expect(await list.evaluate(t => t.scrollHeight > t.clientHeight)).toBe(true);
      expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, list, "vertical")).toBe(true);
      await mainProcess.checkpointAsync(`select-list-thumb-${mode.toLowerCase()}`);
      await window.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
    }
  });

  test("in the narrowest window a select's list never scrolls sideways, and an option too long for it ends with an ellipsis and shows in full in its tooltip, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.useViewportAsync(640, 480);
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const select = scope(window, mode).locator(".nol-gallery-specimen[aria-label=\"Select\"] nol-select.nol-gallery-narrow");
      await select.scrollIntoViewIfNeeded();
      await select.locator(".nol-select-button").click();
      const list = scope(window, mode).locator(".cdk-overlay-container .nol-select-list");
      await expect(list).toBeVisible();
      const option = list.locator(".nol-select-option[data-value=\"long\"]");
      const fit = await list.evaluate(t => ({ hiddenWidth: t.scrollWidth - t.clientWidth, isInside: t.getBoundingClientRect().right <= document.documentElement.clientWidth, overflow: getComputedStyle(t).overflowX }));

      expect(fit).toEqual({ hiddenWidth: 0, isInside: true, overflow: "hidden" });
      expect(await truncationAsync(option)).toEqual({ isInside: true, isCut: true, overflow: "ellipsis" });
      const title = (await option.textContent())?.trim() ?? String.empty;
      await expect(list.getByRole("option", { name: title })).toBeVisible();
      const tooltip = scope(window, mode).locator(".cdk-overlay-container nol-tooltip");
      await option.hover();
      await expect(tooltip).toHaveText(title);
      const covered = await tooltip.evaluate(t => {
        const area = t.getBoundingClientRect();
        return [...document.querySelectorAll(".nol-select-list .nol-select-option")].filter(u => {
          const row = u.getBoundingClientRect();
          return row.left < area.right && area.left < row.right && row.top < area.bottom && area.top < row.bottom;
        }).map(u => u.getAttribute("data-value"));
      });
      expect(covered).toEqual([]);
      await mainProcess.checkpointAsync(`select-list-long-option-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
      await expect(tooltip).toHaveCount(0);
      await window.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
    }
  });

  test("a button's label too long for it starts at its start padding, ends with an ellipsis and shows in full in its tooltip, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const button = scope(window, mode).locator(".nol-gallery-specimen[aria-label=\"Button\"] button.nol-gallery-narrow");
      await button.scrollIntoViewIfNeeded();
      const start = await button.evaluate(t => {
        const style = getComputedStyle(t);
        const label = t.querySelector<HTMLElement>("[data-truncates]");
        if (label === null)
          throw new Error("Nothing matches [data-truncates].");
        return Math.round(label.getBoundingClientRect().left - t.getBoundingClientRect().left - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.paddingLeft));
      });
      expect(start).toBe(0);
      expect(await truncationAsync(button)).toEqual({ isInside: true, isCut: true, overflow: "ellipsis" });
      await button.hover();
      await expect(scope(window, mode).locator(".cdk-overlay-container nol-tooltip")).toHaveText(await button.innerText());
      await mainProcess.checkpointAsync(`button-long-label-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });

  test("a configuration table shows its heading and Add above its explanation and separated rows, or without a heading its explanation beside Add, grows a row for long text and runs past its end, into an area that scrolls sideways, only when narrow, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openGalleryAsync(window);

    for (const mode of ["Light", "Dark"] as const) {
      const specimen = scope(window, mode).locator(".nol-gallery-specimen[aria-label=\"Configuration table\"]");
      const normal = specimen.locator("nol-gallery-cell[aria-label=\"Default\"]");
      const table = normal.getByRole("table", { name: "Environment variables", exact: true });
      const narrow = specimen.getByRole("table", { name: "Narrow environment variables" });
      const areas = specimen.locator(".nol-configuration-table-body");
      await specimen.scrollIntoViewIfNeeded();

      await expect(normal.getByRole("heading", { name: "Environment variables" })).toBeVisible();
      await expect(table.getByRole("columnheader")).toHaveText(["Name", "Value", "Scope", String.empty]);
      await expect(table.getByRole("columnheader").last()).toHaveAttribute("aria-label", "Actions");
      await expect(table.getByRole("button", { name: "Remove NOTES_HOME" })).toBeVisible();
      await expect(areas).toHaveCount(6);
      await expect(narrow.getByRole("row")).toHaveCount(3);
      const [wide, small] = [normal.locator(".nol-configuration-table-body"), specimen.locator(".nol-gallery-table-holder.nol-gallery-narrow")];
      const unheaded = specimen.locator("nol-configuration-table").filter({ has: window.getByRole("table", { name: "Global environment variables" }) });
      const [heading, add, explanation, grid] = await Promise.all([
        normal.locator(".nol-configuration-table-heading").boundingBox(),
        normal.locator(".nol-configuration-table-actions button").boundingBox(),
        normal.locator(".nol-configuration-table-explanation").boundingBox(),
        table.boundingBox()
      ]);
      const measured = await wide.evaluate((t: HTMLElement) => {
        const find = (selector: string, root: ParentNode = t): HTMLElement => {
          const found = root.querySelector<HTMLElement>(selector);
          if (found === null)
            throw new Error(`The configuration table has no ${selector}.`);
          return found;
        };
        const baseline = (host: Element): number => {
          const probe = document.createElement("span");
          probe.style.display = "inline-block";
          host.prepend(probe);
          const bottom = probe.getBoundingClientRect().bottom;
          probe.remove();
          return bottom;
        };
        const row = find("tbody tr");
        const first = document.createRange();
        first.selectNodeContents(find("tbody td"));
        const scope = document.createRange();
        scope.selectNodeContents(find("td:nth-child(3)", row));
        const label = baseline(find("td:last-child button [data-truncates]", row));
        return {
          firstLeft: first.getBoundingClientRect().left,
          removeRight: find("tbody tr td:last-child button:last-child").getBoundingClientRect().right,
          rowHeights: [...t.querySelectorAll("tbody tr")].map(r => r.getBoundingClientRect().height),
          baselines: [...row.querySelectorAll("td:not(:last-child)")].map(c => Math.round(baseline(c) - label)),
          scopeLines: scope.getClientRects().length,
          separators: [...new Set([...t.querySelectorAll("th, td")].map(c => getComputedStyle(c).borderBottomStyle))],
          overflow: t.scrollWidth - t.clientWidth
        };
      });
      const measuredNarrow = await small.evaluate((t: HTMLElement) => {
        const cell = t.querySelectorAll("tbody tr")[1]?.children[1];
        if (cell === undefined)
          throw new Error("The narrow configuration table has no second row with a second cell.");
        const token = document.createRange();
        token.selectNodeContents(cell);
        return { tokenLines: token.getClientRects().length, overflow: t.scrollWidth - t.clientWidth };
      });
      await expect(unheaded.getByRole("table", { name: "Global environment variables" })).toBeVisible();
      await expect(unheaded.locator(".nol-configuration-table-header .nol-configuration-table-explanation")).toHaveText("These apply to every project, before the project's own variables.");
      const leading = await unheaded.evaluate((t: HTMLElement) => {
        const text = t.querySelector<HTMLElement>(".nol-configuration-table-explanation");
        const button = t.querySelector<HTMLElement>(".nol-configuration-table-actions button");
        const label = button === null ? null : button.querySelector<HTMLElement>("[data-truncates]");
        if (text === null || button === null || label === null)
          throw new Error("The configuration table without a heading has no explanation or Add.");
        const baseline = (host: Element): number => {
          const probe = document.createElement("span");
          probe.style.display = "inline-block";
          host.prepend(probe);
          const bottom = probe.getBoundingClientRect().bottom;
          probe.remove();
          return bottom;
        };
        return { isBeside: text.getBoundingClientRect().right < button.getBoundingClientRect().left, baseline: Math.round(baseline(text) - baseline(label)) };
      });
      expect(leading).toEqual({ isBeside: true, baseline: 0 });
      if (Object.isNull(heading) || Object.isNull(add) || Object.isNull(explanation) || Object.isNull(grid))
        throw new Error("The configuration table's heading, Add, explanation or table is not shown.");

      const edges = [measured.firstLeft - grid.x, grid.x + grid.width - measured.removeRight, heading.x - grid.x, grid.x + grid.width - (add.x + add.width)].map(t => Math.round(t));
      expect(edges).toEqual([0, 0, 0, 0]);
      expect(measured.baselines).toEqual([0, 0, 0]);
      expect([measured.scopeLines, measuredNarrow.tokenLines]).toEqual([1, 1]);
      expect(measured.separators).toEqual(["solid"]);
      expect(add.y).toBeLessThan(heading.y + heading.height);
      expect(add.y + add.height).toBeGreaterThan(heading.y);
      expect(add.x).toBeGreaterThan(heading.x + heading.width);
      expect(explanation.y).toBeGreaterThanOrEqual(Math.max(heading.y + heading.height, add.y + add.height));
      expect(grid.y).toBeGreaterThanOrEqual(explanation.y + explanation.height);
      expect(measured.rowHeights.at(-1)).toBeGreaterThan(Math.max(...measured.rowHeights.slice(0, -1)));
      expect(measured.overflow).toBeLessThanOrEqual(0);
      expect(measuredNarrow.overflow).toBeGreaterThan(0);
      await small.evaluate(t => {
        t.scrollTo({ left: t.scrollWidth });
        t.scrollIntoView({ block: "end" });
      });
      await expect(narrow.getByRole("button", { name: "Remove LANG" })).toBeInViewport();
      expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, small, "horizontal")).toBe(true);
      await ScrollAreaFixture.revealThumbColorAsync(window, small);
      await mainProcess.checkpointAsync(`configuration-table-${mode.toLowerCase()}`);
      await window.mouse.move(0, 0);
    }
  });

  test("a code block is colored under the window's content security policy, its Word wrap is pressed by keyboard and wraps its lines, its long line never widens the Settings document, its text keeps equal space over and under it and its end padding when scrolled to the end, and Copy puts its code on the system clipboard, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator(".nol-settings-content");
    await SettingsFixture.openGalleryAsync(window);
    const policy = await window.locator("meta[http-equiv=\"Content-Security-Policy\"]").getAttribute("content");
    expect(policy).toContain("script-src 'self';");
    expect(policy).not.toContain("unsafe-eval");

    for (const mode of ["Light", "Dark"] as const) {
      const block = scope(window, mode).locator(".nol-gallery-specimen[aria-label=\"Code block\"] nol-gallery-cell[aria-label=\"Default\"] nol-code-block");
      const body = block.locator(".nol-code-block-body");
      const wrap = block.getByRole("button", { name: "Word wrap" });
      const overflowAsync = (area: Locator): Promise<number> => area.evaluate(t => t.scrollWidth - t.clientWidth);
      const edgesAsync = (): Promise<{ top: number; bottom: number; start: number; end: number }> => body.evaluate((t: HTMLElement) => {
        const range = document.createRange();
        const code = t.querySelector("code");
        if (code === null)
          throw new Error("Nothing matches code.");
        range.selectNodeContents(code);
        const area = t.getBoundingClientRect();
        const lines = [...range.getClientRects()];
        const firstLine = lines[0];
        const lastLine = lines.at(-1);
        if (firstLine === undefined || lastLine === undefined)
          throw new Error("The code has no lines.");
        const start = firstLine.left - area.left;
        const scroll = t.scrollLeft;
        t.scrollLeft = t.scrollWidth;
        const end = area.right - Math.max(...[...range.getClientRects()].map(u => u.right));
        t.scrollLeft = scroll;
        return { top: Math.round(firstLine.top - area.top), bottom: Math.round(area.bottom - lastLine.bottom), start: Math.round(start), end: Math.round(end) };
      });
      await block.scrollIntoViewIfNeeded();

      await expect.poll(() => block.evaluate((t: HTMLElement) => {
        const code = t.querySelector("code");
        if (code === null)
          throw new Error("Nothing matches code.");
        return [...t.querySelectorAll(".nol-code-line > span")].filter(u => getComputedStyle(u).color !== getComputedStyle(code).color).length;
      })).toBeGreaterThan(0);
      await expect(block.getByRole("toolbar", { name: "Code block actions" }).getByRole("button")).toHaveText(["wrap_text", "content_copy"]);
      await expect(wrap).toHaveAttribute("aria-pressed", "false");
      expect(await overflowAsync(body)).toBeGreaterThan(0);
      expect(await overflowAsync(content)).toBeLessThanOrEqual(0);
      const scrolling = await edgesAsync();
      expect([scrolling.bottom, scrolling.end]).toEqual([scrolling.top, scrolling.start]);

      await wrap.focus();
      await window.keyboard.press("Enter");
      await expect(wrap).toHaveAttribute("aria-pressed", "true");
      expect(await overflowAsync(body)).toBeLessThanOrEqual(0);
      await expect.poll(async () => {
        const wrapped = await edgesAsync();
        return [wrapped.top, wrapped.bottom];
      }).toEqual([scrolling.top, scrolling.top]);
      await mainProcess.checkpointAsync(`code-block-wrapped-${mode.toLowerCase()}`);
      await window.keyboard.press("Space");
      await expect(wrap).toHaveAttribute("aria-pressed", "false");
      expect(await overflowAsync(body)).toBeGreaterThan(0);

      await window.keyboard.press("ArrowRight");
      await window.keyboard.press("Enter");
      await expect(block.getByRole("button", { name: "Copied" })).toBeFocused();
      expect(await mainProcess.application.evaluate(({ clipboard }) => clipboard.readText())).toBe(await block.locator("code").textContent());
      await mainProcess.checkpointAsync(`code-block-copied-${mode.toLowerCase()}`);
      await expect(block.getByRole("button", { name: "Copy", exact: true })).toBeVisible({ timeout: 5000 });
    }
  });
});
