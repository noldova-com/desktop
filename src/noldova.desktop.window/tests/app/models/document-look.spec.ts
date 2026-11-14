/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { TabMarker, TabStatus, TabTone } from "@noldova/ui.components.angular";

import { DocumentTone } from "../../../src/app/enums/document-tone";
import { DocumentLook } from "../../../src/app/models/document-look";

describe("DocumentLook", () => {
  const favicon = "data:image/png;base64,iVBORw0KGgo=";

  it("shows nothing of its own until it is given a part", () => {
    const look = DocumentLook.none;

    expect([look.image, look.imageGlyph, look.status, look.marker, look.underline]).toEqual([null, null, null, null, null]);
  });

  it("takes each part it is given and keeps the others", () => {
    const look = DocumentLook.none.updated({ image: favicon, imageGlyph: "public", underline: "A teammate is using this page" })
      .updated({ status: { glyph: "error", description: "Can't reach this page", tone: DocumentTone.Failed }, marker: { glyph: "subdirectory_arrow_right", label: "Opened from Plans" } });

    expect([look.image, look.imageGlyph, look.underline]).toEqual([favicon, "public", "A teammate is using this page"]);
    expect(look.status).toEqual(new TabStatus("error", "Can't reach this page", TabTone.Failed));
    expect(look.marker).toEqual(new TabMarker("subdirectory_arrow_right", "Opened from Plans"));
  });

  it("removes each part given as null", () => {
    const look = DocumentLook.none.updated({ image: favicon, imageGlyph: "public", status: { glyph: "error", description: "Gone" }, marker: { glyph: "link", label: "From" }, underline: "Used" })
      .updated({ image: null, imageGlyph: null, status: null, marker: null, underline: null });

    expect([look.image, look.imageGlyph, look.status, look.marker, look.underline]).toEqual([null, null, null, null, null]);
  });

  it("gives each tone its tab tone, and a status without one the neutral tone", () => {
    const tones = [DocumentTone.Neutral, DocumentTone.Ok, DocumentTone.Failed].map(t => DocumentLook.none.updated({ status: { glyph: "info", description: "Status", tone: t } }).status?.tone);

    expect([...tones, DocumentLook.none.updated({ status: { glyph: "info", description: "Status" } }).status?.tone]).toEqual([TabTone.Neutral, TabTone.Ok, TabTone.Failed, TabTone.Neutral]);
  });

  it("refuses an image that is not a data:image URL", () => {
    for (const image of ["https://example.com/favicon.ico", "data:text/html,<p>", "favicon.png", String.empty])
      expect(() => DocumentLook.none.updated({ image })).toThrowError(ArgumentException);
  });

  it("refuses a blank glyph, status, marker or underline", () => {
    expect(() => DocumentLook.none.updated({ imageGlyph: " " })).toThrowError(ArgumentException);
    expect(() => DocumentLook.none.updated({ status: { glyph: String.empty, description: "Gone" } })).toThrowError(ArgumentException);
    expect(() => DocumentLook.none.updated({ status: { glyph: "error", description: " " } })).toThrowError(ArgumentException);
    expect(() => DocumentLook.none.updated({ marker: { glyph: " ", label: "From" } })).toThrowError(ArgumentException);
    expect(() => DocumentLook.none.updated({ marker: { glyph: "link", label: String.empty } })).toThrowError(ArgumentException);
    expect(() => DocumentLook.none.updated({ underline: String.empty })).toThrowError(ArgumentException);
  });

  it("tells whether a change names any part", () => {
    expect([DocumentLook.changes({}), DocumentLook.changes({ underline: null }), DocumentLook.changes({ image: favicon })]).toEqual([false, true, true]);
  });
});
