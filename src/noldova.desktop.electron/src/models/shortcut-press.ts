/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OpenWebView } from "../services/open-web-view.js";

export class ShortcutPress {
  public readonly view: OpenWebView;
  public readonly answer: (hasRun: boolean) => void;

  public constructor(view: OpenWebView, answer: (hasRun: boolean) => void) {
    this.view = view;
    this.answer = answer;
  }
}
