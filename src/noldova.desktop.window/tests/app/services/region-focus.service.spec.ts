/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { RegionFocusService } from "../../../src/app/services/region-focus.service";

describe("RegionFocusService", () => {
  let root: HTMLElement;
  let regions: RegionFocusService;

  beforeEach(() => {
    root = document.createElement("div");
    root.innerHTML = [
      "<nol-window-row><button id='search'>Search</button></nol-window-row>",
      "<nol-toolbar-band></nol-toolbar-band>",
      "<nol-tab-group><button id='tab'>Browser</button><nol-tab-slot><button id='address'>Address</button>",
      "<div class='nol-web-view'><button id='inside'>Inside</button><webview id='page' class='nol-web-view-guest' tabindex='-1'></webview></div>",
      "<div class='nol-web-view' style='visibility: hidden'><webview id='hidden' class='nol-web-view-guest' tabindex='-1'></webview></div>",
      "</nol-tab-slot></nol-tab-group>",
      "<nol-tab-group><button id='notes'>Notes</button></nol-tab-group>",
      "<nol-status-bar><button id='status'>Status</button></nol-status-bar>"
    ].join("");
    document.body.append(root);
    regions = TestBed.inject(RegionFocusService);
  });

  afterEach(() => root.remove());

  function focusOn(id: string): void {
    document.getElementById(id)?.focus();
  }

  function walk(step: number, count: number): string[] {
    return Array.from({ length: count }, () => {
      regions.move(step);
      return document.activeElement?.id ?? "none";
    });
  }

  it("moves the focus forward through the regions, a view and the rest of its pane as two stops, past an empty region and a hidden view, and around again", () => {
    expect(walk(1, 6)).toEqual(["search", "address", "page", "notes", "status", "search"]);
    expect(regions.hasStops()).toBe(true);
  });

  it("moves the focus back through the same stops with a negative step, starting from the last one", () => {
    expect(walk(-1, 6)).toEqual(["status", "notes", "page", "address", "search", "status"]);
  });

  it("moves on from wherever the focus is in a stop: the tab strip counts as its group, and an element in the view's frame as the view", () => {
    focusOn("tab");
    regions.move(1);
    const fromTab = document.activeElement?.id;
    focusOn("inside");
    regions.move(1);
    const fromInside = document.activeElement?.id;
    focusOn("page");
    regions.move(-1);

    expect([fromTab, fromInside, document.activeElement?.id]).toEqual(["page", "notes", "address"]);
  });

  it("moves on from a view whose page holds the focus inside the guest's own tree, as a live web view does", () => {
    const guest = document.createElement("div");
    guest.id = "page";
    guest.className = "nol-web-view-guest";
    document.getElementById("page")?.replaceWith(guest);
    const frame = guest.attachShadow({ mode: "open" }).appendChild(document.createElement("iframe"));
    frame.contentWindow?.focus();
    const before = document.activeElement?.id;
    regions.move(1);

    expect([before, document.activeElement?.id]).toEqual(["page", "notes"]);
  });

  it("makes the view a group's only stop when nothing else in the group is in the tab order", () => {
    root.innerHTML = [
      "<nol-tab-group><nol-tab-slot><div class='nol-web-view'><button id='inside'>Inside</button><webview id='page' class='nol-web-view-guest' tabindex='-1'></webview></div>",
      "<div class='nol-web-view' style='visibility: hidden'><webview class='nol-web-view-guest' tabindex='-1'></webview></div></nol-tab-slot></nol-tab-group>"
    ].join("");

    expect(walk(1, 2)).toEqual(["page", "page"]);
  });

  it("does nothing when no region has an element in the tab order", () => {
    root.innerHTML = "<nol-window-row></nol-window-row><nol-status-bar><button disabled>Off</button></nol-status-bar>";
    const before = document.activeElement;
    regions.move(1);

    expect([regions.hasStops(), document.activeElement]).toEqual([false, before]);
  });
});
