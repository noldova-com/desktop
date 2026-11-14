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

import { DocumentTone } from "../enums/document-tone.js";
import type { IDocumentUpdate } from "../interfaces/i-document-update.js";
import type { IDocumentMarker } from "../interfaces/i-document-marker.js";
import type { IDocumentStatus } from "../interfaces/i-document-status.js";
import { Resources } from "../../resources.js";

export class DocumentLook {
  public static readonly none: DocumentLook = new DocumentLook(null, null, null, null, null);

  private static readonly TONES: Readonly<Record<DocumentTone, TabTone>> = {
    [DocumentTone.Neutral]: TabTone.Neutral,
    [DocumentTone.Ok]: TabTone.Ok,
    [DocumentTone.Failed]: TabTone.Failed
  };

  public readonly image: string | null;
  public readonly imageGlyph: string | null;
  public readonly status: TabStatus | null;
  public readonly marker: TabMarker | null;
  public readonly underline: string | null;

  private constructor(image: string | null, imageGlyph: string | null, status: TabStatus | null, marker: TabMarker | null, underline: string | null) {
    this.image = image;
    this.imageGlyph = imageGlyph;
    this.status = status;
    this.marker = marker;
    this.underline = underline;
  }

  public static validate(change: IDocumentUpdate): void {
    DocumentLook.none.updated(change);
  }

  public static changes(change: IDocumentUpdate): boolean {
    return [change.image, change.imageGlyph, change.status, change.marker, change.underline].some(t => !Object.isUndefined(t));
  }

  public updated(change: IDocumentUpdate): DocumentLook {
    return new DocumentLook(
      Object.isUndefined(change.image) ? this.image : DocumentLook.requireImage(change.image),
      Object.isUndefined(change.imageGlyph) ? this.imageGlyph : DocumentLook.requireText(change.imageGlyph, Resources.imageGlyphParameter),
      Object.isUndefined(change.status) ? this.status : DocumentLook.toStatus(change.status),
      Object.isUndefined(change.marker) ? this.marker : DocumentLook.toMarker(change.marker),
      Object.isUndefined(change.underline) ? this.underline : DocumentLook.requireText(change.underline, Resources.underlineParameter));
  }

  private static requireImage(image: string | null): string | null {
    if (!Object.isNull(image) && !Resources.documentImagePattern.test(image))
      throw new ArgumentException(Resources.invalidDocumentImage, Resources.imageParameter);
    return image;
  }

  private static requireText(text: string | null, parameter: string): string | null {
    if (!Object.isNull(text))
      ArgumentException.throwIfNullOrWhitespace(text, parameter);
    return text;
  }

  private static toStatus(status: IDocumentStatus | null): TabStatus | null {
    if (Object.isNull(status))
      return null;
    ArgumentException.throwIfNullOrWhitespace(status.glyph, Resources.statusParameter);
    ArgumentException.throwIfNullOrWhitespace(status.description, Resources.statusParameter);
    return new TabStatus(status.glyph, status.description, DocumentLook.TONES[status.tone ?? DocumentTone.Neutral]);
  }

  private static toMarker(marker: IDocumentMarker | null): TabMarker | null {
    if (Object.isNull(marker))
      return null;
    ArgumentException.throwIfNullOrWhitespace(marker.glyph, Resources.markerParameter);
    ArgumentException.throwIfNullOrWhitespace(marker.label, Resources.markerParameter);
    return new TabMarker(marker.glyph, marker.label);
  }
}
