/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { WindowPalette } from "../../../src/app/models/window-palette";

@Component({ selector: "nol-test-palette", template: "" })
class PaletteComponent {
}

describe("WindowPalette", () => {
  it("keeps the palette's component and its closing", () => {
    const fixture = TestBed.createComponent(PaletteComponent);
    const closed = Promise.resolve();

    const palette = new WindowPalette(fixture.componentRef, closed, () => undefined, () => true);

    expect([palette.componentRef, palette.closed]).toEqual([fixture.componentRef, closed]);
    fixture.destroy();
  });

  it("asks whether the palette still shows each time it's read", () => {
    const fixture = TestBed.createComponent(PaletteComponent);
    let isShown = true;
    const palette = new WindowPalette(fixture.componentRef, Promise.resolve(), () => undefined, () => isShown);

    const reads = [palette.isOpen];
    isShown = false;
    reads.push(palette.isOpen);

    expect(reads).toEqual([true, false]);
    fixture.destroy();
  });

  it("ends the palette when closed, once for each close", () => {
    const fixture = TestBed.createComponent(PaletteComponent);
    const ends: string[] = [];
    const palette = new WindowPalette(fixture.componentRef, Promise.resolve(), () => ends.push("end"), () => true);

    palette.close();
    palette.close();

    expect(ends).toEqual(["end", "end"]);
    fixture.destroy();
  });
});
