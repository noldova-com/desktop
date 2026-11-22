/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ViewToolbarBandComponent } from "../../../../src/app/components/view-toolbar-band/view-toolbar-band.component";
import { CommandRow } from "../../../../src/app/models/command-row";
import { MenuCheck } from "../../../../src/app/enums/menu-check";
import { MenuSection } from "../../../../src/app/models/menu-section";
import { PageTokens } from "../../../../src/app/models/page-tokens";
import { Toolbar } from "../../../../src/app/models/toolbar";
import { ToolbarBandPage } from "../../../../src/app/models/toolbar-band-page";
import { ToolbarDragService } from "../../../../src/app/services/toolbar-drag.service";
import { ToolbarService } from "../../../../src/app/services/toolbar.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";

describe("ViewToolbarBandComponent", () => {
  const section = new MenuSection("notes.create", [new CommandRow("notes.newNote", {}, "New note", "note", null, true, MenuCheck.None, false)]);
  const rowsOf = vi.fn(() => [[new Toolbar("notes.boardMain", "Board", [section])]]);

  beforeEach(() => {
    rowsOf.mockClear();
    PreloadBridgeFixture.install();
  });

  afterEach(() => PreloadBridgeFixture.remove());

  const create = (page: ToolbarBandPage | null): HTMLElement => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ToolbarService, useValue: { rowsOf } },
        { provide: ToolbarDragService, useValue: { dragging: signal(null), begin: vi.fn(), target: signal(null), band: signal(null) } },
        ...Object.isNull(page) ? [] : [{ provide: PageTokens.toolbarBand, useValue: page }]
      ]
    });
    const fixture = TestBed.createComponent(ViewToolbarBandComponent);
    fixture.detectChanges();
    return DomFixture.host(fixture);
  };

  it("shows the band of the page it is on, with the page's arguments", () => {
    const element = create(new ToolbarBandPage("notes.board", { view: "notes.board", instance: "one" }));

    expect([rowsOf.mock.lastCall, [...element.querySelectorAll<HTMLElement>("nol-toolbar")].map(t => t.dataset["toolbar"])])
      .toEqual([["notes.board", { view: "notes.board", instance: "one" }], ["notes.boardMain"]]);
  });

  it("shows nothing on a page that isn't a tab's", () => {
    const element = create(null);

    expect([element.querySelector("nol-toolbar-band"), rowsOf.mock.calls.length]).toEqual([null, 0]);
  });
});
