/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import { ToolbarDropTarget } from "../../../src/app/models/toolbar-drop-target";
import { ToolbarDragService } from "../../../src/app/services/toolbar-drag.service";
import { ToolbarService } from "../../../src/app/services/toolbar.service";
import { DomFixture } from "../../fixtures/dom.fixture";

describe("ToolbarDragService", () => {
  const toolbars = { arrangementOf: vi.fn(), bandOf: vi.fn(), move: vi.fn(), moveToNewRow: vi.fn() };
  let drag: ToolbarDragService;
  let root: HTMLElement;

  beforeEach(() => {
    toolbars.arrangementOf.mockImplementation((band: string | null) => Object.isNull(band) ? [["a", "b"], ["c"]] : [["x", "y"]]);
    toolbars.bandOf.mockImplementation((name: string) => ["x", "y"].includes(name) ? "notes.page" : null);
    TestBed.configureTestingModule({ providers: [{ provide: ToolbarService, useValue: toolbars }] });
    drag = TestBed.inject(ToolbarDragService);
    root = document.createElement("div");
    root.innerHTML = [
      "<div class=\"nol-toolbar-band\" style=\"position:fixed;left:0;top:0;width:400px;display:flex;flex-direction:column;row-gap:8px\">",
      "<div class=\"nol-toolbar-row\" data-toolbar-row=\"0\" style=\"display:flex;align-items:center;height:40px\">",
      "<div class=\"nol-toolbar\" data-toolbar=\"a\" data-toolbar-index=\"0\" style=\"flex:none;width:100px;height:24px\"></div>",
      "<div class=\"nol-toolbar\" data-toolbar=\"b\" data-toolbar-index=\"1\" style=\"flex:none;width:100px;height:24px\"></div></div>",
      "<div class=\"nol-toolbar-row\" data-toolbar-row=\"1\" style=\"display:flex;align-items:center;height:40px\">",
      "<div class=\"nol-toolbar\" data-toolbar=\"c\" data-toolbar-index=\"0\" style=\"flex:none;width:100px;height:24px\"></div></div></div>"
    ].join(String.empty);
    document.body.append(root);
  });

  afterEach(() => {
    document.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    root.remove();
    vi.clearAllMocks();
  });

  function start(name: string, button: number = 0, from: Element = DomFixture.one(root, `[data-toolbar="${name}"]`)): void {
    const begin = (event: Event): void => {
      if (event instanceof PointerEvent)
        drag.begin(name, event);
    };
    from.addEventListener("pointerdown", begin, { once: true });
    from.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button, clientX: 10, clientY: 20, bubbles: true }));
  }

  function addPageBand(): HTMLElement {
    root.insertAdjacentHTML("beforeend", [
      "<div class=\"nol-toolbar-band page\" style=\"position:fixed;left:0;top:200px;width:400px;display:flex;flex-direction:column;row-gap:8px\">",
      "<div class=\"nol-toolbar-row\" data-toolbar-row=\"0\" style=\"display:flex;align-items:center;height:40px\">",
      "<div class=\"nol-toolbar\" data-toolbar=\"x\" data-toolbar-index=\"0\" style=\"flex:none;width:100px;height:24px\"></div>",
      "<div class=\"nol-toolbar\" data-toolbar=\"y\" data-toolbar-index=\"1\" style=\"flex:none;width:100px;height:24px\"></div></div></div>"
    ].join(String.empty));
    return DomFixture.one(root, ".nol-toolbar-band.page");
  }

  function moveTo(x: number, y: number): void {
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: x, clientY: y }));
  }

  it("starts only with the primary button and past the threshold", () => {
    start("a", 2);
    moveTo(150, 20);
    expect(drag.dragging()).toBeNull();

    start("a");
    moveTo(11, 21);
    expect(drag.dragging()).toBeNull();
    moveTo(150, 20);
    expect(drag.dragging()).toBe("a");
  });

  it("starts no drag from outside a toolbar band", () => {
    start("a", 0, root);
    moveTo(150, 20);

    expect([drag.dragging(), drag.band(), drag.target()]).toEqual([null, null, null]);
  });

  it("keeps a drag, its band and its targets to the band it started in, with that band's arrangement, while another band is open", () => {
    const page = addPageBand();
    start("a");
    moveTo(150, 220);

    expect([drag.dragging(), drag.band(), drag.target()]).toEqual(["a", DomFixture.one(root, ".nol-toolbar-band"), null]);
    moveTo(150, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 1, false, 200, 20, 0));

    start("y");
    moveTo(50, 220);
    expect([drag.band(), drag.target()]).toEqual([page, new ToolbarDropTarget(0, 1, false, 100, 220, 0)]);
    moveTo(50, 20);
    expect(drag.target()).toBeNull();
    moveTo(50, 202);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, true, 0, 196, 400));
    expect(toolbars.arrangementOf).toHaveBeenCalledWith("notes.page");
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect([toolbars.moveToNewRow.mock.calls, drag.band()]).toEqual([[["y", 0]], null]);
  });

  it("targets a position in a row, counting the others without the dragged toolbar", () => {
    start("a");
    moveTo(120, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, false, 100, 20, 0));
    moveTo(150, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 1, false, 200, 20, 0));
    moveTo(151, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 1, false, 200, 20, 0));

    start("c");
    moveTo(10, 60);
    expect(drag.target()).toEqual(new ToolbarDropTarget(1, 0, false, 0, 68, 0));
    start("c");
    moveTo(20, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, false, 0, 20, 0));
    moveTo(190, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 2, false, 200, 20, 0));
  });

  it("targets a position in a right-to-left row by the reading direction, with its line at the next toolbar's right edge", () => {
    root.querySelector<HTMLElement>(".nol-toolbar-band")?.setAttribute("dir", "rtl");
    start("c");
    moveTo(380, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, false, 400, 20, 0));
    moveTo(300, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 1, false, 300, 20, 0));
    moveTo(150, 20);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 2, false, 200, 20, 0));
  });

  it("targets a new row at the top and bottom quarter of a row, with its line in the middle of the gap between rows", () => {
    start("a");
    moveTo(50, 2);
    expect(drag.target()).toEqual(new ToolbarDropTarget(0, 0, true, 0, -4, 400));
    moveTo(50, 38);
    expect(drag.target()).toEqual(new ToolbarDropTarget(1, 0, true, 0, 44, 400));
    moveTo(50, 50);
    expect(drag.target()).toEqual(new ToolbarDropTarget(1, 0, true, 0, 44, 400));
    moveTo(50, 86);
    expect(drag.target()).toEqual(new ToolbarDropTarget(2, 0, true, 0, 92, 400));
  });

  it("falls back to the last row below every row, and to an empty row for a row the arrangement does not list", () => {
    const band = DomFixture.one(root, ".nol-toolbar-band");
    band.style.height = "100px";
    start("a");
    moveTo(50, 90);
    expect(drag.target()).toEqual(new ToolbarDropTarget(2, 0, true, 0, 92, 400));

    band.style.height = String.empty;
    band.insertAdjacentHTML("beforeend", "<div class=\"nol-toolbar-row\" data-toolbar-row=\"5\" style=\"height:40px\"></div>");
    moveTo(50, 116);
    expect(drag.target()).toEqual(new ToolbarDropTarget(5, 0, false, 0, 116, 0));
  });

  it("has no target outside the band or without any row", () => {
    start("a");
    moveTo(150, 20);
    moveTo(450, 20);
    expect(drag.target()).toBeNull();
    moveTo(460, 20);
    expect(drag.target()).toBeNull();
    moveTo(150, 90);
    expect(drag.target()).toBeNull();
    for (const row of root.querySelectorAll(".nol-toolbar-row"))
      row.remove();
    moveTo(150, 20);
    expect(drag.target()).toBeNull();
    root.querySelector(".nol-toolbar-band")?.remove();
    moveTo(150, 20);
    expect(drag.target()).toBeNull();
  });

  it("moves the toolbar to the target it was released over", () => {
    start("a");
    moveTo(150, 20);
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect(toolbars.move).toHaveBeenCalledWith("a", 0, 1);
    expect([drag.dragging(), drag.target()]).toEqual([null, null]);

    start("c");
    moveTo(50, 2);
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect(toolbars.moveToNewRow).toHaveBeenCalledWith("c", 0);
  });

  it("does nothing on release without a drag or a target", () => {
    start("a");
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    start("a");
    moveTo(450, 20);
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));

    expect([toolbars.move, toolbars.moveToNewRow].map(t => t.mock.calls.length)).toEqual([0, 0]);
  });

  it("cancels on Escape, a canceled pointer, a lost focus, a lost capture or a move with no button pressed, and ignores Escape when nothing is dragged", () => {
    const escape = (): KeyboardEvent => new KeyboardEvent("keydown", { key: "Escape", cancelable: true });

    start("a");
    const early = escape();
    document.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(false);
    moveTo(150, 20);
    const handled = escape();
    document.dispatchEvent(handled);
    expect([handled.defaultPrevented, drag.dragging()]).toEqual([true, null]);

    start("a");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    moveTo(150, 20);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(drag.dragging()).toBe("a");
    document.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    expect(drag.dragging()).toBeNull();

    start("a");
    moveTo(150, 20);
    window.dispatchEvent(new Event("blur"));
    expect([drag.dragging(), drag.target()]).toEqual([null, null]);

    start("a");
    moveTo(150, 20);
    document.documentElement.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    expect([drag.dragging(), drag.target()]).toEqual([null, null]);

    start("a");
    moveTo(150, 20);
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 0, clientX: 150, clientY: 20 }));
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect([drag.dragging(), drag.target(), toolbars.move.mock.calls.length]).toEqual([null, null, 0]);
  });
});
