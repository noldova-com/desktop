/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WebViewFindRequest {
  public readonly text: string;
  public readonly matchCase: boolean;

  public constructor(text: string, matchCase: boolean) {
    this.text = text;
    this.matchCase = matchCase;
  }
}
