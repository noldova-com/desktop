/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocumentTone } from "../enums/document-tone.js";

export interface IDocumentStatus {
  readonly glyph: string;
  readonly description: string;
  readonly tone?: DocumentTone;
}
