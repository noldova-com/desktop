/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDocumentMarker } from "./i-document-marker.js";
import type { IDocumentStatus } from "./i-document-status.js";

export interface IDocumentOptions {
  readonly preview?: boolean;
  readonly breadcrumb?: readonly string[];
  readonly breadcrumbIcon?: string;
  readonly image?: string;
  readonly imageGlyph?: string;
  readonly status?: IDocumentStatus;
  readonly marker?: IDocumentMarker;
  readonly underline?: string;
  readonly after?: string;
}
