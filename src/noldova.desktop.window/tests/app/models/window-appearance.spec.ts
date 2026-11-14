/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowAppearance } from "../../../src/app/models/window-appearance";

describe("WindowAppearance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
    document.body.removeAttribute("style");
  });

  it("reads the page's background and the window row's colors and height as the browser computes them", () => {
    const row = document.createElement("div");
    document.body.style.backgroundColor = "#181818";
    row.style.cssText = "background-color: #f8f8f8; color: #1e1e1e; height: 34.6px";
    document.body.append(row);

    const appearance = WindowAppearance.read(row);

    expect(appearance.background).toBe("rgb(24, 24, 24)");
    expect(appearance.titleBar).toBe("rgb(248, 248, 248)");
    expect(appearance.titleBarText).toBe("rgb(30, 30, 30)");
    expect(appearance.titleBarHeight).toBe(35);
  });

  it("reads the window row's colors as they show under each cover in turn, and leaves the page's background as it is", () => {
    const row = document.createElement("div");
    const covers = ["rgb(0 0 0 / 50%)", "rgb(255 255 255 / 25%)", "transparent"].map(t => {
      const cover = document.createElement("div");
      cover.style.backgroundColor = t;
      return cover;
    });
    document.body.style.backgroundColor = "#181818";
    row.style.cssText = "background-color: #f8f8f8; color: #1e1e1e; height: 34.6px";
    document.body.append(row, ...covers);

    const appearance = WindowAppearance.read(row, covers);

    expect([appearance.background, appearance.titleBar, appearance.titleBarText]).toEqual(["rgb(24, 24, 24)", "rgb(157, 157, 157)", "rgb(75, 75, 75)"]);
  });

  it("reads the window row's colors as an opaque cover's own", () => {
    const row = document.createElement("div");
    const cover = document.createElement("div");
    row.style.cssText = "background-color: #f8f8f8; color: #1e1e1e";
    cover.style.backgroundColor = "#336699";
    document.body.append(row, cover);

    const appearance = WindowAppearance.read(row, [cover]);

    expect([appearance.titleBar, appearance.titleBarText]).toEqual(["rgb(51, 102, 153)", "rgb(51, 102, 153)"]);
  });

  it("reads the window row's colors under a cover by the cover's own opacity too, as it shows partway through a fade", () => {
    const row = document.createElement("div");
    const cover = document.createElement("div");
    row.style.cssText = "background-color: #f8f8f8; color: #1e1e1e";
    cover.style.cssText = "background-color: rgb(0 0 0 / 50%); opacity: 0.2";
    document.body.append(row, cover);

    const appearance = WindowAppearance.read(row, [cover]);

    expect([appearance.titleBar, appearance.titleBarText]).toEqual(["rgb(223, 223, 223)", "rgb(27, 27, 27)"]);
  });

  it("reads a translucent title bar over the page and translucent text over the title bar, as the page shows them, and a title bar over nothing as translucent", () => {
    const row = document.createElement("div");
    document.body.style.backgroundColor = "#181818";
    row.style.cssText = "background-color: rgb(255 0 0 / 40%); color: rgb(0 0 255 / 40%)";
    document.body.append(row);
    const over = WindowAppearance.read(row);
    document.body.style.backgroundColor = "transparent";

    const alone = WindowAppearance.read(row);

    expect([over.titleBar, over.titleBarText]).toEqual(["rgb(116, 14, 14)", "rgb(70, 9, 111)"]);
    expect([alone.background, alone.titleBar]).toEqual(["rgba(0, 0, 0, 0)", "rgba(255, 0, 0, 0.4)"]);
  });

  it("reads colors the browser keeps in other forms, such as oklch() and color(srgb), clamped to what sRGB shows, and leaves nothing in the page", () => {
    const row = document.createElement("div");
    const cover = document.createElement("div");
    row.style.cssText = "background-color: oklch(1 0 0); color: color(srgb 1.2 -0.1 0.4)";
    cover.style.backgroundColor = "color(srgb 0.2 0.4 0.6 / 0)";
    document.body.append(row, cover);
    const children = [...document.body.children];

    const appearance = WindowAppearance.read(row, [cover]);

    expect([appearance.titleBar, appearance.titleBarText]).toEqual(["rgb(255, 255, 255)", "rgb(255, 0, 102)"]);
    expect([...document.body.children]).toEqual(children);
  });

  it("reads a missing color component, such as none, as 0", () => {
    const row = document.createElement("div");
    row.style.cssText = "background-color: color(srgb none 0.5 1); color: color(srgb 1 1 1 / none)";
    document.body.append(row);

    const appearance = WindowAppearance.read(row);

    expect([appearance.titleBar, appearance.titleBarText]).toEqual(["rgb(0, 128, 255)", "rgb(0, 128, 255)"]);
  });

  it("leaves nothing in the page when a cover cannot be read", () => {
    const row = document.createElement("div");
    document.body.append(row);
    const cover = document.createElement("div");
    const children = [...document.body.children];
    const computed = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      if (element === cover)
        throw new TypeError("The cover's style cannot be read.");
      return computed(element, pseudo);
    });

    expect(() => WindowAppearance.read(row, [cover])).toThrow(TypeError);
    expect([...document.body.children]).toEqual(children);
  });

  it("writes its JSON", () => {
    expect(new WindowAppearance("#000", "#111", "#222", 20).toJson()).toEqual({ background: "#000", titleBar: "#111", titleBarText: "#222", titleBarHeight: 20 });
  });
});
