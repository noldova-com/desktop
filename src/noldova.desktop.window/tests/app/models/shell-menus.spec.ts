/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { productName } from "../../../../../_build/generated/product";
import { ProductName } from "../../../src/app/models/product-name";
import { ShellMenus } from "../../../src/app/models/shell-menus";

describe("ShellMenus", () => {
  it("declares the shell's menus, with the menu bar's places first, the editing group only where the system does not give one, the text field menu everywhere and Check for updates in Help or the macOS application menu", () => {
    const mac = ShellMenus.of(true);
    const other = ShellMenus.of(false);

    expect([mac.moduleId, other.moduleId]).toEqual(["desktop", "desktop"]);
    expect(mac.places).toEqual(other.places);
    expect(mac.places.filter(t => t.isMenuBar).map(t => t.name)).toEqual(["desktop.file", "desktop.edit", "desktop.view", "desktop.window", "desktop.help"]);
    expect(mac.places.length).toBe(15);
    expect(mac.groups.filter(t => t.place === "desktop.link").map(t => [t.name, t.items.map(u => u.command)]))
      .toEqual([["desktop.linkOpen", ["desktop.openLinkInApp", "desktop.openLinkInBrowser"]]]);
    expect(mac.places.find(t => t.name === "desktop.field")?.isMenuBar).toBe(false);
    expect(mac.groups.some(t => t.name === "desktop.editing")).toBe(false);
    expect(other.groups.slice(2)).toEqual(mac.groups.slice(1));
    expect([other.groups[0]?.name, other.groups[0]?.place, other.groups[0]?.items.map(t => t.command)]).toEqual(["desktop.updates", "desktop.help", ["desktop.checkForUpdates"]]);
    expect([mac.groups[0]?.name, mac.groups[0]?.place, mac.groups[0]?.items.map(t => t.command)]).toEqual(["desktop.updates", "desktop.app", ["desktop.checkForUpdates"]]);
    expect([other.groups[1]?.name, other.groups[1]?.place, other.groups[1]?.items.map(t => t.command)])
      .toEqual(["desktop.editing", "desktop.edit", ["desktop.undo", "desktop.redo", "desktop.cut", "desktop.copy", "desktop.paste", "desktop.selectAll"]]);
    expect([mac.groups[1]?.name, mac.groups[1]?.place, mac.groups[1]?.isDynamic]).toEqual(["desktop.fieldSpelling", "desktop.field", true]);
    expect([mac.groups[2]?.name, mac.groups[2]?.place, mac.groups[2]?.items.map(t => t.command)])
      .toEqual(["desktop.fieldEditing", "desktop.field", ["desktop.cut", "desktop.copy", "desktop.paste", "desktop.selectAll"]]);
    expect(mac.groups.filter(t => t.place === "desktop.app").map(t => t.name)).toEqual(["desktop.updates", "desktop.settings", "desktop.commandLine"]);
    expect(other.groups.filter(t => t.place === "desktop.help").map(t => [t.name, t.items.map(u => u.command)]))
      .toEqual([["desktop.updates", ["desktop.checkForUpdates"]], ["desktop.support", ["desktop.openLogFolder", "desktop.copyDetails"]]]);
    expect(mac.groups.filter(t => t.place === "desktop.help").map(t => [t.name, t.items.map(u => u.command)])).toEqual([["desktop.support", ["desktop.openLogFolder", "desktop.copyDetails"]]]);
    expect(mac.groups.filter(t => t.isDynamic).map(t => t.name)).toContain("desktop.tabToolbars");
    expect(mac.groups.filter(t => t.isDynamic).length).toBe(5);
  });

  it("declares the layout menu outside the menu bar, with the docks, then the views the window lists, then Reset the layout", () => {
    const menus = ShellMenus.of(false);
    const place = menus.places.find(t => t.name === "desktop.layoutMenu");

    expect([place?.title, place?.icon, place?.isMenuBar]).toEqual(["Layout", "dashboard", false]);
    expect(menus.groups.filter(t => t.place === "desktop.layoutMenu").map(t => [t.name, t.isDynamic, t.items.map(u => [u.command, u.label])])).toEqual([
      ["desktop.layoutDocks", false, [["desktop.toggleLeftDock", "Left dock"], ["desktop.toggleRightDock", "Right dock"], ["desktop.toggleBottomDock", "Bottom dock"]]],
      ["desktop.layoutViews", true, []],
      ["desktop.layoutReset", false, [["desktop.resetLayout", null]]]
    ]);
  });

  it("titles the macOS application menu with the name the window started with, which the window learns only after its code has loaded", () => {
    ProductName.use("Another Product");
    try {
      expect(ShellMenus.of(true).places.find(t => t.name === "desktop.app")?.title).toBe("Another Product");
    }
    finally {
      ProductName.use(productName);
    }
  });
});
