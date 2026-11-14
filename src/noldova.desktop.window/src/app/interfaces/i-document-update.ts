/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDocumentMarker } from "./i-document-marker.js";
import type { IDocumentStatus } from "./i-document-status.js";

export interface IDocumentUpdate {
  readonly title?: string;
  readonly breadcrumb?: readonly string[];
  readonly breadcrumbIcon?: string;
  readonly image?: string | null;
  readonly imageGlyph?: string | null;
  readonly status?: IDocumentStatus | null;
  readonly marker?: IDocumentMarker | null;
  readonly underline?: string | null;
}
