/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewGuest } from "@noldova/desktop.electron";

import { FakeWebViewContents } from "./fake-web-view-contents.fixture.js";

export class FakeWebView implements IWebViewGuest {
  public readonly contents: FakeWebViewContents;
  public readonly hostId: number | null;
  public readonly partition: string | null;

  public constructor(contentsId: number, hostId: number | null, partition: string | null) {
    this.contents = new FakeWebViewContents(contentsId);
    this.hostId = hostId;
    this.partition = partition;
  }
}
