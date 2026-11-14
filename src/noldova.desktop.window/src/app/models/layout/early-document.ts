/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocumentTab } from "./document-tab.js";

export class EarlyDocument {
  public readonly tab: DocumentTab;
  public readonly isPreview: boolean;
  public readonly after: DocumentTab | null;

  public constructor(tab: DocumentTab, isPreview: boolean, after: DocumentTab | null) {
    this.tab = tab;
    this.isPreview = isPreview;
    this.after = after;
  }
}
